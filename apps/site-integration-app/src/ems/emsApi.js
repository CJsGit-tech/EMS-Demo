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

function buildMetricQuery(metricCodes, { from, to, limit = 1000 } = {}) {
  const query = new URLSearchParams();
  appendDateRange(query, from, to);
  for (const metricCode of metricCodes) {
    query.append("metric_codes", metricCode);
  }
  query.append("limit", String(limit));
  return query;
}

function createEmsError(status) {
  const error = new Error(`EMS request failed: ${status}`);
  error.kind = status === 401 || status === 403 ? "unauthorized" : "unavailable";
  error.status = status;
  return error;
}

export async function loadEmsDashboardData({ siteCode, userId, from, to, signal }) {
  const observationQuery = buildMetricQuery(OBSERVATION_METRIC_CODES, { from, to });
  const derivedQuery = buildMetricQuery(DERIVED_METRIC_CODES, { from, to });
  const headers = { "x-user-id": userId };

  const read = async (path) => {
    const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteCode)}${path}`, { headers, signal });
    if (!response.ok) {
      throw createEmsError(response.status);
    }
    return response.json();
  };

  const [snapshot, observations, derived, catalog] = await Promise.all([
    read(""),
    read(`/observations?${observationQuery.toString()}`),
    read(`/reports?${derivedQuery.toString()}`),
    read("/metrics"),
  ]);

  return { snapshot, observations, derived, catalog };
}
