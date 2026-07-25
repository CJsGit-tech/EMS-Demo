"""In-memory alarm state reduction for simulator events."""

from __future__ import annotations

from datetime import datetime

from v2g.models import Alarm
from v2g.simulator import DEMO_SITE_ID, SimulatorEvent


class AlarmService:
    """Raise one open alarm per fault identity and clear it on recovery.

    Persistence is deliberately left to the caller.  This service is a pure
    simulator state reducer and never sends an external notification.
    """

    def __init__(self) -> None:
        self._open: dict[tuple[str | None, str], Alarm] = {}

    def raise_or_clear(self, event: SimulatorEvent) -> list[Alarm]:
        """Return the alarm transition caused by ``event``, if any."""
        site_id = str(event.payload.get("site_id", DEMO_SITE_ID))
        if event.kind == "status_notification":
            status = str(event.payload.get("status", ""))
            reason = str(event.payload.get("reason", ""))
            if status == "Unavailable" and reason.lower() == "communicationlost":
                return self._raise(
                    asset_id=event.asset_id,
                    site_id=site_id,
                    code="evse.communication_lost",
                    severity="major",
                    message=f"EVSE {event.asset_id} stopped communicating.",
                    occurred_at=event.occurred_at,
                )
            if status in {"Available", "Charging", "Preparing"}:
                return self._clear(event.asset_id, "evse.communication_lost", event.occurred_at)

        if event.kind == "smart_charging_result" and event.payload.get("status") == "rejected":
            return self._raise(
                asset_id=None,
                site_id=site_id,
                code="site.smart_charging_rejected",
                severity="warning",
                message="The simulated site load limit rejected a smart-charging request.",
                occurred_at=event.occurred_at,
            )

        if event.kind == "meter_values" and float(event.payload.get("temperature_c", 0)) >= 80:
            return self._raise(
                asset_id=event.asset_id,
                site_id=site_id,
                code="evse.overtemperature",
                severity="critical",
                message=f"EVSE {event.asset_id} reported an over-temperature condition.",
                occurred_at=event.occurred_at,
            )
        return []

    def _raise(
        self,
        *,
        asset_id: str | None,
        site_id: str,
        code: str,
        severity: str,
        message: str,
        occurred_at: datetime,
    ) -> list[Alarm]:
        key = (asset_id, code)
        if key in self._open:
            return []

        alarm = Alarm(
            asset_id=asset_id,
            site_id=site_id,
            code=code,
            severity=severity,
            state="open",
            message=message,
            raised_at=occurred_at,
        )
        self._open[key] = alarm
        return [alarm]

    def _clear(self, asset_id: str | None, code: str, occurred_at: datetime) -> list[Alarm]:
        alarm = self._open.pop((asset_id, code), None)
        if alarm is None:
            return []

        alarm.state = "cleared"
        alarm.cleared_at = occurred_at
        return [alarm]
