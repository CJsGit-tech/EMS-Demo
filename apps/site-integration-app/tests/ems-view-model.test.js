import { describe, expect, it } from "vitest";
import { buildEmsViewModel } from "../src/ems/emsViewModel";

const snapshot = {
  site_id: "site-001",
  records: [
    {
      site_id: "site-001",
      observed_at: "2026-07-24T10:00:00Z",
      freshness: { state: "fresh" },
      quality: { state: "verified" },
      assets: [
        { asset_id: "pv-1", asset_type: "pv_array", name: "PV Array 1" },
        { asset_id: "meter-1", asset_type: "meter", name: "Main Meter" },
      ],
    },
  ],
};

const observations = {
  records: [
    {
      metric_code: "energy_kwh",
      observed_at: "2026-07-24T08:00:00Z",
      value: 120.5,
      unit: "kWh",
      quality: "good",
      source: "meter",
      lineage: { source_record_id: "obs-1" },
    },
    {
      metric_code: "energy_kwh",
      observed_at: "2026-07-24T09:00:00Z",
      value: 142.25,
      unit: "kWh",
      quality: "good",
      source: "meter",
      lineage: { source_record_id: "obs-2" },
    },
    {
      metric_code: "irradiance_w_m2",
      observed_at: "2026-07-24T08:00:00Z",
      value: 640,
      unit: "W/m²",
      quality: "good",
      source: "weather",
      lineage: { source_record_id: "obs-3" },
    },
    {
      metric_code: "irradiance_w_m2",
      observed_at: "2026-07-24T09:00:00Z",
      value: 715,
      unit: "W/m²",
      quality: "good",
      source: "weather",
      lineage: { source_record_id: "obs-4" },
    },
    {
      metric_code: "temperature_c",
      observed_at: "2026-07-24T08:00:00Z",
      value: 29.3,
      unit: "°C",
      quality: "good",
      source: "weather",
      lineage: { source_record_id: "obs-5" },
    },
    {
      metric_code: "temperature_c",
      observed_at: "2026-07-24T09:00:00Z",
      value: 30.1,
      unit: "°C",
      quality: "good",
      source: "weather",
      lineage: { source_record_id: "obs-6" },
    },
  ],
};

const derived = {
  records: [
    {
      metric_code: "performance_ratio",
      observed_at: "2026-07-24T09:00:00Z",
      value: 0.92,
      unit: "ratio",
      quality: "estimated",
      source: "report",
      lineage: { source_record_id: "derived-1" },
    },
  ],
};

const emptyResult = { records: [] };

const catalog = {
  records: [
    { metric_code: "energy_kwh", display_name: "Energy", unit: "kWh", supported: true },
    { metric_code: "irradiance_w_m2", display_name: "Irradiance", unit: "W/m²", supported: true },
    { metric_code: "temperature_c", display_name: "Temperature", unit: "°C", supported: true },
    { metric_code: "performance_ratio", display_name: "Performance Ratio", unit: "ratio", supported: true },
    { metric_code: "storage_soc", display_name: "Storage SOC", unit: "%", supported: false },
  ],
};

describe("buildEmsViewModel", () => {
  it("normalizes supported series without mixing units", () => {
    const model = buildEmsViewModel({ snapshot, observations, derived, catalog, locale: "en", siteCode: "site-001" });

    expect(model.energySeries.every((point) => point.unit === "kWh")).toBe(true);
    expect(model.weatherSeries.irradiance[0].unit).toBe("W/m²");
    expect(model.weatherSeries.temperature[0].unit).toBe("°C");
  });

  it("preserves latest values and derived performance ratio", () => {
    const model = buildEmsViewModel({ snapshot, observations, derived, catalog, locale: "en", siteCode: "site-001" });

    expect(model.health.state).toBe("healthy");
    expect(model.kpis.energy.latest.value).toBe(142.25);
    expect(model.kpis.irradiance.latest.value).toBe(715);
    expect(model.kpis.temperature.latest.value).toBe(30.1);
    expect(model.performance.state).toBe("ready");
    expect(model.performance.latest.value).toBe(0.92);
  });

  it("does not fabricate unsupported metrics", () => {
    const model = buildEmsViewModel({ snapshot, observations, derived: emptyResult, catalog, locale: "en", siteCode: "site-001" });

    expect(model.performance.state).toBe("unavailable");
    expect(model.unavailableMetrics).toContain("storage_soc");
  });

  it("marks missing observation envelopes as unavailable", () => {
    const model = buildEmsViewModel({ snapshot, observations: emptyResult, derived: emptyResult, catalog, locale: "en", siteCode: "site-001" });

    expect(model.health.state).toBe("unavailable");
    expect(model.energySeries).toEqual([]);
    expect(model.weatherSeries.irradiance).toEqual([]);
    expect(model.weatherSeries.temperature).toEqual([]);
  });

  it("accepts the PostgreSQL REST envelope field names", () => {
    const model = buildEmsViewModel({
      snapshot: { records: [{ assets: [{ asset_id: "inv-001" }] }], freshness: { state: "fresh" }, quality: { state: "valid" } },
      observations: { records: [{ metric: "energy_kwh", timestamp: "2026-07-22T09:00:00Z", value: 812, unit: "kWh", quality: { state: "valid" } }] },
      derived: { records: [{ metric: "performance_ratio", period_start: "2026-07-22T00:00:00Z", value: 0.91, unit: "ratio", quality: { state: "valid" } }] },
      catalog: { records: [] },
      locale: "en",
      siteCode: "site-001",
    });

    expect(model.health.freshness).toBe("fresh");
    expect(model.kpis.energy.latest.value).toBe(812);
    expect(model.performance.latest.value).toBe(0.91);
  });
});
