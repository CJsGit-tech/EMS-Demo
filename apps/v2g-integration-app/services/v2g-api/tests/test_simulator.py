import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from v2g.models import Base, Evse, TelemetryPoint
from v2g.seed import DEMO_SITE_ID, build_demo_fleet
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


def test_file_backed_sqlite_hides_uncommitted_row_from_separate_publication_reader(tmp_path):
    async def observe_transaction_isolation() -> tuple[int, int]:
        database_path = tmp_path / "publication-isolation.sqlite"
        engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}", pool_size=2)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)

            async with sessions.begin() as session:
                session.add(
                    Evse(
                        asset_id="evse-isolation",
                        site_id=DEMO_SITE_ID,
                        display_name="Isolation EVSE",
                        state="available",
                        created_at=datetime(2026, 7, 25, tzinfo=UTC),
                    )
                )

            async with sessions() as writer:
                async with writer.begin():
                    writer.add(
                        TelemetryPoint(
                            asset_id="evse-isolation",
                            site_id=DEMO_SITE_ID,
                            metric="power_kw",
                            value=7.2,
                            unit="kW",
                            quality="good",
                            occurred_at=datetime(2026, 7, 25, tzinfo=UTC),
                            received_at=datetime(2026, 7, 25, tzinfo=UTC),
                        )
                    )
                    await writer.flush()
                    async with sessions() as publication_reader:
                        before_commit = await publication_reader.scalar(
                            select(func.count(TelemetryPoint.telemetry_id))
                        )

            async with sessions() as publication_reader:
                after_commit = await publication_reader.scalar(
                    select(func.count(TelemetryPoint.telemetry_id))
                )
            return before_commit, after_commit
        finally:
            await engine.dispose()

    assert asyncio.run(observe_transaction_isolation()) == (0, 1)
