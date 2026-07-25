import sys
from pathlib import Path
import json

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from agentcrew.contracts import ActiveSiteContext, AgentRunStatus, ApprovalMode
from agentcrew.errors import AgentCrewError, AgentCrewErrorCode
from agentcrew.mcp import FixtureGateway
from agentcrew.runtime import AuditEvent, ToolRequest
from agentcrew.service import AgentCrewService
from agentcrew.openai_provider import OpenAIProvider


CONTEXT = ActiveSiteContext("site-001", "Verde North", "user-1", "/site/site-001/overview")


def test_report_run_uses_bounded_allowlisted_handoffs_and_persists_draft():
    service = AgentCrewService()
    first = service.start(CONTEXT, "Prepare an energy report", "session-1")
    assert first["status"] == AgentRunStatus.WAITING_FOR_TOOL_APPROVAL.value
    second = service.approve(first["runId"], "session-1", ApprovalMode.APPROVE_ALL_SESSION)
    assert second["status"] == AgentRunStatus.COMPLETED.value
    done = service.approve(first["runId"], "session-1", ApprovalMode.APPROVE_STEP)
    assert done["status"] == AgentRunStatus.COMPLETED.value
    assert done["result"]["draft"]["state"] == "draft"
    assert done["result"]["handoffSequence"] == ["report_generation_specialist", "data_analysis_specialist", "report_generation_specialist"]


def test_report_chain_requires_a_second_step_approval_before_the_analysis_read():
    service = AgentCrewService()

    waiting_for_report = service.start(CONTEXT, "Prepare an energy report", "session-1")
    waiting_for_analysis = service.approve(waiting_for_report["runId"], "session-1", ApprovalMode.APPROVE_STEP)

    assert waiting_for_analysis["status"] == AgentRunStatus.WAITING_FOR_TOOL_APPROVAL.value
    assert waiting_for_analysis["message"] == "An energy analysis read needs approval."
    attempted_tools = [event.payload["tool_key"] for event in service.audit_events if event.event_type == "mcp_tool_attempted"]
    assert attempted_tools == ["report_inputs"]

    completed = service.approve(waiting_for_report["runId"], "session-1", ApprovalMode.APPROVE_STEP)
    assert completed["status"] == AgentRunStatus.COMPLETED.value


class SequencedResponses:
    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        payload = self.payloads.pop(0)
        return type("Response", (), {"output_text": json.dumps(payload)})()


class SequencedClient:
    def __init__(self, payloads):
        self.responses = SequencedResponses(payloads)


def test_report_chain_applies_preference_policy_to_analysis_and_report_calls():
    payloads = [
        {
            "site_id": "site-001",
            "period": {"start": "2026-07-22T00:00:00Z", "end": "2026-07-22T12:00:00Z"},
            "summary": "Load increased during the morning peak.",
            "insights": [],
            "recommended_actions": [],
            "sources": [{"tool": "energy_timeseries", "reference": "site-001/energy"}],
        },
        {
            "report_id": "draft-1",
            "site_id": "site-001",
            "title": "Report",
            "generated_at": "2026-07-22T12:00:00Z",
            "html": "<article><h1>Report</h1><section><h2>Summary</h2><p>OK</p></section></article>",
            "sections": [{"id": "summary", "title": "Summary"}],
            "sources": [{"tool": "report_inputs", "reference": "site-001/report_inputs"}],
        },
    ]
    provider = OpenAIProvider(client=SequencedClient(payloads), model="gpt-5-mini")
    service = AgentCrewService(provider=provider)
    service.set_preference(CONTEXT, "response_style", "concise bullets")

    first = service.start(CONTEXT, "Prepare an energy report", "session-1")
    done = service.approve(first["runId"], "session-1", ApprovalMode.APPROVE_ALL_SESSION)

    assert done["status"] == AgentRunStatus.COMPLETED.value
    instructions = [call["instructions"] for call in provider.client.responses.calls]
    assert len(instructions) == 2
    assert all("PRESENTATION PREFERENCES" in text for text in instructions)
    assert all("Use concise bullet points" in text for text in instructions)


def test_scope_mismatch_is_rejected_before_fixture_access():
    gateway = FixtureGateway(lambda event: None)
    with pytest.raises(AgentCrewError) as error:
        gateway.call(ToolRequest("run-1", "session-1", CONTEXT, "site_status", {"site_id": "site-002"}))
    assert error.value.code == AgentCrewErrorCode.SITE_SCOPE_VIOLATION


def test_tool_request_rejects_a_site_route_that_does_not_match_active_site():
    gateway = FixtureGateway(lambda event: None)
    mismatched = ActiveSiteContext("site-002", "Other Site", "user-1", "/site/site-001/overview")
    with pytest.raises(AgentCrewError) as error:
        gateway.call(ToolRequest("run-1", "session-1", mismatched, "energy_timeseries", {"site_id": "site-002"}))
    assert error.value.code == AgentCrewErrorCode.INVALID_SITE_ROUTE


def test_transient_fixture_retries_twice_and_audits_each_attempt():
    events = []
    gateway = FixtureGateway(events.append)
    gateway.failures["energy_timeseries"] = 3
    result = gateway.call(ToolRequest("run-1", "session-1", CONTEXT, "energy_timeseries", {"site_id": "site-001"}))
    assert result.outcome == "missing_source" and result.retry_count == 2
    assert len([event for event in events if event.event_type == "mcp_tool_attempted"]) == 3


def test_interrupt_is_durable_and_recovery_reuses_run():
    service = AgentCrewService()
    run = service.start(CONTEXT, "Show device health", "session-1")
    interrupted = service.interrupt(run["runId"], "session-1")
    assert interrupted["status"] == "interrupted"
    recovered = service.recover(run["runId"], "session-1")
    assert recovered["runId"] == run["runId"]


def test_audit_is_site_and_user_filtered():
    service = AgentCrewService()
    service.start(CONTEXT, "Show security status", "session-1")
    assert service.audit("site-001", "user-1")
    assert service.audit("site-002", "user-1") == []
    assert service.audit("site-001", "user-2") == []


def test_only_the_draft_owner_can_confirm_a_report_for_the_same_site():
    service = AgentCrewService()
    run = service.start(CONTEXT, "Prepare an energy report", "session-1")
    completed = service.approve(run["runId"], "session-1", ApprovalMode.APPROVE_ALL_SESSION)
    draft_id = completed["result"]["draft"]["draft_id"]
    another_user = ActiveSiteContext("site-001", "Verde North", "user-2", "/site/site-001/reports")

    with pytest.raises(AgentCrewError) as error:
        service.confirm_report(draft_id, another_user)

    assert error.value.code == AgentCrewErrorCode.SITE_SCOPE_VIOLATION


def test_persistence_failure_marks_the_run_failed_and_emits_a_terminal_event():
    class FailingPersistence:
        def __getattr__(self, _name):
            return lambda *_args, **_kwargs: None

        def save_run(self, *_args, **_kwargs):
            raise RuntimeError("database unavailable")

    service = AgentCrewService()
    service.persistence = FailingPersistence()

    run = service.start(CONTEXT, "Show device health", "session-1")

    assert run["status"] == AgentRunStatus.FAILED.value
    assert run["result"]["code"] == "persistence_unavailable"
    assert any(event.event_type == "run.persistence_failed" for event in service.audit_events)
