from uuid import uuid4

from fastapi.testclient import TestClient

import agentcrew.app as app_module
from agentcrew.app import app, service
from agentcrew.supervisor import GPTSupervisor


TEST_SCOPE = uuid4().hex[:10]
CONTEXT = {
    "site_id": "site-001",
    "site_name": "Verde North",
    "user_id": f"user-{TEST_SCOPE}",
    "source_route": "site/site-001/overview",
    "session_id": f"session-{TEST_SCOPE}",
}


def setup_function():
    service.runs.clear()
    service.audit_events.clear()
    service.drafts.clear()
    service.approvals.clear()
    service.idempotency.clear()
    service.memory.sessions.clear()
    service.memory.memories.clear()
    service.memory.preferences.clear()


def test_fastapi_health_and_run_contract():
    with TestClient(app) as client:
        assert client.get("/healthz").json()["status"] == "ok"
        response = client.post("/api/v1/agentcrew/runs", json={**CONTEXT, "message": "Show device health"})
        assert response.status_code == 202
        assert response.json()["run"]["status"] == "waiting_for_tool_approval"
        approved = client.post(f"/api/v1/agentcrew/runs/{response.json()['run']['runId']}/approvals", json={"session_id": CONTEXT["session_id"], "mode": "approve_step"})
        assert approved.json()["run"]["status"] == "completed"
        memory = client.post("/api/v1/agentcrew/memory/recall", json={**CONTEXT, "query": "device"}).json()["memory"]
        assert [message["role"] for message in memory["messages"]] == ["user", "assistant"]


def test_report_revision_confirmation_is_idempotent_and_site_scoped():
    with TestClient(app) as client:
        started = client.post("/api/v1/agentcrew/runs", json={**CONTEXT, "message": "Create a site operations report draft"})
        run_id = started.json()["run"]["runId"]
        approved = client.post(f"/api/v1/agentcrew/runs/{run_id}/approvals", json={"session_id": CONTEXT["session_id"], "mode": "approve_step"})
        draft_id = approved.json()["run"]["result"]["draft"]["draft_id"]

        confirmed = client.post(f"/api/v1/agentcrew/reports/{draft_id}/confirm", json=CONTEXT)
        assert confirmed.status_code == 200
        assert confirmed.json()["report"]["state"] == "confirmed"
        assert confirmed.json()["report"]["version"] == 2

        repeated = client.post(f"/api/v1/agentcrew/reports/{draft_id}/confirm", json=CONTEXT)
        assert repeated.json()["report"]["version"] == 2

        crossed_site = client.post(
            f"/api/v1/agentcrew/reports/{draft_id}/confirm",
            json={**CONTEXT, "site_id": "site-002", "source_route": "site/site-002/reports"},
        )
        assert crossed_site.status_code == 409


def test_cors_allows_site_scoped_ems_identity_header():
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/sites/site-001",
            headers={
                "Origin": "http://127.0.0.1:5175",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "x-user-id",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5175"
        assert "x-user-id" in response.headers["access-control-allow-headers"]


def test_fastapi_preserves_idempotency_and_rejects_invalid_site_route():
    with TestClient(app) as client:
        first = client.post("/api/v1/agentcrew/runs", headers={"Idempotency-Key": "same-request"}, json={**CONTEXT, "message": "Show device health"})
        second = client.post("/api/v1/agentcrew/runs", headers={"Idempotency-Key": "same-request"}, json={**CONTEXT, "message": "Show device health"})
        assert first.json()["run"]["runId"] == second.json()["run"]["runId"]
        invalid = client.post("/api/v1/agentcrew/context", json={**CONTEXT, "source_route": "site/site-002/overview"})
        assert invalid.status_code == 400
        assert invalid.json()["detail"]["code"] == "invalid_site_route"


def test_internal_tool_delegates_to_authoritative_service_and_enforces_token():
    payload = {**CONTEXT, "run_id": "run-mcp", "tool_key": "energy_timeseries", "arguments": {"site_id": "site-001"}}
    with TestClient(app) as client:
        unauthorized = client.post("/internal/agentcrew/tools/energy_timeseries", json=payload)
        assert unauthorized.status_code == 401
        response = client.post("/internal/agentcrew/tools/energy_timeseries", headers={"X-EMS-Service-Token": "local-ems-service-token"}, json=payload)
        assert response.status_code == 200
        assert response.json()["result"]["site_id"] == "site-001"


def test_memory_and_preferences_are_site_scoped():
    with TestClient(app) as client:
        preference = client.post("/api/v1/agentcrew/preferences", json={**CONTEXT, "preferenceKey": "response_style", "value": "concise bullets"})
        assert preference.status_code == 200
        client.post("/api/v1/agentcrew/runs", json={**CONTEXT, "message": "Please use concise bullet format"})
        recalled = client.post("/api/v1/agentcrew/memory/recall", json={**CONTEXT, "query": "format"})
        assert recalled.status_code == 200
        assert recalled.json()["memory"]["siteId"] == "site-001"
        assert recalled.json()["memory"]["preferences"][0]["value"] == "concise bullets"
        crossed_site = client.post("/api/v1/agentcrew/memory/recall", json={**CONTEXT, "site_id": "site-002", "source_route": "site/site-002/overview", "session_id": "session-2"})
        assert crossed_site.status_code == 200
        assert crossed_site.json()["memory"]["memories"] == []
        assert crossed_site.json()["memory"]["preferences"] == []


def test_stream_endpoint_exposes_typed_sse_events_and_provider_status(monkeypatch):
    monkeypatch.setattr(app_module, "supervisor", GPTSupervisor(provider=None))
    with TestClient(app) as client:
        status_response = client.get("/api/v1/agentcrew/provider")
        stream_response = client.post("/api/v1/agentcrew/runs/stream", json={**CONTEXT, "message": "Analyze energy trend"})

    assert status_response.json()["provider"] == {"mode": "deterministic-fixtures", "model": None, "status": "ready"}
    assert stream_response.status_code == 200
    assert stream_response.headers["content-type"].startswith("text/event-stream")
    assert "event: run.started" in stream_response.text
    assert "event: specialist.delegated" in stream_response.text
    assert '"type":"run.completed"' in stream_response.text
