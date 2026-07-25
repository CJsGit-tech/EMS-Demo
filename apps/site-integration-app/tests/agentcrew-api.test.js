import { describe, expect, it, vi } from "vitest";
import { approveAgentCrewRun, confirmAgentCrewReport, createAgentCrewRun, getAgentCrewAudit, getEmsSiteEnergy, getEmsSiteSnapshot, parseAgentCrewSse, recallAgentCrewMemory, saveAgentCrewPreference } from "../src/agentcrew/api";

const siteContext = { siteId: "site-001", siteName: "Verde North", userId: "user-1", sourceRoute: "site/site-001/overview" };

describe("AgentCrew REST adapter", () => {
  it("parses only complete, typed SSE envelopes and keeps an incomplete tail", () => {
    const firstChunk = [
      "event: run.started\n",
      'data: {"eventId":"evt-1","type":"run.started","runId":"run-1","sequence":1,"occurredAt":"2026-07-25T00:00:00Z","data":{"provider":{"mode":"openai","model":"gpt-5-mini"}}}\n\n',
      "event: assistant.delta\n",
      'data: {"eventId":"evt-2","type":"assistant.delta","runId":"run-1","sequence":2,"occurredAt":"2026-07-25T00:00:01Z","data":{"delta":"Current "}}',
    ].join("");

    const first = parseAgentCrewSse(firstChunk);
    expect(first.events).toHaveLength(1);
    expect(first.events[0].type).toBe("run.started");
    expect(first.remainder).toContain("assistant.delta");

    const second = parseAgentCrewSse(`${first.remainder}\n\n`);
    expect(second.events).toEqual([expect.objectContaining({ type: "assistant.delta", data: { delta: "Current " } })]);
  });

  it("ignores malformed or mismatched SSE envelopes without failing the stream", () => {
    const parsed = parseAgentCrewSse([
      "event: assistant.delta\ndata: not-json\n\n",
      "event: run.completed\ndata: {\"type\":\"run.failed\",\"data\":{}}\n\n",
      "event: run.completed\ndata: {\"eventId\":\"evt-3\",\"type\":\"run.completed\",\"runId\":\"run-1\",\"sequence\":3,\"occurredAt\":\"2026-07-25T00:00:02Z\",\"data\":{\"status\":\"completed\"}}\n\n",
    ].join(""));

    expect(parsed.events).toEqual([expect.objectContaining({ type: "run.completed" })]);
  });

  it("uses the Docker Compose API port by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: { runId: "run-default-port", status: "completed" } }) });
    vi.stubGlobal("fetch", fetchMock);

    await createAgentCrewRun(siteContext, "Show device health");

    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8004/api/v1/agentcrew/runs/stream");
  });

  it("normalizes a FastAPI run response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: { runId: "run-1", status: "completed", activeHat: "device_monitoring_expert", message: "done", result: { records: [{ site_status: "watch" }] } } }) }));
    const run = await createAgentCrewRun(siteContext, "Show device health");
    expect(run.runId).toBe("run-1");
    expect(run.title).toBe("Device Monitoring Expert");
    expect(run.resultSummary).toBe("watch");
  });

  it("normalizes mission collaboration metadata into stable frontend fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: {
      runId: "run-mission-1",
      status: "completed",
      steps: [{ id: "retrieve", role: "Data Engineer", status: "completed", result: "Retrieved site telemetry", evidenceCount: 2, handoff: "Device Monitoring Expert" }],
      evidence: [{ id: "telemetry", label: "Current-site telemetry", status: "retrieved", detail: "15-minute readings" }],
      limitations: ["No meter readings after 11:45 UTC"],
      provenance: { generatedAt: "2026-07-25T10:00:00Z", sources: ["site-001/energy"], draftState: "draft" },
    } }) }));

    const run = await createAgentCrewRun(siteContext, "Create a site operations report");

    expect(run.steps).toEqual([{ id: "retrieve", role: "Data Engineer", status: "completed", statusLabel: "Completed", result: "Retrieved site telemetry", evidenceCount: 2, handoff: "Device Monitoring Expert" }]);
    expect(run.evidence).toEqual([{ id: "telemetry", label: "Current-site telemetry", status: "retrieved", statusLabel: "Retrieved", detail: "15-minute readings" }]);
    expect(run.limitations).toEqual(["No meter readings after 11:45 UTC"]);
    expect(run.provenance).toEqual({ generatedAt: "2026-07-25T10:00:00Z", sources: ["site-001/energy"], draftState: "draft" });
  });

  it("keeps missing collaboration metadata empty without inventing evidence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: { runId: "run-basic-1", status: "completed", message: "done" } }) }));

    const run = await createAgentCrewRun(siteContext, "Show device health");

    expect(run.steps).toEqual([]);
    expect(run.evidence).toEqual([]);
    expect(run.limitations).toEqual([]);
    expect(run.provenance).toBeNull();
  });

  it("supplies a six-step demo preview only for the known report quick-start when the API omits steps", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: { runId: "run-report-preview", status: "completed", result: { draft: { state: "draft" } } } }) }));

    const run = await createAgentCrewRun(siteContext, "Create a site operations report draft");

    expect(run.demoMissionPreview).toBe(true);
    expect(run.steps).toHaveLength(6);
    expect(run.steps.map((step) => step.id)).toEqual(["demo-report-inputs", "demo-energy-retrieval", "demo-energy-analysis", "demo-evidence-review", "demo-draft-generation", "demo-operator-review"]);
    expect(run.evidence.map((item) => item.status)).toEqual(["retrieved", "analyzed", "generated"]);
    expect(run.provenance).toEqual({ sources: ["demo://site-001/report_inputs", "demo://site-001/energy_timeseries"], draftState: "draft" });
    expect(run.limitations).toEqual(["Demo collaboration preview only: the API did not return backend step records for this run."]);
  });

  it("supplies the demo preview and limitation when a report quick-start approval returns explicit empty steps", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: {
      runId: "run-report-empty-steps", status: "completed", steps: [],
      events: [{ kind: "handoff", label: "Handoff: Report Generation → Data Analysis → Report Generation", tone: "info" }],
    } }) }));

    const run = await approveAgentCrewRun(siteContext, "run-report-empty-steps", "approve_step", "Create a site operations report draft");

    expect(run.demoMissionPreview).toBe(true);
    expect(run.steps).toHaveLength(6);
    expect(run.evidence.map((item) => item.id)).toEqual(["demo-report-inputs", "demo-energy-analysis", "demo-report-draft"]);
    expect(run.limitations).toEqual(["Demo collaboration preview only: the API did not return backend step records for this run."]);
    expect(run.events).toEqual([{ kind: "handoff", label: "Handoff: Report Generation → Data Analysis → Report Generation", tone: "info" }]);
  });

  it("keeps explicit empty API steps empty outside the exact report quick-start", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: {
      runId: "run-non-report-empty-steps", status: "completed", steps: [],
    } }) }));

    const run = await createAgentCrewRun(siteContext, "Analyze the latest energy trend");

    expect(run.demoMissionPreview).toBe(false);
    expect(run.steps).toEqual([]);
    expect(run.evidence).toEqual([]);
    expect(run.limitations).toEqual([]);
    expect(run.provenance).toBeNull();
  });

  it("preserves API-provided report steps without adding demo preview steps", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: {
      runId: "run-api-steps", status: "completed", steps: [{ id: "api-step", role: "Report Generation Specialist", status: "completed" }],
    } }) }));

    const run = await createAgentCrewRun(siteContext, "Create a site operations report draft");

    expect(run.demoMissionPreview).toBe(false);
    expect(run.steps).toHaveLength(1);
    expect(run.steps[0].id).toBe("api-step");
    expect(run.evidence).toEqual([]);
    expect(run.provenance).toBeNull();
  });

  it("normalizes malformed provenance to its typed frontend shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ run: {
      runId: "run-malformed-provenance-1",
      status: "completed",
      provenance: {
        generatedAt: 1721901600000,
        sources: ["site-001/energy", 42, { id: "untyped-source" }, null],
        draftState: { value: "draft" },
        unexpected: { nested: true },
      },
    } }) }));

    const run = await createAgentCrewRun(siteContext, "Create a site operations report");

    expect(run.provenance).toEqual({ sources: ["site-001/energy"] });
    expect(run.provenance).not.toHaveProperty("unexpected");
  });

  it("surfaces API failure instead of fabricating a local result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(createAgentCrewRun(siteContext, "Show device health")).rejects.toThrow("unavailable");
  });

  it("calls site-scoped memory and preference contracts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ memory: { siteId: "site-001", preferences: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ preference: { preferenceKey: "response_style" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await recallAgentCrewMemory(siteContext, "session-user-1-site-001", "format");
    await saveAgentCrewPreference(siteContext, "response_style", "concise bullets");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].body).toContain("siteId");
  });

  it("includes the active user when loading the audit stream", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await getAgentCrewAudit(siteContext);
    expect(fetchMock.mock.calls[0][0]).toContain("site_id=site-001");
    expect(fetchMock.mock.calls[0][0]).toContain("user_id=user-1");
  });

  it("retrieves EMS snapshots through the site-scoped REST path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ site_id: "site-001", outcome: "ok", records: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await getEmsSiteSnapshot(siteContext);
    expect(fetchMock.mock.calls[0][0]).toContain("/sites/site-001");
    expect(fetchMock.mock.calls[0][1].headers["x-user-id"]).toBe("user-1");
  });

  it("keeps EMS time-series retrieval bounded by explicit query parameters", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ records: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await getEmsSiteEnergy(siteContext, { from: "2026-07-22T09:00:00Z", to: "2026-07-22T12:00:00Z", limit: 100 });
    expect(fetchMock.mock.calls[0][0]).toContain("from=2026-07-22T09%3A00%3A00Z");
    expect(fetchMock.mock.calls[0][0]).toContain("limit=100");
  });

  it("confirms a report revision through the site-scoped API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ report: { draft_id: "draft-1", state: "confirmed", version: 2 } }) });
    vi.stubGlobal("fetch", fetchMock);
    const report = await confirmAgentCrewReport(siteContext, "draft-1");
    expect(report).toEqual({ draft_id: "draft-1", state: "confirmed", version: 2 });
    expect(fetchMock.mock.calls[0][0]).toContain("/agentcrew/reports/draft-1/confirm");
  });
});
