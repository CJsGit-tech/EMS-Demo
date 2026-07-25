from fastapi.testclient import TestClient

import agentcrew.app as app_module
from agentcrew.app import app, service
from agentcrew.supervisor import GPTSupervisor


CONTEXT = {
    "site_id": "site-001",
    "site_name": "Verde North",
    "user_id": "demo-user",
    "source_route": "site/site-001/overview",
    "session_id": "stream-persistence-session",
}


def test_streamed_run_persists_all_typed_artifacts_under_the_supervisor_run_id(monkeypatch):
    monkeypatch.setattr(app_module, "supervisor", GPTSupervisor(provider=None))
    service.stream_artifacts.clear()

    with TestClient(app) as client:
        response = client.post("/api/v1/agentcrew/runs/stream", json={**CONTEXT, "message": "Analyze energy trend"})
        streamed_run = client.get(f"/api/v1/agentcrew/runs/{next(iter(service.stream_artifacts))}")

    assert response.status_code == 200
    artifact = service.stream_artifact(next(iter(service.stream_artifacts)))
    assert artifact["siteId"] == "site-001"
    assert artifact["sessionId"] == "stream-persistence-session"
    assert [event["type"] for event in artifact["events"]] == [
        "run.started", "specialist.delegated", "tool.call", "run.completed",
    ]
    assert artifact["status"] == "completed"
    assert streamed_run.status_code == 200
    assert streamed_run.json()["run"]["result"]["streamEvents"] == artifact["events"]
