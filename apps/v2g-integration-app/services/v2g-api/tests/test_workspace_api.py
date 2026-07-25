import asyncio
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from v2g.app import app, get_work_order_service, get_workspace_read_model
from v2g.contracts import InverterResponse
from v2g.repository import V2GRepository
from v2g.seed import seed_demo_fleet
from v2g.workspace import WorkOrderService, WorkspaceReadModel


START = datetime(2026, 7, 24, tzinfo=UTC).isoformat()
END = datetime(2026, 7, 26, tzinfo=UTC).isoformat()


def test_workspace_contracts_reject_scalar_coercion_and_extra_fields():
    payload = {
        "asset_id": "inv-01",
        "ac_power_kw": 18.2,
        "dc_power_kw": 19.1,
        "temperature_c": 42.0,
        "efficiency_percent": 95.3,
        "communication_state": "good",
        "alarm_count": 0,
        "observed_at": datetime(2026, 7, 25, tzinfo=UTC),
    }

    with pytest.raises(ValidationError):
        InverterResponse.model_validate({**payload, "ac_power_kw": "18.2"})
    with pytest.raises(ValidationError):
        InverterResponse.model_validate({**payload, "undeclared": True})


@pytest.fixture
def repository():
    value = V2GRepository.in_memory()
    asyncio.run(value.create_schema())

    async def seed() -> None:
        async with value._sessions() as session:
            await seed_demo_fleet(session)

    asyncio.run(seed())
    try:
        yield value
    finally:
        asyncio.run(value.dispose())


@pytest.fixture
def client(repository):
    app.dependency_overrides = {
        get_workspace_read_model: lambda: WorkspaceReadModel(repository._sessions),
        get_work_order_service: lambda: WorkOrderService(repository),
    }
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_analytics_returns_simulated_efficiency_string_and_event_aggregates(client):
    response = client.get(
        "/api/v1/sites/demo-v2g-site/analytics",
        params={"from": START, "to": END},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["simulated"] is True
    assert {"site_efficiency", "inverters", "strings", "events"} <= body.keys()
    assert body["site_efficiency"] == pytest.approx(84.3 / 89.2 * 100)
    assert len(body["inverters"]) == 5
    assert len(body["strings"]) == 40
    assert body["events"]["total"] == 2


def test_diagnostics_and_inverters_are_fixed_site_simulated_contracts(client):
    diagnostics = client.get("/api/v1/sites/demo-v2g-site/diagnostics")
    inverters = client.get("/api/v1/sites/demo-v2g-site/inverters")
    other_site = client.get("/api/v1/sites/other-site/diagnostics")

    assert diagnostics.status_code == 200
    assert diagnostics.json()["simulated"] is True
    assert len(diagnostics.json()["assets"]) == 5
    assert diagnostics.json()["open_alarm_count"] == 2
    assert inverters.status_code == 200
    assert inverters.json()["simulated"] is True
    assert {"asset_id", "ac_power_kw", "dc_power_kw", "temperature_c", "efficiency_percent"} <= inverters.json()["inverters"][0].keys()
    assert other_site.status_code == 404


def test_inverter_trend_and_event_lifecycle_are_allowlisted(client):
    trend = client.get(
        "/api/v1/sites/demo-v2g-site/inverters/inv-01/trend",
        params={"from": START, "to": END, "metric": "ac_power_kw"},
    )
    events = client.get("/api/v1/sites/demo-v2g-site/events")
    invalid_metric = client.get(
        "/api/v1/sites/demo-v2g-site/inverters/inv-01/trend",
        params={"from": START, "to": END, "metric": "arbitrary_metric"},
    )

    assert trend.status_code == 200
    assert trend.json()["simulated"] is True
    assert trend.json()["asset_id"] == "inv-01"
    assert trend.json()["points"] == [{"observed_at": "2026-07-25T00:00:00Z", "value": 18.2}]
    assert events.status_code == 200
    assert events.json()["simulated"] is True
    assert len(events.json()["events"]) == 2
    assert {event["state"] for event in events.json()["events"]} == {"open"}
    assert invalid_metric.status_code == 422


def test_work_orders_are_simulated_and_transition_requires_actor_reason_and_audits(client, repository):
    listing = client.get("/api/v1/sites/demo-v2g-site/work-orders")
    response = client.patch("/api/v1/work-orders/wo-001", json={"state": "in_progress"})
    transitioned = client.patch(
        "/api/v1/work-orders/wo-001",
        json={"state": "in_progress", "actor": "operator-17", "reason": "現場確認後開始檢修"},
    )

    async def state_events():
        async with repository._sessions() as session:
            from sqlalchemy import select
            from v2g.models import WorkOrderEvent

            return list(
                await session.scalars(
                    select(WorkOrderEvent)
                    .where(WorkOrderEvent.work_order_id == "wo-001")
                    .order_by(WorkOrderEvent.work_order_event_id)
                )
            )

    assert listing.status_code == 200
    assert listing.json()["simulated"] is True
    assert [item["state"] for item in listing.json()["work_orders"]] == ["open", "in_progress", "completed"]
    assert response.status_code == 422
    assert transitioned.status_code == 200
    assert transitioned.json()["state"] == "in_progress"
    assert transitioned.json()["simulated"] is True
    events = asyncio.run(state_events())
    assert events[-1].actor == "operator-17"
    assert events[-1].reason == "現場確認後開始檢修"
    assert events[-1].payload["source"] == "simulated-runtime"
