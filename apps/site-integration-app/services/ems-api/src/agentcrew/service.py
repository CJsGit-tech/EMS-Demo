"""In-memory application service for local AgentCrew runs and governance."""

from dataclasses import asdict
from typing import Any, Callable
from uuid import uuid4

from .contracts import ActiveSiteContext, AgentCrewRun, AgentHat, AgentRunStatus, ApprovalMode
from .errors import AgentCrewError, AgentCrewErrorCode
from .mcp import build_mcp_gateway
from .openai_provider import OpenAIProvider, build_provider
from .router import assert_handoff, route
from .runtime import AuditEvent, ReportDraft, SourceReference, ToolRequest, ToolResult, public_run, redact, require_site_context, sanitize_html
from .memory import MemoryManager
from .persistence import DurableRepository


class AgentCrewService:
    def __init__(self, provider: OpenAIProvider | None = None, gateway=None) -> None:
        self.runs: dict[str, dict[str, Any]] = {}
        self.audit_events: list[AuditEvent] = []
        self.drafts: dict[str, ReportDraft] = {}
        self.stream_artifacts: dict[str, dict[str, Any]] = {}
        self.approvals: set[tuple[str, str]] = set()
        self.idempotency: dict[str, str] = {}
        self.provider = provider if provider is not None else build_provider()
        self.memory = MemoryManager()
        self.persistence = DurableRepository()
        self._persisted_audit_ids: set[str] = set()
        self.gateway = gateway or build_mcp_gateway(
            self.audit_events.append,
            lambda session, tool: (session, tool) in self.approvals,
            self._persist_mcp_attempt,
        )

    def context(self, context: ActiveSiteContext) -> dict[str, Any]:
        require_site_context(context)
        return {"siteContext": {"siteId": context.site_id, "siteName": context.site_name, "userId": context.user_id,
                                 "sourceRoute": context.source_route}, "capabilities": {"agentCrew": True, "audit": True, "reports": True}}

    def start(self, context: ActiveSiteContext, message: str, session_id: str, idempotency_key: str | None = None) -> dict[str, Any]:
        require_site_context(context)
        if not message.strip():
            raise AgentCrewError(AgentCrewErrorCode.VALIDATION_FAILED, "message must not be empty")
        if idempotency_key and idempotency_key in self.idempotency:
            return self.snapshot(self.idempotency[idempotency_key])
        self.memory.ensure_session(session_id, context.site_id, context.user_id)
        self.persistence.save_session(session_id, context.site_id, context.user_id)
        run_id = f"run-{uuid4().hex[:10]}"
        user_message = self.memory.append_message(session_id, context.site_id, context.user_id, "user", message, run_id)
        self.persistence.save_message(user_message, session_id, context.site_id, context.user_id, message, run_id)
        hat = route(message)
        run = AgentCrewRun(run_id, AgentRunStatus.QUEUED, context, hat, "Run accepted.")
        self.runs[run_id] = {"run": run, "message": message, "session_id": session_id, "handoffs": [hat], "result": None,
                             "approval_needed": False, "repair_count": 0,
                             "memory": self.recall(session_id, context, message), "assistant_message_saved": False,
                             "report_first": None, "pending_tool": None}
        if idempotency_key:
            self.idempotency[idempotency_key] = run_id
        self.audit_events.append(AuditEvent("run.created", run_id, context.site_id, context.user_id, session_id,
                                            {"hat": hat.value, "message": redact(message)}))
        self._execute(run_id)
        self._persist_state(run_id)
        self._append_completion_message(run_id)
        return self.snapshot(run_id)

    def _execute(self, run_id: str) -> None:
        state = self.runs[run_id]; run: AgentCrewRun = state["run"]
        state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.RUNNING, run.site_context, run.active_hat, "Running deterministic fixture workflow.")
        if run.active_hat == AgentHat.REPORT_GENERATION_SPECIALIST:
            self._report_chain(run_id)
            return
        tool = self.gateway.workflow_tools[run.active_hat.value]["read"]
        result = self.gateway.call(ToolRequest(run_id, state["session_id"], run.site_context, tool, {"site_id": run.site_context.site_id}))
        if result.outcome == "approval_required":
            state["approval_needed"] = True
            state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.WAITING_FOR_TOOL_APPROVAL, run.site_context, run.active_hat, "A current-site data read needs approval.")
            return
        if result.outcome == "missing_source":
            self._complete_insufficient(run_id, result)
            return
        evidence = {"records": list(result.records), "sources": [asdict(s) for s in result.sources], "quality_notices": [asdict(n) for n in result.quality_notices]}
        state["result"] = {"records": list(result.records), "sources": [asdict(s) for s in result.sources], "qualityNotices": [asdict(n) for n in result.quality_notices]}
        if self.provider:
            output = self._generate_with_repair(run_id, run.active_hat, run.site_context, state["message"], {result.tool_key: evidence, "site_memory": state["memory"]})
            if output is None:
                return
            state["result"]["specialistOutput"] = output
            self.audit_events.append(AuditEvent("llm.output_validated", run_id, run.site_context.site_id, run.site_context.user_id, state["session_id"], {"model": self.provider.model, "hat": run.active_hat.value}))
        state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.COMPLETED, run.site_context, run.active_hat, "Completed with fixture-backed evidence.")

    def _report_chain(self, run_id: str) -> None:
        state = self.runs[run_id]; run: AgentCrewRun = state["run"]
        report_tool = self.gateway.workflow_tools[AgentHat.REPORT_GENERATION_SPECIALIST.value]["report"]
        analysis_tool = self.gateway.workflow_tools[AgentHat.REPORT_GENERATION_SPECIALIST.value]["analysis"]
        first = state.get("report_first")
        if first is None:
            first = self.gateway.call(ToolRequest(run_id, state["session_id"], run.site_context, report_tool, {"site_id": run.site_context.site_id}))
            if first.outcome == "approval_required":
                state["approval_needed"] = True
                state["pending_tool"] = report_tool
                state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.WAITING_FOR_TOOL_APPROVAL, run.site_context, run.active_hat, "A report input read needs approval.")
                return
            if first.outcome == "missing_source":
                self._complete_insufficient(run_id, first)
                return
            state["report_first"] = first
        analysis = self.gateway.call(ToolRequest(run_id, state["session_id"], run.site_context, analysis_tool, {"site_id": run.site_context.site_id}))
        if analysis.outcome == "approval_required":
            state["approval_needed"] = True
            state["pending_tool"] = analysis_tool
            state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.WAITING_FOR_TOOL_APPROVAL, run.site_context, run.active_hat, "An energy analysis read needs approval.")
            return
        if analysis.outcome == "missing_source":
            self._complete_insufficient(run_id, analysis)
            return
        state["pending_tool"] = None
        assert_handoff(AgentHat.REPORT_GENERATION_SPECIALIST, AgentHat.DATA_ANALYSIS_SPECIALIST, state["handoffs"])
        state["handoffs"].append(AgentHat.DATA_ANALYSIS_SPECIALIST)
        state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.RUNNING, run.site_context, AgentHat.REPORT_GENERATION_SPECIALIST, "Report inputs analyzed.")
        assert_handoff(AgentHat.DATA_ANALYSIS_SPECIALIST, AgentHat.REPORT_GENERATION_SPECIALIST, state["handoffs"])
        state["handoffs"].append(AgentHat.REPORT_GENERATION_SPECIALIST)
        report_output = None
        if self.provider:
            analysis_output = self._generate_with_repair(
                run_id,
                AgentHat.DATA_ANALYSIS_SPECIALIST,
                run.site_context,
                state["message"],
                {analysis_tool: {"records": list(analysis.records), "sources": [asdict(s) for s in analysis.sources]}, "site_memory": state["memory"]},
            )
            if analysis_output is None:
                return
            report_output = self._generate_with_repair(
                run_id,
                AgentHat.REPORT_GENERATION_SPECIALIST,
                run.site_context,
                state["message"],
                {report_tool: {"records": list(first.records), "sources": [asdict(s) for s in first.sources]}, analysis_tool: {"records": list(analysis.records), "sources": [asdict(s) for s in analysis.sources]}, "analysis": analysis_output, "site_memory": state["memory"]},
                postprocess=lambda output: {**output, "html": sanitize_html(output["html"])},
            )
            if report_output is None:
                return
            html = sanitize_html(report_output["html"])
            draft = ReportDraft(report_output.get("report_id", f"draft-{uuid4().hex[:8]}"), run.site_context.site_id, run_id, report_output["title"], html, report_output["sections"], self._citation_provenance(first, analysis))
        else:
            draft = ReportDraft(f"draft-{uuid4().hex[:8]}", run.site_context.site_id, run_id, "Site Operations Report",
                                sanitize_html("<article><h1>Site Operations Report</h1><section><h2>Summary</h2><p>Demand increased during the morning peak.</p></section></article>"),
                                [{"id": "summary", "title": "Summary"}, {"id": "analysis", "title": "Energy Analysis"}],
                                self._citation_provenance(first, analysis))
        self.drafts[draft.draft_id] = draft
        state["result"] = {"draft": draft.as_dict(), "handoffSequence": [hat.value for hat in state["handoffs"]], "analysisRecordCount": len(analysis.records), "sourceCount": len(first.sources) + len(analysis.sources)}
        if report_output:
            state["result"]["analysisOutput"] = analysis_output
            state["result"]["specialistOutput"] = report_output
        state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.COMPLETED, run.site_context, AgentHat.REPORT_GENERATION_SPECIALIST, "Draft report generated; review is required.")
        self.audit_events.append(AuditEvent("report.draft_saved", run_id, run.site_context.site_id, run.site_context.user_id, state["session_id"], {"draft_id": draft.draft_id}))

    def _complete_insufficient(self, run_id: str, result: ToolResult) -> None:
        state = self.runs[run_id]
        run: AgentCrewRun = state["run"]
        message = (result.error or {}).get("message", "A required current-site source is unavailable.")
        state["result"] = {
            "kind": "insufficient_data",
            "message": message,
            "records": list(result.records),
            "sources": [asdict(source) for source in result.sources],
            "qualityNotices": [{
                "code": "missing_source",
                "message": message,
                "affectedFields": [result.tool_key],
                "correctiveActions": ["Restore the source and retry the bounded retrieval."],
            }],
            "nextAction": "Restore the unavailable source, then retry this site-scoped request.",
        }
        state["run"] = AgentCrewRun(
            run.run_id,
            AgentRunStatus.COMPLETED,
            run.site_context,
            run.active_hat,
            "Insufficient current-site data; no unsupported result was produced.",
        )
        self.audit_events.append(AuditEvent(
            "data.insufficient",
            run_id,
            run.site_context.site_id,
            run.site_context.user_id,
            state["session_id"],
            {"tool_key": result.tool_key, "retry_count": result.retry_count},
        ))

    def _generate_with_repair(
        self,
        run_id: str,
        hat: AgentHat,
        context: ActiveSiteContext,
        message: str,
        evidence: dict[str, Any],
        postprocess: Callable[[dict[str, Any]], dict[str, Any]] | None = None,
    ) -> dict[str, Any] | None:
        """Bound provider-output repair to one initial attempt plus three repairs."""
        state = self.runs[run_id]
        feedback: str | None = None
        for attempt in range(4):
            try:
                output = self.provider.generate(hat, context, message, evidence, repair_feedback=feedback)
                if postprocess is not None:
                    output = postprocess(output)
                if attempt:
                    self.audit_events.append(AuditEvent(
                        "output.repaired",
                        run_id,
                        context.site_id,
                        context.user_id,
                        state["session_id"],
                        {"hat": hat.value, "repair_count": attempt},
                    ))
                return output
            except Exception as error:
                if not isinstance(error, AgentCrewError):
                    error = AgentCrewError(AgentCrewErrorCode.PROVIDER_OUTPUT_INVALID, str(error))
                if error.code != AgentCrewErrorCode.PROVIDER_OUTPUT_INVALID:
                    raise
                if attempt == 3:
                    state["result"] = {
                        "validationErrors": [redact(error.as_dict())],
                        "partialPreview": None,
                        "repairCount": state["repair_count"],
                    }
                    state["run"] = AgentCrewRun(
                        state["run"].run_id,
                        AgentRunStatus.FAILED_VALIDATION,
                        context,
                        hat,
                        "Validation failed after three repairs; no draft was published.",
                    )
                    self.audit_events.append(AuditEvent(
                        "output.validation_failed",
                        run_id,
                        context.site_id,
                        context.user_id,
                        state["session_id"],
                        {"hat": hat.value, "repair_count": state["repair_count"], "error": redact(error.message)},
                    ))
                    return None
                state["repair_count"] = attempt + 1
                state["run"] = AgentCrewRun(
                    state["run"].run_id,
                    AgentRunStatus.REPAIRING,
                    context,
                    hat,
                    f"Repairing validated output ({state['repair_count']}/3).",
                )
                self.audit_events.append(AuditEvent(
                    "output.repair_requested",
                    run_id,
                    context.site_id,
                    context.user_id,
                    state["session_id"],
                    {"hat": hat.value, "repair_count": state["repair_count"], "error": redact(error.message)},
                ))
                feedback = error.message
        return None

    def approve(self, run_id: str, session_id: str, mode: ApprovalMode) -> dict[str, Any]:
        state = self._owned(run_id, session_id); run: AgentCrewRun = state["run"]
        if run.status != AgentRunStatus.WAITING_FOR_TOOL_APPROVAL:
            return self.snapshot(run_id)
        if run.active_hat == AgentHat.REPORT_GENERATION_SPECIALIST:
            tool = state.get("pending_tool") or self.gateway.workflow_tools[AgentHat.REPORT_GENERATION_SPECIALIST.value]["report"]
        else:
            tool = self.gateway.workflow_tools[run.active_hat.value]["read"]
        if mode == ApprovalMode.APPROVE_ALL_SESSION:
            self.approvals.update((session_id, key) for key in self.gateway.session_allowlist)
        else:
            self.approvals.add((session_id, tool))
        self.audit_events.append(AuditEvent("approval.resolved", run_id, run.site_context.site_id, run.site_context.user_id, session_id, {"mode": mode.value, "tool_key": tool}))
        self.persistence.save_approval(run_id, session_id, run.site_context.site_id, run.site_context.user_id, mode.value, tool)
        state["approval_needed"] = False; self._execute(run_id); self._persist_state(run_id); self._append_completion_message(run_id)
        return self.snapshot(run_id)

    def confirm_report(self, draft_id: str, context: ActiveSiteContext) -> dict[str, Any]:
        """Confirm a site report revision without crossing site ownership."""
        require_site_context(context)
        draft = self.drafts.get(draft_id)
        if draft is not None:
            if draft.site_id != context.site_id:
                raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Report draft belongs to a different site.")
            state = self.runs.get(draft.run_id)
            if state is None or state["run"].site_context.user_id != context.user_id:
                raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Report draft belongs to a different user.")
            if draft.state != "confirmed":
                draft.version += 1
                draft.state = "confirmed"
            report = draft.as_dict()
            if state and state.get("result", {}).get("draft"):
                state["result"]["draft"] = report
        else:
            report = self.persistence.confirm_report(draft_id, context.site_id, context.user_id)
            if report is None:
                raise AgentCrewError(AgentCrewErrorCode.VALIDATION_FAILED, "Report draft was not found for this site.")
        self.audit_events.append(AuditEvent(
            "report.revision_confirmed",
            report["run_id"],
            context.site_id,
            context.user_id,
            self.runs.get(report["run_id"], {}).get("session_id", "report-confirmation"),
            {"draft_id": draft_id, "version": report["version"]},
        ))
        if draft is not None:
            self._persist_state(draft.run_id)
        return report

    def interrupt(self, run_id: str, session_id: str) -> dict[str, Any]:
        state = self._owned(run_id, session_id); run: AgentCrewRun = state["run"]
        if run.status not in {AgentRunStatus.COMPLETED, AgentRunStatus.FAILED, AgentRunStatus.FAILED_VALIDATION}:
            state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.INTERRUPTED, run.site_context, run.active_hat, "Run interrupted; recovery is available.")
            self.audit_events.append(AuditEvent("run.interrupted", run_id, run.site_context.site_id, run.site_context.user_id, session_id, {}))
        return self.snapshot(run_id)

    def recover(self, run_id: str, session_id: str) -> dict[str, Any]:
        state = self._owned(run_id, session_id); run: AgentCrewRun = state["run"]
        if run.status != AgentRunStatus.INTERRUPTED:
            raise AgentCrewError(AgentCrewErrorCode.RUN_INTERRUPTED, "Only interrupted runs can be recovered.")
        self._execute(run_id); self._persist_state(run_id); self._append_completion_message(run_id); return self.snapshot(run_id)

    def snapshot(self, run_id: str, context: ActiveSiteContext | None = None, session_id: str | None = None) -> dict[str, Any]:
        if run_id in self.stream_artifacts:
            artifact = self.stream_artifact(run_id)
            self._require_snapshot_owner(artifact["siteId"], artifact["userId"], artifact["sessionId"], context, session_id)
            return {
                "runId": artifact["runId"],
                "status": artifact["status"],
                "siteContext": {
                    "siteId": artifact["siteId"],
                    "userId": artifact["userId"],
                    "sourceRoute": None,
                },
                "activeHat": artifact["activeHat"],
                "message": "Streamed supervisor run.",
                "result": {"streamEvents": artifact["events"]},
            }
        if run_id not in self.runs:
            durable = self.persistence.load_run(run_id)
            if durable is None:
                raise KeyError(run_id)
            self._require_snapshot_owner(durable["siteId"], durable["userId"], durable["sessionId"], context, session_id)
            return {
                "runId": durable["runId"],
                "status": durable["status"],
                "siteContext": {
                    "siteId": durable["siteId"],
                    "siteName": context.site_name if context else None,
                    "userId": durable["userId"],
                    "sourceRoute": context.source_route if context else None,
                },
                "activeHat": durable["activeHat"],
                "message": "Recovered persisted AgentCrew run.",
                "result": durable["result"],
            }
        state = self.runs[run_id]; run: AgentCrewRun = state["run"]
        self._require_snapshot_owner(run.site_context.site_id, run.site_context.user_id, state["session_id"], context, session_id)
        routing = {"selectedHat": run.active_hat.value if run.active_hat else None, "handoffSequence": [hat.value for hat in state["handoffs"]], "rationale": "Matched the request to a bounded specialist."}
        return public_run(run, routing=routing, result=state["result"])

    @staticmethod
    def _require_snapshot_owner(site_id: str, user_id: str, owner_session_id: str, context: ActiveSiteContext | None, session_id: str | None) -> None:
        if context is None and session_id is None:
            return
        if context is None or session_id is None:
            raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "A site context and session are required to read this run.")
        require_site_context(context)
        if context.site_id != site_id or context.user_id != user_id or session_id != owner_session_id:
            raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Run does not belong to this active site, user, and session.")

    def audit(self, site_id: str, user_id: str) -> list[dict[str, Any]]:
        durable = self.persistence.list_audit(site_id, user_id)
        if durable is not None:
            return durable + [event.as_dict() for event in self.audit_events if event.site_id == site_id and event.user_id == user_id and event.event_id not in self._persisted_audit_ids]
        return [event.as_dict() for event in self.audit_events if event.site_id == site_id and event.user_id == user_id]

    def record_stream_event(self, event, context: ActiveSiteContext, session_id: str, message: str) -> None:
        """Persist the public supervisor envelope without retaining raw provider events."""
        require_site_context(context)
        payload = event.as_dict()
        artifact = self.stream_artifacts.setdefault(event.run_id, {
            "runId": event.run_id,
            "siteId": context.site_id,
            "userId": context.user_id,
            "sessionId": session_id,
            "status": "running",
            "activeHat": None,
            "events": [],
        })
        if artifact["siteId"] != context.site_id or artifact["userId"] != context.user_id or artifact["sessionId"] != session_id:
            raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Stream artifact ownership does not match the active site.")
        if not any(saved["eventId"] == payload["eventId"] for saved in artifact["events"]):
            artifact["events"].append(payload)
        if payload["type"] == "specialist.delegated":
            artifact["activeHat"] = payload["data"].get("hat")
        if payload["type"] == "run.completed":
            artifact["status"] = "completed"
        elif payload["type"] == "run.failed":
            artifact["status"] = "failed"
        audit_event = AuditEvent(
            f"stream.{payload['type']}", event.run_id, context.site_id, context.user_id, session_id,
            {"event_id": payload["eventId"], "sequence": payload["sequence"], "data": payload["data"]},
            sequence=payload["sequence"],
        )
        self.audit_events.append(audit_event)
        self.persistence.save_stream_artifact(artifact, context, message)
        self.persistence.save_audit(audit_event)
        self._persisted_audit_ids.add(audit_event.event_id)

    def stream_artifact(self, run_id: str) -> dict[str, Any]:
        if run_id not in self.stream_artifacts:
            raise AgentCrewError(AgentCrewErrorCode.VALIDATION_FAILED, "Stream artifact not found.")
        artifact = self.stream_artifacts[run_id]
        return {**artifact, "events": list(artifact["events"])}

    def recall(self, session_id: str, context: ActiveSiteContext, query: str = "") -> dict[str, Any]:
        require_site_context(context)
        local = self.memory.recall(session_id, context.site_id, context.user_id, query)
        durable = self.persistence.load_memory_context(session_id, context.site_id, context.user_id)
        if durable:
            known_messages = {item["messageId"] for item in local["messages"]}
            known_memories = {item["memory_id"] for item in local["memories"]}
            local["messages"] = durable["messages"] + [item for item in local["messages"] if item["messageId"] not in {row["messageId"] for row in durable["messages"]}]
            local["memories"] = durable["memories"] + [item for item in local["memories"] if item["memory_id"] not in {row["memory_id"] for row in durable["memories"]}]
            local["preferences"] = durable["preferences"] + [item for item in local["preferences"] if item["preferenceKey"] not in {row["preferenceKey"] for row in durable["preferences"]}]
        return local

    def set_preference(self, context: ActiveSiteContext, key: str, value: Any, source: str = "user") -> dict[str, Any]:
        require_site_context(context)
        preference = self.memory.set_preference(context.site_id, context.user_id, key, value, source)
        self.persistence.save_preference(preference)
        return preference

    def confirm_memory(self, context: ActiveSiteContext, memory_id: str) -> dict[str, Any]:
        require_site_context(context)
        memory = self.memory.confirm_memory(memory_id, context.site_id, context.user_id)
        self.persistence.confirm_memory(memory_id, context.site_id, context.user_id)
        return memory

    def _persist_state(self, run_id: str) -> None:
        state = self.runs.get(run_id)
        if not state:
            return
        try:
            snapshot = self.snapshot(run_id)
            snapshot["sessionId"] = state["session_id"]
            self.persistence.save_run(snapshot, state["run"].site_context, state["message"])
            result = state.get("result") or {}
            if result.get("draft"):
                self.persistence.save_report(result["draft"], state["run"].site_context.user_id)
            self.persistence.save_handoffs(run_id, state["run"].site_context.site_id, state["run"].site_context.user_id, [hat.value for hat in state["handoffs"]])
            self._persist_pending_audits()
        except Exception:
            run: AgentCrewRun = state["run"]
            state["persistence_failed"] = True
            state["result"] = {
                "code": "persistence_unavailable",
                "message": "The run could not be durably saved; no durable success was reported.",
            }
            state["run"] = AgentCrewRun(run.run_id, AgentRunStatus.FAILED, run.site_context, run.active_hat, "Durable persistence failed.")
            self.audit_events.append(AuditEvent(
                "run.persistence_failed", run_id, run.site_context.site_id, run.site_context.user_id, state["session_id"],
                {"code": "persistence_unavailable"},
            ))

    def _persist_mcp_attempt(self, request: ToolRequest, result: ToolResult) -> None:
        self.persistence.save_mcp_attempt(request, result)

    def call_tool(self, request: ToolRequest) -> ToolResult:
        """Route every public MCP read through the selected policy gateway."""
        result = self.gateway.call(request)
        self._persist_pending_audits()
        return result

    def _persist_pending_audits(self) -> None:
        for event in self.audit_events:
            if event.event_id not in self._persisted_audit_ids:
                self.persistence.save_audit(event)
                self._persisted_audit_ids.add(event.event_id)

    @staticmethod
    def _citation_provenance(*results: ToolResult) -> list[dict[str, str]]:
        """Only cite source references returned by the active-site gateway."""
        citations: list[dict[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for result in results:
            for source in result.sources:
                key = (source.tool, source.reference)
                if key not in seen:
                    seen.add(key)
                    citations.append({"tool": source.tool, "reference": source.reference})
        return citations

    def _append_completion_message(self, run_id: str) -> None:
        state = self.runs.get(run_id)
        if not state or state.get("persistence_failed") or state.get("assistant_message_saved") or state.get("result") is None:
            return
        run = state["run"]
        message = self.memory.append_message(state["session_id"], run.site_context.site_id, run.site_context.user_id, "assistant", run.message or "Run completed.", run_id)
        self.persistence.save_message(message, state["session_id"], run.site_context.site_id, run.site_context.user_id, message["content"], run_id)
        state["assistant_message_saved"] = True

    def _owned(self, run_id: str, session_id: str) -> dict[str, Any]:
        if run_id not in self.runs:
            raise AgentCrewError(AgentCrewErrorCode.VALIDATION_FAILED, "Run not found.")
        state = self.runs[run_id]
        if state["session_id"] != session_id:
            raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Run does not belong to this session.")
        return state
