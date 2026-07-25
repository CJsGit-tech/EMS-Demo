from agentcrew.contracts import ActiveSiteContext, AgentHat, ApprovalMode
from agentcrew.errors import AgentCrewError, AgentCrewErrorCode
from agentcrew.service import AgentCrewService


CONTEXT = ActiveSiteContext("site-001", "Verde North", "user-1", "site/site-001/overview")


class RepairingProvider:
    model = "test-provider"

    def __init__(self, failures: int):
        self.failures = failures
        self.calls = []

    def generate(self, hat, context, message, evidence, *, repair_feedback=None):
        self.calls.append((hat, repair_feedback))
        if len(self.calls) <= self.failures:
            raise AgentCrewError(AgentCrewErrorCode.PROVIDER_OUTPUT_INVALID, "missing required source reference")
        return {
            "site_id": context.site_id,
            "summary": "Validated result",
            "findings": [],
            "recommended_actions": [],
        }


def _approved_result(service, message):
    waiting = service.start(CONTEXT, message, "session-1")
    resolved = service.approve(waiting["runId"], "session-1", ApprovalMode.APPROVE_STEP)
    if resolved["status"] == "waiting_for_tool_approval":
        resolved = service.approve(waiting["runId"], "session-1", ApprovalMode.APPROVE_STEP)
    return resolved


def test_provider_output_repair_is_bounded_and_visible():
    provider = RepairingProvider(failures=2)
    service = AgentCrewService(provider=provider)

    result = _approved_result(service, "Show device health")

    assert result["status"] == "completed"
    assert len(provider.calls) == 3
    assert [event.event_type for event in service.audit_events if event.run_id == result["runId"]].count("output.repair_requested") == 2
    assert any(event.event_type == "output.repaired" for event in service.audit_events)


def test_fourth_invalid_output_fails_without_publishing_a_report():
    provider = RepairingProvider(failures=4)
    service = AgentCrewService(provider=provider)

    result = _approved_result(service, "Create a site operations report draft")

    assert result["status"] == "failed_validation"
    assert result["result"]["repairCount"] == 3
    assert result["result"]["partialPreview"] is None
    assert "draft" not in result["result"]
    assert len(provider.calls) == 4
    assert any(event.event_type == "output.validation_failed" for event in service.audit_events)
