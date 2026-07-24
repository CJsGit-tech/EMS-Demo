const SUPPORTED_METRICS = ["energy_kwh", "irradiance_w_m2", "temperature_c"];

function toArray(envelope) {
  return Array.isArray(envelope?.records) ? envelope.records : [];
}

function toTimestamp(value) {
  const timestamp = new Date(value ?? "").getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortByObservedAt(records) {
  return [...records].sort((left, right) => toTimestamp(left.observed_at ?? left.timestamp ?? left.period_start) - toTimestamp(right.observed_at ?? right.timestamp ?? right.period_start));
}

function normalizePoint(record, fallbackUnit = "") {
  const quality = record?.quality;
  return {
    timestamp: record?.observed_at ?? record?.timestamp ?? record?.period_start ?? null,
    value: typeof record?.value === "number" ? record.value : Number(record?.value),
    unit: record?.unit ?? fallbackUnit,
    quality: typeof quality === "string" ? quality : quality?.state ?? null,
    source: record?.source ?? null,
    lineage: record?.lineage ?? null,
    metricCode: record?.metric_code ?? record?.metric ?? null,
  };
}

function normalizeSeries(records, fallbackUnit = "") {
  return sortByObservedAt(records).map((record) => normalizePoint(record, fallbackUnit));
}

function latestPoint(series) {
  return series.length > 0 ? series[series.length - 1] : null;
}

function findCatalogRecord(catalogRecords, metricCode) {
  return catalogRecords.find((record) => record?.metric_code === metricCode) ?? null;
}

function metricState(series) {
  return series.length > 0 ? "ready" : "unavailable";
}

export function buildEmsViewModel({ snapshot, observations, derived, catalog, locale, siteCode }) {
  const snapshotRecord = toArray(snapshot)[0] ?? null;
  const observationRecords = toArray(observations);
  const derivedRecords = toArray(derived);
  const catalogRecords = toArray(catalog);
  const recordsByMetric = Object.groupBy
    ? Object.groupBy(observationRecords, (record) => record?.metric_code ?? record?.metric ?? "")
    : observationRecords.reduce((accumulator, record) => {
      const key = record?.metric_code ?? record?.metric ?? "";
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(record);
      return accumulator;
    }, {});

  const energySeries = normalizeSeries(recordsByMetric.energy_kwh ?? [], findCatalogRecord(catalogRecords, "energy_kwh")?.unit ?? "kWh");
  const irradianceSeries = normalizeSeries(recordsByMetric.irradiance_w_m2 ?? [], findCatalogRecord(catalogRecords, "irradiance_w_m2")?.unit ?? "W/m²");
  const temperatureSeries = normalizeSeries(recordsByMetric.temperature_c ?? [], findCatalogRecord(catalogRecords, "temperature_c")?.unit ?? "°C");
  const performanceSeries = normalizeSeries(
    derivedRecords.filter((record) => (record?.metric_code ?? record?.metric) === "performance_ratio"),
    findCatalogRecord(catalogRecords, "performance_ratio")?.unit ?? "ratio",
  );

  const unsupportedCatalogMetrics = catalogRecords
    .filter((record) => record?.supported === false)
    .map((record) => record.metric_code)
    .filter(Boolean);

  const missingRequiredMetrics = SUPPORTED_METRICS.filter((metricCode) => (recordsByMetric[metricCode] ?? []).length === 0);
  if (performanceSeries.length === 0) {
    missingRequiredMetrics.push("performance_ratio");
  }

  return {
    locale,
    siteCode,
    health: {
      state: observationRecords.length > 0 ? "healthy" : "unavailable",
      freshness: snapshot?.freshness?.state ?? null,
      quality: snapshot?.quality?.state ?? null,
      observedAt: snapshot?.freshness?.as_of ?? latestPoint(energySeries)?.timestamp ?? null,
    },
    kpis: {
      energy: {
        state: metricState(energySeries),
        latest: latestPoint(energySeries),
        windowTotal: energySeries.reduce((total, point) => total + (Number.isFinite(point.value) ? point.value : 0), 0),
      },
      irradiance: {
        state: metricState(irradianceSeries),
        latest: latestPoint(irradianceSeries),
      },
      temperature: {
        state: metricState(temperatureSeries),
        latest: latestPoint(temperatureSeries),
      },
    },
    energySeries,
    weatherSeries: {
      irradiance: irradianceSeries,
      temperature: temperatureSeries,
    },
    performance: {
      state: metricState(performanceSeries),
      latest: latestPoint(performanceSeries),
      series: performanceSeries,
    },
    unavailableMetrics: [...new Set([...unsupportedCatalogMetrics, ...missingRequiredMetrics])],
    assets: Array.isArray(snapshotRecord?.assets) ? snapshotRecord.assets : [],
  };
}
