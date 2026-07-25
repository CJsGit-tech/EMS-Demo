import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentCrewDrawer from "../src/agentcrew/AgentCrewDrawer";
import { approveAgentCrewRun, confirmAgentCrewReport, createAgentCrewRun } from "../src/agentcrew/api";

vi.mock("../src/agentcrew/api", async (importOriginal) => ({
  ...(await importOriginal()),
  approveAgentCrewRun: vi.fn(),
  confirmAgentCrewReport: vi.fn(),
  createAgentCrewRun: vi.fn(),
  getAgentCrewAudit: vi.fn(),
  recallAgentCrewMemory: vi.fn(),
  saveAgentCrewPreference: vi.fn(),
}));

const siteContext = {
  siteId: "site-001",
  siteName: "Verde North",
  userId: "user-1",
  sourceRoute: "site/site-001/overview",
};

const completedReport = {
  runId: "run-report-1",
  status: "completed",
  title: "Verde North operations report draft",
  summary: "A reviewable draft was prepared.",
  reportHtml: "<article><h1>Verde North operations report</h1></article>",
  reportDraftId: "draft-1",
  reportDraftState: "draft",
  reportDraftVersion: 1,
  result: { draft: { draft_id: "draft-1", state: "draft", version: 1 } },
  events: [{ kind: "validation", label: "Structured output validated" }],
};

const completedMission = {
  runId: "run-mission-1",
  status: "completed",
  title: "Verde North operations review",
  summary: "Two specialists completed a current-site review.",
  steps: [
    {
      id: "device-review",
      role: "Device Monitoring Expert",
      status: "completed",
      statusLabel: "Completed",
      result: "HVAC-07 needs a follow-up inspection.",
      evidenceCount: 2,
      handoff: "Data Analysis Specialist",
    },
    {
      id: "energy-review",
      role: "Data Analysis Specialist",
      status: "completed",
      statusLabel: "Completed",
      result: "Morning demand remains above the site baseline.",
      evidenceCount: 1,
      handoff: null,
    },
  ],
  evidence: [
    { id: "device-health", label: "Device health and alerts", status: "verified", statusLabel: "Verified", detail: "3 current device records" },
    { id: "energy-series", label: "Energy timeseries", status: "verified", statusLabel: "Verified", detail: "24 hourly readings" },
    { id: "site-context", label: "Current site context", status: "scoped", statusLabel: "Site scoped", detail: "Verde North only" },
  ],
  limitations: ["HVAC-07 sensor freshness has not been independently verified."],
  provenance: {
    generatedAt: "2026-07-25T09:30:00Z",
    sources: ["device_health_and_alerts", "energy_timeseries"],
    draftState: "reviewable",
  },
  events: [],
};

const demoReportMission = {
  ...completedReport,
  demoMissionPreview: true,
  steps: [
    { id: "demo-1", role: "Report Generation Specialist", status: "preview", statusLabel: "Preview", result: "Demo preview: retrieve the current-site report inputs.", evidenceCount: 1, handoff: "Data Analysis Specialist" },
    { id: "demo-2", role: "Data Analysis Specialist", status: "preview", statusLabel: "Preview", result: "Demo preview: retrieve current-site energy readings.", evidenceCount: 1, handoff: "Data Analysis Specialist" },
    { id: "demo-3", role: "Data Analysis Specialist", status: "preview", statusLabel: "Preview", result: "Demo preview: analyze the retrieved energy readings for the draft.", evidenceCount: 1, handoff: "Report Generation Specialist" },
    { id: "demo-4", role: "Report Generation Specialist", status: "preview", statusLabel: "Preview", result: "Demo preview: review the current-site evidence before writing.", evidenceCount: 2, handoff: "Report Generation Specialist" },
    { id: "demo-5", role: "Report Generation Specialist", status: "preview", statusLabel: "Preview", result: "Demo preview: generate a reviewable report draft.", evidenceCount: 1, handoff: "Report Generation Specialist" },
    { id: "demo-6", role: "Report Generation Specialist", status: "preview", statusLabel: "Preview", result: "Demo preview: hold the draft for operator confirmation; it is not final.", evidenceCount: 0, handoff: null },
  ],
  evidence: [
    { id: "demo-report-inputs", label: "Current-site report inputs", status: "retrieved", statusLabel: "Retrieved", detail: "Demo data scoped to the active site." },
    { id: "demo-energy-analysis", label: "Current-site energy analysis", status: "analyzed", statusLabel: "Analyzed", detail: "Derived from the retrieved demo energy readings." },
    { id: "demo-report-draft", label: "Reviewable report draft", status: "generated", statusLabel: "Generated", detail: "Demo draft only; operator confirmation remains required." },
  ],
  limitations: ["Demo collaboration preview only: the API did not return backend step records for this run."],
  provenance: { sources: ["demo://site-001/report_inputs", "demo://site-001/energy_timeseries"], draftState: "draft" },
};

describe("AgentCrew report confirmation UI", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    createAgentCrewRun.mockResolvedValue({
      ...completedReport,
      status: "waiting_for_tool_approval",
      reportHtml: null,
    });
    approveAgentCrewRun.mockResolvedValue(completedReport);
    confirmAgentCrewReport.mockResolvedValue({ draft_id: "draft-1", state: "confirmed", version: 2 });
  });

  it("confirms a draft and replaces the action with the durable revision state", async () => {
    const user = userEvent.setup();
    render(<AgentCrewDrawer siteContext={siteContext} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Create a site operations report draft" }));
    await user.click(await screen.findByRole("button", { name: "Approve step" }));

    expect(await screen.findByText("Draft preview · not final")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm report revision" }));

    expect(confirmAgentCrewReport).toHaveBeenCalledWith(siteContext, "draft-1");
    expect(await screen.findByText("Confirmed revision · v2")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirm report revision" })).not.toBeInTheDocument());
  });

  it("renders the specialist handoff timeline and trust record", async () => {
    const user = userEvent.setup();
    createAgentCrewRun.mockResolvedValueOnce(completedMission);
    render(<AgentCrewDrawer siteContext={siteContext} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Analyze the latest energy trend" }));

    const timeline = await screen.findByRole("list", { name: "Mission handoff timeline" });
    expect(timeline).toHaveTextContent("Device Monitoring Expert");
    expect(timeline).toHaveTextContent("Completed");
    expect(timeline).toHaveTextContent("2 evidence records");
    expect(timeline).toHaveTextContent("Handoff to Data Analysis Specialist");
    expect(timeline).toHaveTextContent("Morning demand remains above the site baseline.");
    expect(screen.getByRole("heading", { name: "Trust summary" })).toBeInTheDocument();
    expect(screen.getByText("2 agents")).toBeInTheDocument();
    expect(screen.getByText("3 evidence items")).toBeInTheDocument();
    expect(screen.getByText("1 limitation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evidence" })).toBeInTheDocument();
    expect(screen.getByText("Device health and alerts")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Provenance" })).toBeInTheDocument();
    expect(screen.getByText("device_health_and_alerts")).toBeInTheDocument();
  });

  it("labels fallback report metadata as a demo preview with scoped evidence and draft provenance", async () => {
    const user = userEvent.setup();
    createAgentCrewRun.mockResolvedValueOnce(demoReportMission);
    render(<AgentCrewDrawer siteContext={siteContext} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Create a site operations report draft" }));

    expect(await screen.findByText("Demo collaboration preview")).toBeInTheDocument();
    expect(screen.getByText("6 agents")).toBeInTheDocument();
    expect(screen.getByText("Current-site report inputs")).toBeInTheDocument();
    expect(screen.getByText("Demo data scoped to the active site.")).toBeInTheDocument();
    expect(screen.getByText("Demo draft only; operator confirmation remains required.")).toBeInTheDocument();
    expect(screen.getByText("demo://site-001/report_inputs")).toBeInTheDocument();
    expect(screen.getByText("Demo collaboration preview only: the API did not return backend step records for this run.")).toBeInTheDocument();
  });

  it("keeps the six-step demo mission after approving a report response without steps", async () => {
    const user = userEvent.setup();
    createAgentCrewRun.mockResolvedValueOnce({
      ...demoReportMission,
      status: "waiting_for_tool_approval",
      reportHtml: null,
      requestMessage: "Create a site operations report draft",
    });
    approveAgentCrewRun.mockImplementationOnce(async (_site, _runId, _mode, requestMessage) => {
      expect(requestMessage).toBe("Create a site operations report draft");
      // The API adapter restores the deterministic preview because the raw approval response has no steps.
      return { ...demoReportMission, events: [] };
    });
    render(<AgentCrewDrawer siteContext={siteContext} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Create a site operations report draft" }));
    await user.click(await screen.findByRole("button", { name: "Approve step" }));

    expect(approveAgentCrewRun).toHaveBeenCalledWith(
      siteContext,
      "run-report-1",
      "approve_step",
      "Create a site operations report draft",
    );
    expect(await screen.findByText("Demo collaboration preview")).toBeInTheDocument();
    expect(screen.getByText("6 agents")).toBeInTheDocument();
  });

  it("renders a typed insufficiency result with its corrective action", async () => {
    const user = userEvent.setup();
    createAgentCrewRun.mockResolvedValueOnce({
      runId: "run-insufficient-1",
      status: "completed",
      title: "Device Monitoring Expert result",
      summary: "Insufficient current-site data; no unsupported result was produced.",
      result: {
        kind: "insufficient_data",
        message: "Fixture source unavailable after bounded retries.",
        nextAction: "Restore the unavailable source, then retry this site-scoped request.",
      },
      limitations: ["No current device-health source was available for this run."],
      events: [],
    });
    render(<AgentCrewDrawer siteContext={siteContext} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Which devices need attention today?" }));

    const warning = await screen.findByRole("status");
    expect(warning).toHaveTextContent("Fixture source unavailable after bounded retries.");
    expect(warning).toHaveTextContent("Restore the unavailable source");
    expect(screen.getByRole("heading", { name: "Limitations" })).toBeInTheDocument();
    expect(screen.getByText("No current device-health source was available for this run.")).toBeInTheDocument();
  });

  it("renders streamed GPT-5-mini progress, citations, approval, and a non-final draft before completion", async () => {
    const user = userEvent.setup();
    let finishStream;
    createAgentCrewRun.mockImplementationOnce(async (_context, _message, onEvent) => {
      onEvent({ type: "run.started", runId: "run-stream-1", data: { provider: { mode: "openai", model: "gpt-5-mini" } } });
      onEvent({ type: "specialist.delegated", runId: "run-stream-1", data: { hat: "data_analysis_specialist", label: "Data Analysis Specialist" } });
      onEvent({ type: "assistant.delta", runId: "run-stream-1", data: { delta: "Current energy demand is elevated." } });
      onEvent({ type: "tool.call", runId: "run-stream-1", data: { name: "energy_timeseries" } });
      onEvent({ type: "web_search.completed", runId: "run-stream-1", data: { id: "search-1", queries: ["grid forecast"], sources: [{ title: "Forecast", url: "https://example.test/forecast" }] } });
      onEvent({ type: "approval.required", runId: "run-stream-1", data: { status: "waiting_for_tool_approval" } });
      onEvent({ type: "report.draft.saved", runId: "run-stream-1", data: { draft: { draft_id: "draft-stream-1", state: "draft", version: 1, html: "<article><h1>Draft</h1></article>" } } });
      return await new Promise((resolve) => { finishStream = () => resolve({ ...completedReport, runId: "run-stream-1", status: "completed" }); });
    });
    render(<AgentCrewDrawer siteContext={siteContext} onClose={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Analyze the latest energy trend" }));

    expect(await screen.findByText("Current energy demand is elevated.")).toBeInTheDocument();
    expect(screen.getByText("GPT-5 mini")).toBeInTheDocument();
    expect(screen.getByText("energy_timeseries")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forecast" })).toHaveAttribute("href", "https://example.test/forecast");
    expect(screen.getByText("Draft preview · not final")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve step" })).toBeInTheDocument();

    finishStream();
    await waitFor(() => expect(screen.queryByText("Routing and reading current-site signals…")).not.toBeInTheDocument());
  });
});
