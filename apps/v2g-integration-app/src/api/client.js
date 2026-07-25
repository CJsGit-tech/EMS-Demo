const SITE_ID = "demo-v2g-site";
const API_BASE_URL = import.meta.env.VITE_V2G_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function apiUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function request(path, options = {}) {
  const response = await fetch(apiUrl(path, options.query), {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(body?.message ?? `Simulator request failed (${response.status}).`, response.status);
  }

  return body;
}

export const v2gApi = {
  getOverview: () => request(`/api/v1/sites/${SITE_ID}/overview`),
  getFleet: () => request(`/api/v1/sites/${SITE_ID}/fleet`),
  getAlarms: () => request(`/api/v1/sites/${SITE_ID}/alarms`),
  getRecommendations: () => request(`/api/v1/sites/${SITE_ID}/recommendations`),
  getHistorian: ({ from, to, metric = "power_kw" }) => request(`/api/v1/sites/${SITE_ID}/historian`, {
    query: { from, to, metric },
  }),
  approveCommand: (commandId, { actor, reason }) => request(`/api/v1/commands/${commandId}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, reason }),
  }),
  rejectCommand: (commandId, { actor, reason }) => request(`/api/v1/commands/${commandId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, reason }),
  }),
};

export { SITE_ID };
