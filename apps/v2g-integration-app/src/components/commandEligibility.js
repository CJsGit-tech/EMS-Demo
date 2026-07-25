function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeDispatchRecord(record = {}) {
  const constraints = Array.isArray(record.constraints)
    ? record.constraints.map(nonEmptyString).filter(Boolean)
    : [];

  return {
    commandId: nonEmptyString(record.command_id),
    state: nonEmptyString(record.state) ?? nonEmptyString(record.status) ?? "unknown",
    expiresAt: record.expires_at,
    projectedSoc: record.projected_soc_percent,
    impactKw: record.power_kw ?? record.expected_site_impact_kw,
    constraints,
    assumptions: Array.isArray(record.assumptions) ? record.assumptions.filter((item) => typeof item === "string" && item.trim()) : [],
    reason: record.reason,
  };
}

export function hasFutureExpiry(expiresAt, now = Date.now()) {
  if (typeof expiresAt !== "string" || expiresAt.trim().length === 0) return false;
  const timestamp = new Date(expiresAt).valueOf();
  return Number.isFinite(timestamp) && timestamp > now;
}

export function isApprovalEligible(command, now = Date.now()) {
  return Boolean(
    command?.commandId
    && command.state === "awaiting_approval"
    && hasFutureExpiry(command.expiresAt, now)
    && Number.isFinite(command.projectedSoc)
    && command.constraints.length > 0,
  );
}
