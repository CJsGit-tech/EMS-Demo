import json
from pathlib import Path

from agentcrew.contracts import ActiveSiteContext, AgentHat
from agentcrew.openai_provider import OpenAIProvider


CONTEXT = ActiveSiteContext("site-001", "Verde North", "user-1", "site/site-001/overview")


class FakeResponses:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return type("Response", (), {"output_text": json.dumps(self.payload)})()


class FakeClient:
    def __init__(self, payload):
        self.responses = FakeResponses(payload)


class FakeStreamingResponses(FakeResponses):
    def create(self, **kwargs):
        self.calls.append(kwargs)
        return iter([
            {"type": "response.output_text.delta", "delta": "Current-site "},
            {"type": "response.completed"},
        ])


class FakeStreamingClient:
    def __init__(self):
        self.responses = FakeStreamingResponses({})


def test_openai_provider_uses_gpt5_mini_strict_schema_and_store_false():
    client = FakeClient({
        "site_id": "site-001",
        "summary": "Perimeter sensors are reporting normally.",
        "findings": [{"severity": "low", "title": "No active security incidents"}],
        "recommended_actions": [],
    })
    provider = OpenAIProvider(client=client, model="gpt-5-mini")
    result = provider.generate(AgentHat.SITE_SECURITY_MANAGER, CONTEXT, "Show security status", {"site_status": {"records": []}})
    call = client.responses.calls[0]
    assert result["site_id"] == "site-001"
    assert call["model"] == "gpt-5-mini"
    assert call["store"] is False
    assert call["text"]["format"]["type"] == "json_schema"
    assert call["text"]["format"]["strict"] is True


def test_openai_provider_compiles_preferences_into_instructions():
    client = FakeClient({
        "site_id": "site-001",
        "summary": "Perimeter sensors are reporting normally.",
        "findings": [{"severity": "low", "title": "No active security incidents"}],
        "recommended_actions": [],
    })
    provider = OpenAIProvider(client=client, model="gpt-5-mini")
    provider.generate(
        AgentHat.SITE_SECURITY_MANAGER,
        CONTEXT,
        "Show security status",
        {
            "site_status": {"records": []},
            "site_memory": {
                "preferences": [
                    {"preferenceKey": "response_style", "value": "concise bullets", "status": "active"},
                ]
            },
        },
    )

    instructions = client.responses.calls[0]["instructions"]
    assert "PRESENTATION PREFERENCES" in instructions
    assert "Use concise bullet points" in instructions


def test_openai_provider_stream_uses_selected_model_and_openai_web_search():
    client = FakeStreamingClient()
    provider = OpenAIProvider(client=client, model="gpt-5-mini")

    events = list(provider.stream(AgentHat.DATA_ANALYSIS_SPECIALIST, CONTEXT, "Analyze current energy trends", {"site_memory": {"preferences": []}}))

    call = client.responses.calls[0]
    assert [event["type"] for event in events] == ["response.output_text.delta", "response.completed"]
    assert call["model"] == "gpt-5-mini"
    assert call["stream"] is True
    assert call["tools"] == [{"type": "web_search"}]
    assert call["include"] == ["web_search_call.action.sources"]
    assert call["store"] is False


def test_all_four_runtime_hats_load_their_checked_in_schemas():
    outputs = {
        AgentHat.SITE_SECURITY_MANAGER: {"site_id": "site-001", "summary": "OK", "findings": [], "recommended_actions": []},
        AgentHat.DEVICE_MONITORING_EXPERT: {"site_id": "site-001", "summary": "OK", "device_findings": [], "recommended_actions": []},
        AgentHat.DATA_ANALYSIS_SPECIALIST: {"site_id": "site-001", "period": {"start": "2026-07-22T00:00:00Z", "end": "2026-07-22T12:00:00Z"}, "summary": "OK", "insights": [], "recommended_actions": [], "sources": [{"tool": "energy_timeseries", "reference": "site-001/energy"}]},
        AgentHat.REPORT_GENERATION_SPECIALIST: {"report_id": "draft-1", "site_id": "site-001", "title": "Report", "generated_at": "2026-07-22T12:00:00Z", "html": "<article><h1>Report</h1><p>OK</p></article>", "sections": [{"id": "summary", "title": "Summary"}], "sources": [{"tool": "site_status", "reference": "site-001/status"}]},
    }
    for hat, output in outputs.items():
        provider = OpenAIProvider(client=FakeClient(output), model="gpt-5-mini")
        assert provider.generate(hat, CONTEXT, "Summarize the current site", {"site_status": {"records": []}})["site_id"] == "site-001"


def test_all_provider_schemas_are_strict_json_schema_compatible():
    for path in (Path(__file__).parents[1] / "skills").glob("*/output.schema.json"):
        schema = json.loads(path.read_text())
        assert schema["type"] == "object"
        assert schema["additionalProperties"] is False
