import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from v2g.app import (
    app,
    get_command_service,
    get_event_journal,
    get_read_model,
)
from v2g.commands import CommandService, InMemoryCommandRepository
from v2g.contracts import DemoReadModel
from v2g.stream import EventJournal


NOW = datetime(2026, 7, 25, 12, 0, tzinfo=UTC)


@pytest.fixture
def client():
    read_model = DemoReadModel()
    commands = CommandService(
        read_model.site_state,
        repository=InMemoryCommandRepository(),
        now=lambda: NOW,
    )
    journal = EventJournal(capacity=8)
    app.dependency_overrides = {
        get_read_model: lambda: read_model,
        get_command_service: lambda: commands,
        get_event_journal: lambda: journal,
    }
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_overview_has_data_quality_and_flexible_capacity(client):
    response = client.get("/api/v1/sites/demo-v2g-site/overview")

    assert response.status_code == 200
    body = response.json()
    assert {"site_power_kw", "available_flexible_kw", "data_freshness"} <= body.keys()
    assert body["data_freshness"].keys() == {"observed_at", "quality"}


def test_read_only_site_endpoints_return_allowlisted_simulator_data(client):
    fleet = client.get("/api/v1/sites/demo-v2g-site/fleet")
    alarms = client.get("/api/v1/sites/demo-v2g-site/alarms")
    recommendations = client.get("/api/v1/sites/demo-v2g-site/recommendations")
    historian = client.get(
        "/api/v1/sites/demo-v2g-site/historian",
        params={
            "from": "2026-07-24T00:00:00Z",
            "to": "2026-07-25T00:00:00Z",
            "metric": "power_kw",
        },
    )

    assert fleet.status_code == 200
    assert set(fleet.json()["evses"][0]) == {"asset_id", "display_name", "state"}
    assert alarms.status_code == 200
    assert {"code", "severity", "state", "message", "raised_at"} <= alarms.json()["alarms"][0].keys()
    assert recommendations.status_code == 200
    assert recommendations.json()["recommendations"][0]["status"] == "proposed"
    assert historian.status_code == 200
    assert historian.json()["metric"] == "power_kw"
    assert historian.json()["points"]


def test_historian_rejects_unknown_metrics_and_invalid_time_ranges(client):
    unknown_metric = client.get(
        "/api/v1/sites/demo-v2g-site/historian",
        params={
            "from": "2026-07-24T00:00:00Z",
            "to": "2026-07-25T00:00:00Z",
            "metric": "database_url",
        },
    )
    reversed_range = client.get(
        "/api/v1/sites/demo-v2g-site/historian",
        params={
            "from": "2026-07-25T00:00:00Z",
            "to": "2026-07-24T00:00:00Z",
            "metric": "power_kw",
        },
    )

    assert unknown_metric.status_code == 422
    assert reversed_range.status_code == 422


def test_command_create_is_idempotent_and_approval_requires_named_reason(client):
    expires_at = (NOW + timedelta(minutes=10)).isoformat()
    idempotency_key = "idem-001"
    payload = {
        "site_id": "demo-v2g-site",
        "power_kw": 10.0,
        "projected_soc_percent": 70.0,
        "expires_at": expires_at,
        "correlation_id": "corr-001",
        "idempotency_key": idempotency_key,
    }

    created = client.post("/api/v1/commands", json=payload)
    retried = client.post("/api/v1/commands", json=payload)

    assert created.status_code == 201
    assert retried.status_code == 200
    assert created.json()["command_id"] == retried.json()["command_id"]
    assert created.json()["state"] == "awaiting_approval"

    command_id = created.json()["command_id"]
    missing_identity = client.post(f"/api/v1/commands/{command_id}/approve", json={})
    blank_identity = client.post(
        f"/api/v1/commands/{command_id}/approve",
        json={"actor": "   ", "reason": "   "},
    )
    approved = client.post(
        f"/api/v1/commands/{command_id}/approve",
        json={"actor": "operator-01", "reason": "operator reviewed site constraints"},
    )

    assert missing_identity.status_code == 422
    assert blank_identity.status_code == 422
    assert approved.status_code == 200
    assert approved.json()["state"] == "approved"
    assert approved.json()["approved_by"] == "operator-01"


def test_rejection_requires_named_actor_and_reason(client):
    missing_fields = client.post("/api/v1/commands/not-a-command/reject", json={})
    missing_command = client.post(
        "/api/v1/commands/not-a-command/reject",
        json={"actor": "operator-01", "reason": "operator review"},
    )

    assert missing_fields.status_code == 422
    assert missing_command.status_code == 404
    assert missing_command.json()["code"] == "command_not_found"


def test_approval_reason_is_retained_in_the_normalized_event_stream(client):
    created = client.post(
        "/api/v1/commands",
        json={
            "site_id": "demo-v2g-site",
            "power_kw": 10.0,
            "projected_soc_percent": 70.0,
            "expires_at": (NOW + timedelta(minutes=10)).isoformat(),
            "correlation_id": "corr-approval-001",
            "idempotency_key": "idem-approval-001",
        },
    )
    command_id = created.json()["command_id"]
    approved = client.post(
        f"/api/v1/commands/{command_id}/approve",
        json={"actor": "operator-01", "reason": "capacity checked"},
    )

    assert approved.status_code == 200
    stream = client.get("/api/v1/events", params={"last_event_id": 1})
    envelope = json.loads(stream.text.strip().splitlines()[2].removeprefix("data: "))

    assert envelope["type"] == "command.approved"
    assert envelope["payload"]["actor"] == "operator-01"
    assert envelope["payload"]["reason"] == "capacity checked"


def test_event_stream_replays_normalized_command_events_after_last_event_id(client):
    expires_at = (NOW + timedelta(minutes=10)).isoformat()
    created = client.post(
        "/api/v1/commands",
        json={
            "site_id": "demo-v2g-site",
            "power_kw": 10.0,
            "projected_soc_percent": 70.0,
            "expires_at": expires_at,
            "correlation_id": "corr-stream-001",
            "idempotency_key": "idem-stream-001",
        },
    )
    assert created.status_code == 201

    stream = client.get("/api/v1/events", params={"last_event_id": 0})

    assert stream.status_code == 200
    assert stream.headers["content-type"].startswith("text/event-stream")
    messages = [chunk for chunk in stream.text.strip().split("\n\n") if chunk]
    assert messages
    last_message = messages[-1].splitlines()
    assert last_message[0].startswith("id: ")
    assert last_message[1].startswith("event: command.awaiting_approval")
    envelope = json.loads(last_message[2].removeprefix("data: "))
    assert set(envelope) == {"type", "occurred_at", "correlation_id", "payload"}
    assert envelope["type"] == "command.awaiting_approval"
    assert "idempotency_key" not in envelope["payload"]

    last_event_id = int(last_message[0].removeprefix("id: "))
    replay = client.get("/api/v1/events", params={"last_event_id": last_event_id})
    invalid_cursor = client.get("/api/v1/events", params={"last_event_id": -1})

    assert replay.status_code == 200
    assert replay.text == ""
    assert invalid_cursor.status_code == 422
