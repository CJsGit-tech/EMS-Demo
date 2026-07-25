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


def test_accepted_smart_charging_clears_its_rejection_alarm():
    service = AlarmService()
    rejected_at = datetime(2026, 7, 25, tzinfo=UTC)
    service.raise_or_clear(
        SimulatorEvent(
            kind="smart_charging_result",
            asset_id="demo-v2g-site",
            occurred_at=rejected_at,
            payload={"site_id": "demo-v2g-site", "status": "rejected"},
        )
    )

    accepted_at = datetime(2026, 7, 25, 0, 15, tzinfo=UTC)
    alarms = service.raise_or_clear(
        SimulatorEvent(
            kind="smart_charging_result",
            asset_id="demo-v2g-site",
            occurred_at=accepted_at,
            payload={"site_id": "demo-v2g-site", "status": "accepted"},
        )
    )

    assert [(alarm.code, alarm.state, alarm.cleared_at) for alarm in alarms] == [
        ("site.smart_charging_rejected", "cleared", accepted_at)
    ]


def test_normal_temperature_clears_its_open_overtemperature_alarm():
    service = AlarmService()
    overtemperature_at = datetime(2026, 7, 25, tzinfo=UTC)
    service.raise_or_clear(
        SimulatorEvent(
            kind="meter_values",
            asset_id="evse-02",
            occurred_at=overtemperature_at,
            payload={"site_id": "demo-v2g-site", "temperature_c": 80},
        )
    )

    normal_at = datetime(2026, 7, 25, 0, 15, tzinfo=UTC)
    alarms = service.raise_or_clear(
        SimulatorEvent(
            kind="meter_values",
            asset_id="evse-02",
            occurred_at=normal_at,
            payload={"site_id": "demo-v2g-site", "temperature_c": 79.9},
        )
    )

    assert [(alarm.code, alarm.state, alarm.cleared_at) for alarm in alarms] == [
        ("evse.overtemperature", "cleared", normal_at)
    ]
