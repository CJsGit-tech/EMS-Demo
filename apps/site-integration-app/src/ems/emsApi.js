const API_BASE = import.meta.env.VITE_AGENTCREW_API_URL || "http://localhost:8002/api/v1";

const OBSERVATION_METRIC_CODES = ["energy_kwh", "irradiance_w_m2", "temperature_c"];
const DERIVED_METRIC_CODES = ["performance_ratio"];

function appendDateRange(query, from, to) {
  if (from instanceof Date && !Number.isNaN(from.valueOf())) {
    query.append("from", from.toISOString());
  }
  if (to instanceof Date && !Number.isNaN(to.valueOf())) {
    query.append("to", to.toISOString());
  }
}

function buildMetricQuery(metricCodes, { from, to, interval = "day", limit = 1000 } = {}) {
  const query = new URLSearchParams();
  appendDateRange(query, from, to);
  for (const metricCode of metricCodes) {
    query.append("metric_codes", metricCode);
  }
  query.append("interval", interval);
  query.append("limit", String(limit));
  return query;
}

function createEmsError(status) {
  const error = new Error(`EMS request failed: ${status}`);
  error.kind = status === 401 || status === 403 ? "unauthorized" : "unavailable";
  error.status = status;
  return error;
}

export async function loadEmsDashboardData({ siteCode, userId, from, to, interval = "day", signal }) {
  const derivedQuery = buildMetricQuery(DERIVED_METRIC_CODES, { from, to, interval });
  const headers = { "x-user-id": userId };

  const read = async (path) => {
    const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteCode)}${path}`, { headers, signal });
    if (!response.ok) {
      throw createEmsError(response.status);
    }
    return response.json();
  };

  const [snapshot, observationResponses, derived, catalog] = await Promise.all([
    read(""),
    Promise.all(OBSERVATION_METRIC_CODES.map((metricCode) => read(`/observations?${buildMetricQuery([metricCode], { from, to, interval }).toString()}`))),
    read(`/reports?${derivedQuery.toString()}`),
    read("/metrics"),
  ]);

  const observations = {
    ...observationResponses[0],
    records: observationResponses.flatMap((response) => response.records ?? []).sort((left, right) => new Date(left.timestamp).valueOf() - new Date(right.timestamp).valueOf()),
  };

  return { snapshot, observations, derived, catalog };
}
