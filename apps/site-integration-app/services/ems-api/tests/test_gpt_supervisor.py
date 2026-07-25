import json

import pytest

from agentcrew.contracts import ActiveSiteContext
from agentcrew.errors import AgentCrewError, AgentCrewErrorCode
from agentcrew.supervisor import GPTSupervisor, SupervisorEventType


CONTEXT = ActiveSiteContext("site-001", "Verde North", "user-1", "site/site-001/overview")


class FakeProvider:
    model = "gpt-5-mini"

    def stream(self, hat, context, user_message, evidence):
        assert hat.value == "data_analysis_specialist"
        assert evidence["site_memory"]["preferences"][0]["value"] == "concise bullets"
        yield {"type": "response.output_text.delta", "delta": "Load "}
        yield {"type": "response.output_item.added", "item": {"type": "web_search_call", "id": "ws-1"}}
        yield {"type": "response.output_item.done", "item": {"type": "web_search_call", "id": "ws-1", "action": {"type": "search", "query": "grid forecast", "sources": [{"url": "https://example.test/forecast"}]}}}
        yield {"type": "response.function_call_arguments.done", "name": "query_energy_timeseries", "arguments": '{"site_id":"site-001"}'}
        yield {"type": "response.completed"}


class FailingProvider:
    model = "gpt-5-mini"

    def stream(self, *args, **kwargs):
        raise AgentCrewError(AgentCrewErrorCode.PROVIDER_UNAVAILABLE, "provider offline")
        yield  # pragma: no cover


def test_supervisor_orders_delegation_deltas_tools_web_search_and_terminal_event():
    supervisor = GPTSupervisor(
        provider=FakeProvider(),
        recall=lambda: {"preferences": [{"preferenceKey": "response_style", "value": "concise bullets", "status": "active"}]},
    )

    events = list(supervisor.stream(CONTEXT, "Analyze energy trend", "session-1"))

    assert [event.type for event in events] == [
        SupervisorEventType.RUN_STARTED,
        SupervisorEventType.SPECIALIST_DELEGATED,
        SupervisorEventType.ASSISTANT_DELTA,
        SupervisorEventType.WEB_SEARCH_STARTED,
        SupervisorEventType.WEB_SEARCH_COMPLETED,
        SupervisorEventType.TOOL_CALL,
        SupervisorEventType.RUN_COMPLETED,
    ]
    assert [event.sequence for event in events] == list(range(1, 8))
    assert events[2].data == {"delta": "Load "}
    assert events[4].data["sources"] == [{"url": "https://example.test/forecast"}]
    assert events[5].data["arguments"] == {"site_id": "site-001"}
    assert all(event.run_id == events[0].run_id for event in events)


def test_supervisor_emits_a_terminal_safe_provider_error():
    events = list(GPTSupervisor(provider=FailingProvider()).stream(CONTEXT, "Analyze energy trend", "session-1"))

    assert events[-1].type == SupervisorEventType.RUN_FAILED
    assert events[-1].data == {"code": "provider_unavailable", "message": "The configured OpenAI provider is unavailable."}


def test_supervisor_deterministic_mode_remains_explicitly_labelled():
    events = list(GPTSupervisor(provider=None).stream(CONTEXT, "Analyze energy trend", "session-1"))

    assert events[0].data["provider"] == {"mode": "deterministic-fixtures", "model": None}
    assert events[-1].type == SupervisorEventType.RUN_COMPLETED
    assert events[-1].data["provider"] == {"mode": "deterministic-fixtures", "model": None}


def test_sse_envelope_is_json_data_with_the_typed_event_name():
    event = next(iter(GPTSupervisor(provider=None).stream(CONTEXT, "Analyze energy trend", "session-1")))

    encoded = event.as_sse()
    assert encoded.startswith("event: run.started\ndata: ")
    assert json.loads(encoded.split("data: ", 1)[1]) == event.as_dict()
