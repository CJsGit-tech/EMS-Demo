"""Deterministic demo fleet and historian seed data."""

from __future__ import annotations

import math
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from v2g.alarms import AlarmService
from v2g.models import Alarm, ChargingSession, Evse, TelemetryPoint
from v2g.simulator import DEMO_SITE_ID, FleetSimulator, SimulatorEvent


DEMO_SEED_AT = datetime(2026, 7, 25, tzinfo=UTC)
EVSE_IDS = tuple(f"evse-{number:02d}" for number in range(1, 6))
EventPublisher = Callable[[SimulatorEvent], Awaitable[None]]


@dataclass(frozen=True)
class DemoFleet:
    """All stable rows needed to render the simulator's initial state."""

    evses: tuple[Evse, ...]
    sessions: tuple[ChargingSession, ...]
    telemetry_points: tuple[TelemetryPoint, ...]
    alarms: tuple[Alarm, ...]


def build_demo_fleet(at: datetime = DEMO_SEED_AT) -> DemoFleet:
    """Build a repeatable five-EVSE fleet with 30 days of quarter-hour data."""
    if at.tzinfo is None or at.utcoffset() is None:
        raise ValueError("demo seed requires a timezone-aware timestamp")
    at = at.astimezone(UTC)

    evses = tuple(
        Evse(
            asset_id=asset_id,
            site_id=DEMO_SITE_ID,
            display_name=f"Demo EVSE {index:02d}",
            state="unavailable" if asset_id == "evse-03" else "available",
            created_at=at - timedelta(days=30),
        )
        for index, asset_id in enumerate(EVSE_IDS, start=1)
    )
    sessions = (
        ChargingSession(
            session_id="session-01",
            asset_id="evse-01",
            site_id=DEMO_SITE_ID,
            state="active",
            started_at=at - timedelta(hours=3),
            energy_imported_kwh=24.5,
        ),
        ChargingSession(
            session_id="session-02",
            asset_id="evse-02",
            site_id=DEMO_SITE_ID,
            state="active",
            started_at=at - timedelta(hours=2),
            energy_imported_kwh=31.0,
        ),
        ChargingSession(
            session_id="session-04",
            asset_id="evse-04",
            site_id=DEMO_SITE_ID,
            state="active",
            started_at=at - timedelta(hours=1),
            energy_imported_kwh=18.75,
        ),
        ChargingSession(
            session_id="session-05",
            asset_id="evse-05",
            site_id=DEMO_SITE_ID,
            state="unplugged",
            started_at=at - timedelta(hours=4),
            ended_at=at - timedelta(minutes=20),
            energy_imported_kwh=4.25,
        ),
    )
    telemetry_points = tuple(_historical_telemetry(at))

    alarm_service = AlarmService()
    alarms = tuple(
        alarm
        for event in FleetSimulator(seed=0).tick(at)
        for alarm in alarm_service.raise_or_clear(event)
    )
    return DemoFleet(evses, sessions, telemetry_points, alarms)


async def seed_demo_fleet(
    session: AsyncSession,
    *,
    at: datetime = DEMO_SEED_AT,
    simulator: FleetSimulator | None = None,
    publish: EventPublisher | None = None,
) -> DemoFleet:
    """Persist the deterministic demo state, then optionally publish its tick.

    This function owns and commits its short seed transaction before invoking
    the optional publisher.  An independent consumer can therefore read the
    corresponding historian state as soon as it observes an event.  No
    network client is used here.
    """
    if session.in_transaction():
        raise RuntimeError("seed_demo_fleet requires a session without an active transaction")

    fleet = build_demo_fleet(at)
    events = (simulator or FleetSimulator()).tick(at)
    current_telemetry = tuple(
        _telemetry_from_event(event) for event in events if event.kind == "meter_values"
    )
    async with session.begin():
        existing_asset = await session.scalar(
            select(Evse.asset_id).where(Evse.site_id == DEMO_SITE_ID).limit(1)
        )
        if existing_asset is not None:
            return fleet
        session.add_all(
            [
                *fleet.evses,
                *fleet.sessions,
                *fleet.telemetry_points,
                *fleet.alarms,
                *current_telemetry,
            ]
        )

    if publish is not None:
        for event in events:
            await publish(event)
    return fleet


def _historical_telemetry(at: datetime):
    start = at - timedelta(days=30)
    for interval in range(30 * 24 * 4):
        occurred_at = start + timedelta(minutes=15 * interval)
        phase = (interval % 96) / 96 * math.tau
        for index, asset_id in enumerate(EVSE_IDS, start=1):
            power_kw = round(max(0.0, 5.0 + index * 1.1 + math.sin(phase + index) * 2.0), 3)
            yield TelemetryPoint(
                asset_id=asset_id,
                site_id=DEMO_SITE_ID,
                metric="power_kw",
                value=power_kw,
                unit="kW",
                quality="good",
                occurred_at=occurred_at,
                received_at=occurred_at,
            )


def _telemetry_from_event(event: SimulatorEvent) -> TelemetryPoint:
    return TelemetryPoint(
        asset_id=event.asset_id,
        site_id=str(event.payload["site_id"]),
        metric="power_kw",
        value=float(event.payload["power_kw"]),
        unit=str(event.payload["unit"]),
        quality="good",
        occurred_at=event.occurred_at,
        received_at=event.occurred_at,
    )
