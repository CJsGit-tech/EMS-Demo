const API_BASE = import.meta.env.VITE_AGENTCREW_API_URL || "http://localhost:8004/api/v1";
const EMS_DATA_MODE = import.meta.env.VITE_EMS_DATA_MODE || "api";

const HAT_LABELS = {
  site_security_manager: "Site Security Manager",
  device_monitoring_expert: "Device Monitoring Expert",
  data_analysis_specialist: "Data Analysis Specialist",
  report_generation_specialist: "Report Generation Specialist",
};

const REPORT_QUICK_START = "Create a site operations report draft";

function chooseHat(message) {
  const value = message.toLowerCase();
  if (/report|summary|draft|formal/.test(value)) return "report_generation_specialist";
  if (/energy|trend|kpi|analysis|compare|consumption/.test(value)) return "data_analysis_specialist";
  if (/device|alert|hvac|temperature|monitor/.test(value)) return "device_monitoring_expert";
  return "site_security_manager";
}

function localResult(siteContext, message) {
  const hat = chooseHat(message);
  const label = HAT_LABELS[hat];
  const isReport = hat === "report_generation_specialist";
  const isData = hat === "data_analysis_specialist" || isReport;
  const events = [
    { kind: "route", label: `Routed to ${label}`, tone: "info" },
    { kind: "skill", label: `Loaded ${label} skill v1`, tone: "info" },
    { kind: "tool", label: "Read current-site EMS fixture", tone: "success" },
  ];
  if (isReport) events.push({ kind: "handoff", label: "Handoff: Report Generation → Data Analysis → Report Generation", tone: "info" });
  if (isData) events.push({ kind: "validation", label: "Structured output validated", tone: "success" });

  const title = isReport ? `${siteContext.siteName} operations report draft` : `${label} result for ${siteContext.siteName}`;
  const summary = isReport
    ? "A reviewable draft was prepared from current-site status, device, alert, and energy signals."
    : hat === "device_monitoring_expert"
      ? "Two devices are stable; one HVAC signal is worth checking during the next operator round."
      : hat === "data_analysis_specialist"
        ? "Morning demand is elevated against the site baseline; the signal is medium confidence."
        : "The current site security posture is within the expected operating envelope.";

  return {
    runId: `local-${Date.now()}`,
    status: "completed",
    hat,
    title,
    summary,
    events,
    reportHtml: isReport
      ? `<article><h1>${siteContext.siteName} operations report</h1><p>${summary}</p><section><h2>Operational summary</h2><p>Current-site readings are available for manager review.</p></section><section><h2>Recommended actions</h2><ul><li>Review the morning load schedule and confirm HVAC-07 sensor condition.</li></ul></section><footer><small>Draft · Site ${siteContext.siteId}</small></footer></article>`
      : null,
  };
}

function statusLabel(status) {
  return String(status || "unknown")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.map((step, index) => ({
    ...step,
    id: step?.id || `step-${index + 1}`,
    role: step?.role || "AgentCrew",
    status: step?.status || "unknown",
    statusLabel: statusLabel(step?.status),
    result: step?.result || null,
    evidenceCount: Number.isFinite(step?.evidenceCount) ? step.evidenceCount : 0,
    handoff: step?.handoff || null,
  }));
}

function normalizeEvidence(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((item, index) => ({
    ...item,
    id: item?.id || `evidence-${index + 1}`,
    label: item?.label || "Untitled evidence",
    status: item?.status || "unknown",
    statusLabel: statusLabel(item?.status),
    detail: item?.detail || null,
  }));
}

function normalizeProvenance(provenance) {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return null;

  const normalized = {
    sources: Array.isArray(provenance.sources) ? provenance.sources.filter((source) => typeof source === "string") : [],
  };
  if (typeof provenance.generatedAt === "string") normalized.generatedAt = provenance.generatedAt;
  if (typeof provenance.draftState === "string") normalized.draftState = provenance.draftState;
  return normalized;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function reportQuickStartPreview(siteContext, draftState) {
  const sourcePrefix = `demo://${siteContext.siteId}`;
  return {
    steps: normalizeSteps([
      { id: "demo-report-inputs", role: "Report Generation Specialist", status: "preview", result: "Demo preview: retrieve the current-site report inputs.", evidenceCount: 1, handoff: "Data Analysis Specialist" },
      { id: "demo-energy-retrieval", role: "Data Analysis Specialist", status: "preview", result: "Demo preview: retrieve current-site energy readings.", evidenceCount: 1, handoff: "Data Analysis Specialist" },
      { id: "demo-energy-analysis", role: "Data Analysis Specialist", status: "preview", result: "Demo preview: analyze the retrieved energy readings for the draft.", evidenceCount: 1, handoff: "Report Generation Specialist" },
      { id: "demo-evidence-review", role: "Report Generation Specialist", status: "preview", result: "Demo preview: review the current-site evidence before writing.", evidenceCount: 2, handoff: "Report Generation Specialist" },
      { id: "demo-draft-generation", role: "Report Generation Specialist", status: "preview", result: "Demo preview: generate a reviewable report draft.", evidenceCount: 1, handoff: "Report Generation Specialist" },
      { id: "demo-operator-review", role: "Report Generation Specialist", status: "preview", result: "Demo preview: hold the draft for operator confirmation; it is not final.", evidenceCount: 0, handoff: null },
    ]),
    evidence: normalizeEvidence([
      { id: "demo-report-inputs", label: "Current-site report inputs", status: "retrieved", detail: "Demo data scoped to the active site." },
      { id: "demo-energy-analysis", label: "Current-site energy analysis", status: "analyzed", detail: "Derived from the retrieved demo energy readings." },
      { id: "demo-report-draft", label: "Reviewable report draft", status: "generated", detail: "Demo draft only; operator confirmation remains required." },
    ]),
    limitations: ["Demo collaboration preview only: the API did not return backend step records for this run."],
    provenance: { sources: [`${sourcePrefix}/report_inputs`, `${sourcePrefix}/energy_timeseries`], draftState: draftState || "demo preview" },
  };
}

function normalizeRun(payload, requestMessage, siteContext) {
  const run = payload?.run || payload;
  const draft = run?.result?.draft;
  const specialistOutput = run?.result?.specialistOutput || run?.result?.analysisOutput;
  const evidenceRecord = run?.result?.records?.[0];
  const handoffSequence = run?.result?.handoffSequence || run?.routing?.handoffSequence || [];
  const backendStepsMissingOrEmpty = !hasOwn(run, "steps") || (Array.isArray(run?.steps) && run.steps.length === 0);
  const demoPreview = requestMessage?.trim() === REPORT_QUICK_START && backendStepsMissingOrEmpty
    ? reportQuickStartPreview(siteContext, draft?.state || run?.reportDraftState)
    : null;
  return {
    ...run,
    summary: run?.summary || run?.message,
    resultSummary: specialistOutput?.summary || evidenceRecord?.energy_summary || evidenceRecord?.site_status || null,
    reportHtml: run?.reportHtml || draft?.html || null,
    reportDraftId: draft?.draft_id || run?.reportDraftId || null,
    reportDraftState: draft?.state || run?.reportDraftState || null,
    reportDraftVersion: draft?.version || run?.reportDraftVersion || null,
    title: run?.title || draft?.title || (run?.activeHat ? HAT_LABELS[run.activeHat] : "AgentCrew result"),
    requestMessage,
    demoMissionPreview: Boolean(demoPreview),
    steps: demoPreview?.steps || normalizeSteps(run?.steps),
    evidence: hasOwn(run, "evidence") ? normalizeEvidence(run?.evidence) : demoPreview?.evidence || [],
    limitations: hasOwn(run, "limitations") && Array.isArray(run?.limitations) ? run.limitations : demoPreview?.limitations || [],
    provenance: hasOwn(run, "provenance") ? normalizeProvenance(run?.provenance) : demoPreview?.provenance || null,
    events: run?.events || [
      ...(run?.routing?.selectedHat ? [{ kind: "route", label: `Routed to ${HAT_LABELS[run.routing.selectedHat] || run.routing.selectedHat}`, tone: "info" }] : []),
      ...(handoffSequence.length > 1 ? [{ kind: "handoff", label: `Handoff: ${handoffSequence.join(" → ")}`, tone: "info" }] : []),
      ...(run?.status === "completed" ? [{ kind: "validation", label: "Structured output validated", tone: "success" }] : []),
    ],
  };
}

export async function createAgentCrewRun(siteContext, message) {
  const onEvent = arguments[2];
  const body = {
    site_id: siteContext.siteId,
    source_route: siteContext.sourceRoute,
    user_id: siteContext.userId,
    session_id: `session-${siteContext.userId}-${siteContext.siteId}`,
    message,
  };

  try {
    const response = await fetch(`${API_BASE}/agentcrew/runs/stream`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`AgentCrew API returned ${response.status}`);
    // Keep the JSON branch for a non-streaming test adapter or an older proxy;
    // regular API responses always expose a ReadableStream body.
    if (!response.body?.getReader) return normalizeRun(await response.json(), message, siteContext);

    let streamRun = createStreamRun(message);
    let remainder = "";
    let terminal = false;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      remainder += decoder.decode(value || new Uint8Array(), { stream: !done });
      const parsed = parseAgentCrewSse(remainder);
      remainder = parsed.remainder;
      for (const event of parsed.events) {
        streamRun = reduceAgentCrewStreamEvent(streamRun, event);
        if (typeof onEvent === "function") onEvent(event);
        terminal ||= event.type === "run.completed" || event.type === "run.failed";
      }
      if (done) break;
    }

    const finalChunk = parseAgentCrewSse(`${remainder}\n\n`);
    for (const event of finalChunk.events) {
      streamRun = reduceAgentCrewStreamEvent(streamRun, event);
      if (typeof onEvent === "function") onEvent(event);
      terminal ||= event.type === "run.completed" || event.type === "run.failed";
    }
    if (!terminal && streamRun.status !== "waiting_for_tool_approval") throw new Error("AgentCrew stream ended before completion");
    return normalizeRun(streamRun, message, siteContext);
  } catch (error) {
    throw new Error(`AgentCrew is unavailable: ${error.message}`);
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sseEventFromBlock(block) {
  const lines = block.replace(/\r/g, "").split("\n");
  let eventName = "";
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!eventName || dataLines.length === 0) return null;
  try {
    const envelope = JSON.parse(dataLines.join("\n"));
    if (!isRecord(envelope) || envelope.type !== eventName || !isRecord(envelope.data)) return null;
    if (typeof envelope.eventId !== "string" || typeof envelope.runId !== "string" || !Number.isFinite(envelope.sequence) || typeof envelope.occurredAt !== "string") return null;
    return envelope;
  } catch {
    return null;
  }
}

/** Parse complete SSE records and return any partial record for the next chunk. */
export function parseAgentCrewSse(source) {
  const text = typeof source === "string" ? source : "";
  const blocks = text.split(/\r?\n\r?\n/);
  const complete = blocks.slice(0, -1);
  return {
    events: complete.map(sseEventFromBlock).filter(Boolean),
    remainder: blocks.at(-1) || "",
  };
}

function activityLabel(type, data) {
  if (type === "tool.call") return data.name || "Current-site tool";
  if (type === "web_search.started") return "Web search in progress";
  if (type === "web_search.completed") return data.queries?.[0] || "Web search completed";
  return "Agent activity";
}

function uniqueCitations(current, sources) {
  const known = new Set(current.map((citation) => citation.url));
  return [...current, ...sources.filter((source) => isRecord(source) && typeof source.url === "string" && !known.has(source.url)).map((source) => ({ url: source.url, title: typeof source.title === "string" ? source.title : source.url }))];
}

function createStreamRun(requestMessage) {
  return { requestMessage, status: "running", events: [], activities: [], citations: [], assistantText: "", steps: [], evidence: [], limitations: [], provenance: null };
}

/** Reduce a public typed SSE envelope into the render-safe AgentCrew run state. */
export function reduceAgentCrewStreamEvent(current, event) {
  if (!isRecord(event) || typeof event.type !== "string" || !isRecord(event.data)) return current || createStreamRun("");
  const run = current || createStreamRun("");
  const data = event.data;
  const next = { ...run, runId: event.runId || run.runId, streamEvents: [...(run.streamEvents || []), event] };
  const addEvent = (kind, label) => ({ ...next, events: [...(next.events || []), { kind, label, tone: "info" }] });

  if (event.type === "run.started") {
    const provider = isRecord(data.provider) ? data.provider : null;
    return { ...addEvent("run", "Run started"), status: "running", provider, demoMode: provider?.mode === "deterministic-fixtures" };
  }
  if (event.type === "specialist.delegated") {
    const label = typeof data.label === "string" ? data.label : HAT_LABELS[data.hat] || "AgentCrew";
    return { ...addEvent("agent", `Delegated to ${label}`), activeHat: typeof data.hat === "string" ? data.hat : run.activeHat, title: label };
  }
  if (event.type === "assistant.delta") {
    const delta = typeof data.delta === "string" ? data.delta : "";
    return { ...next, assistantText: `${run.assistantText || ""}${delta}`, summary: `${run.assistantText || ""}${delta}` };
  }
  if (event.type === "tool.call" || event.type === "web_search.started" || event.type === "web_search.completed") {
    const activity = { id: data.callId || data.id || `${event.type}-${event.sequence || (run.activities || []).length}`, kind: event.type, label: activityLabel(event.type, data) };
    return { ...addEvent(event.type, activity.label), activities: [...(run.activities || []), activity], citations: event.type === "web_search.completed" ? uniqueCitations(run.citations || [], Array.isArray(data.sources) ? data.sources : []) : run.citations || [] };
  }
  if (event.type === "approval.required" || event.type === "run.waiting_for_tool_approval") {
    return { ...addEvent("approval", "Approval required"), status: "waiting_for_tool_approval" };
  }
  if (event.type === "report.draft.saved") {
    const draft = isRecord(data.draft) ? data.draft : data;
    return {
      ...addEvent("draft", "Report draft saved"),
      reportHtml: typeof draft.html === "string" ? draft.html : run.reportHtml,
      reportDraftId: typeof draft.draft_id === "string" ? draft.draft_id : run.reportDraftId,
      reportDraftState: typeof draft.state === "string" ? draft.state : "draft",
      reportDraftVersion: Number.isFinite(draft.version) ? draft.version : run.reportDraftVersion,
      result: { ...(run.result || {}), draft },
    };
  }
  if (event.type === "run.failed") {
    return { ...addEvent("error", typeof data.message === "string" ? data.message : "AgentCrew run failed"), status: "failed", error: typeof data.message === "string" ? data.message : "AgentCrew run failed" };
  }
  if (event.type === "run.completed") {
    const result = isRecord(data.result) ? data.result : run.result;
    const draft = isRecord(data.draft) ? data.draft : result?.draft;
    return {
      ...addEvent("complete", "Run completed"),
      status: typeof data.status === "string" ? data.status : "completed",
      provider: isRecord(data.provider) ? data.provider : run.provider,
      summary: typeof data.summary === "string" ? data.summary : run.summary,
      result,
      reportHtml: typeof draft?.html === "string" ? draft.html : run.reportHtml,
      reportDraftId: typeof draft?.draft_id === "string" ? draft.draft_id : run.reportDraftId,
      reportDraftState: typeof draft?.state === "string" ? draft.state : run.reportDraftState,
      reportDraftVersion: Number.isFinite(draft?.version) ? draft.version : run.reportDraftVersion,
    };
  }
  return next;
}

export async function approveAgentCrewRun(siteContext, runId, mode = "approve_step", requestMessage) {
  const response = await fetch(`${API_BASE}/agentcrew/runs/${encodeURIComponent(runId)}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session_id: `session-${siteContext.userId}-${siteContext.siteId}`, mode }),
  });
  if (!response.ok) throw new Error("Approval failed");
  return normalizeRun(await response.json(), requestMessage, siteContext);
}

export async function confirmAgentCrewReport(siteContext, draftId) {
  const response = await fetch(`${API_BASE}/agentcrew/reports/${encodeURIComponent(draftId)}/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(siteContext),
  });
  if (!response.ok) throw new Error("Report revision could not be confirmed");
  return (await response.json()).report;
}

export async function getAgentCrewAudit(siteContext) {
  const params = new URLSearchParams({ site_id: siteContext.siteId, user_id: siteContext.userId });
  const response = await fetch(`${API_BASE}/agentcrew/audit?${params.toString()}`);
  if (!response.ok) throw new Error("Audit unavailable");
  return await response.json();
}

export async function recallAgentCrewMemory(siteContext, sessionId, query = "") {
  const response = await fetch(`${API_BASE}/agentcrew/memory/recall`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...siteContext, sessionId, query }),
  });
  if (!response.ok) throw new Error("Memory unavailable");
  return (await response.json()).memory;
}

export async function saveAgentCrewPreference(siteContext, preferenceKey, value) {
  const response = await fetch(`${API_BASE}/agentcrew/preferences`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...siteContext, preferenceKey, value }),
  });
  if (!response.ok) throw new Error("Preference could not be saved");
  return (await response.json()).preference;
}

export async function getEmsSiteSnapshot(siteContext) {
  if (EMS_DATA_MODE === "fixtures") return { status: "fixture", records: [] };
  const siteId = siteContext.emsSiteId || siteContext.siteId;
  const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteId)}`, { headers: { "x-user-id": siteContext.userId } });
  if (!response.ok) throw new Error(`EMS retrieval returned ${response.status}`);
  return await response.json();
}

export async function getEmsSiteEnergy(siteContext, params = {}) {
  const siteId = siteContext.emsSiteId || siteContext.siteId;
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null));
  const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteId)}/energy?${query.toString()}`, { headers: { "x-user-id": siteContext.userId } });
  if (!response.ok) throw new Error(`EMS energy retrieval returned ${response.status}`);
  return await response.json();
}
