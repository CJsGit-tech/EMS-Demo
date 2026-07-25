"""Deterministic, simulator-only OCPP-shaped fleet events."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from random import Random
from typing import Any, Literal


DEMO_SITE_ID = "demo-v2g-site"
EventKind = Literal[
    "status_notification", "transaction_event", "meter_values", "smart_charging_result"
]


@dataclass(frozen=True)
class SimulatorEvent:
    """A local simulation event; this type has no network transport behavior."""

    kind: EventKind
    asset_id: str
    occurred_at: datetime
    payload: dict[str, Any]

    @classmethod
    def status_notification(
        cls, asset_id: str, occurred_at: datetime, *, status: str, **payload: Any
    ) -> "SimulatorEvent":
        return cls(
            kind="status_notification",
            asset_id=asset_id,
            occurred_at=occurred_at,
            payload={"site_id": DEMO_SITE_ID, "status": status, **payload},
        )

    @classmethod
    def evse_disconnected(
        cls, asset_id: str, occurred_at: datetime | None = None
    ) -> "SimulatorEvent":
        return cls.status_notification(
            asset_id,
            occurred_at or datetime(2026, 7, 25, tzinfo=UTC),
            status="Unavailable",
            reason="CommunicationLost",
        )


class FleetSimulator:
    """Generate repeatable fleet events for a supplied point in time.

    A tick is pure: it does not retain connection, command, or device state and
    never contacts a real EVSE.  The given seed and timestamp therefore fully
    determine the event list.
    """

    _STATUS_BY_ASSET = (
        ("evse-01", "Charging", None),
        ("evse-02", "Charging", None),
        ("evse-03", "Unavailable", "CommunicationLost"),
        ("evse-04", "Charging", None),
        ("evse-05", "Available", None),
    )
    _ACTIVE_SESSIONS = (
        ("evse-01", "session-01"),
        ("evse-02", "session-02"),
        ("evse-04", "session-04"),
    )

    def __init__(self, seed: int = 0):
        self._seed = seed

    def tick(self, at: datetime) -> list[SimulatorEvent]:
        """Return the same OCPP-shaped event sequence for the same ``seed`` and ``at``."""
        if at.tzinfo is None or at.utcoffset() is None:
            raise ValueError("simulator ticks require a timezone-aware timestamp")

        occurred_at = at.astimezone(UTC)
        random = Random(f"{self._seed}:{occurred_at.isoformat()}")
        events: list[SimulatorEvent] = []

        for asset_id, status, reason in self._STATUS_BY_ASSET:
            payload: dict[str, Any] = {"connector_id": 1}
            if reason:
                payload["reason"] = reason
            events.append(
                SimulatorEvent.status_notification(
                    asset_id, occurred_at, status=status, **payload
                )
            )

        for index, (asset_id, session_id) in enumerate(self._ACTIVE_SESSIONS, start=1):
            power_kw = round(7.2 + index * 1.3 + random.uniform(-0.25, 0.25), 3)
            energy_kwh = round(18.0 + index * 6.5 + random.uniform(0.0, 1.0), 3)
            events.append(
                SimulatorEvent(
                    kind="transaction_event",
                    asset_id=asset_id,
                    occurred_at=occurred_at,
                    payload={
                        "site_id": DEMO_SITE_ID,
                        "event_type": "Updated",
                        "transaction_id": session_id,
                        "charging_state": "Charging",
                    },
                )
            )
            events.append(
                SimulatorEvent(
                    kind="meter_values",
                    asset_id=asset_id,
                    occurred_at=occurred_at,
                    payload={
                        "site_id": DEMO_SITE_ID,
                        "measurand": "Power.Active.Import",
                        "unit": "kW",
                        "power_kw": power_kw,
                        "energy_kwh": energy_kwh,
                    },
                )
            )

        events.append(
            SimulatorEvent(
                kind="smart_charging_result",
                asset_id=DEMO_SITE_ID,
                occurred_at=occurred_at,
                payload={
                    "site_id": DEMO_SITE_ID,
                    "status": "rejected",
                    "reason": "site_load_limit",
                    "requested_kw": 42.0,
                    "accepted_kw": 0.0,
                },
            )
        )
        return events
