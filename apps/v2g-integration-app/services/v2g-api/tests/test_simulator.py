import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from v2g.models import Alarm, TelemetryPoint
from v2g.repository import V2GRepository
from v2g.seed import DEMO_SITE_ID, build_demo_fleet
from v2g.seed import seed_demo_fleet
from v2g.simulator import FleetSimulator


def test_tick_is_repeatable_for_same_seed():
    at = datetime(2026, 7, 25, tzinfo=UTC)

    left = FleetSimulator(seed=7).tick(at)
    right = FleetSimulator(seed=7).tick(at)

    assert left == right


def test_tick_emits_deterministic_ocpp_shaped_fleet_events():
    events = FleetSimulator(seed=7).tick(datetime(2026, 7, 25, tzinfo=UTC))

    assert {event.kind for event in events} == {
        "status_notification",
        "transaction_event",
        "meter_values",
        "smart_charging_result",
    }
    assert [event.asset_id for event in events if event.kind == "status_notification"] == [
        "evse-01",
        "evse-02",
        "evse-03",
        "evse-04",
        "evse-05",
    ]
    assert next(event for event in events if event.asset_id == "evse-03").payload["status"] == "Unavailable"


def test_demo_seed_has_five_evses_sessions_and_30_days_of_quarter_hour_telemetry():
    at = datetime(2026, 7, 25, tzinfo=UTC)
    fleet = build_demo_fleet(at)

    assert {evse.site_id for evse in fleet.evses} == {DEMO_SITE_ID}
    assert len(fleet.evses) == 5
    assert [session.state for session in fleet.sessions].count("active") == 3
    assert [session.state for session in fleet.sessions].count("unplugged") == 1
    assert len(fleet.telemetry_points) == 5 * 30 * 24 * 4
    assert fleet.telemetry_points[0].occurred_at == at - timedelta(days=30)
    assert fleet.telemetry_points[-1].occurred_at == at - timedelta(minutes=15)
    assert len(fleet.alarms) >= 2


def test_seed_commits_historian_state_before_publishing_events():
    async def seed_and_observe() -> list[str]:
        repository = V2GRepository.in_memory()
        await repository.create_schema()
        published_kinds: list[str] = []

        async def publish(event) -> None:
            async with repository._sessions() as reader:
                assert await reader.scalar(select(func.count(TelemetryPoint.telemetry_id))) == 14403
                assert await reader.scalar(select(func.count(Alarm.alarm_id))) == 2
            published_kinds.append(event.kind)

        try:
            async with repository._sessions() as session:
                await seed_demo_fleet(session, publish=publish)
            return published_kinds
        finally:
            await repository.dispose()

    assert asyncio.run(seed_and_observe()) == [
        "status_notification",
        "status_notification",
        "status_notification",
        "status_notification",
        "status_notification",
        "transaction_event",
        "meter_values",
        "transaction_event",
        "meter_values",
        "transaction_event",
        "meter_values",
        "smart_charging_result",
    ]
