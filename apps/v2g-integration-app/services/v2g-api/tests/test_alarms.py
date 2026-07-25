from datetime import UTC, datetime

from v2g.alarms import AlarmService
from v2g.simulator import SimulatorEvent


def test_disconnected_evse_creates_communications_alarm():
    alarms = AlarmService().raise_or_clear(SimulatorEvent.evse_disconnected("evse-03"))

    assert alarms[0].code == "evse.communication_lost"


def test_reconnected_evse_clears_its_open_communications_alarm():
    service = AlarmService()
    disconnected = SimulatorEvent.evse_disconnected("evse-03")
    service.raise_or_clear(disconnected)

    alarms = service.raise_or_clear(
        SimulatorEvent.status_notification(
            "evse-03", datetime(2026, 7, 25, tzinfo=UTC), status="Available"
        )
    )

    assert [(alarm.code, alarm.state, alarm.cleared_at) for alarm in alarms] == [
        ("evse.communication_lost", "cleared", datetime(2026, 7, 25, tzinfo=UTC))
    ]


def test_repeated_fault_does_not_create_duplicate_open_alarm():
    service = AlarmService()
    disconnected = SimulatorEvent.evse_disconnected("evse-03")

    first = service.raise_or_clear(disconnected)
    repeated = service.raise_or_clear(disconnected)

    assert len(first) == 1
    assert repeated == []
