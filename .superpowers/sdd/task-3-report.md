# Task 3 — deterministic fleet, telemetry, and alarm simulation report

## Delivered

- Added a deterministic, simulator-only `FleetSimulator`. For a given seed and
  timezone-aware tick timestamp it emits a fixed sequence of OCPP-shaped
  status, transaction, meter, and smart-charging-result events. It has no
  device, socket, MQTT, or external-control path.
- Added `AlarmService`, which turns an EVSE communications loss, rejected
  smart-charging result, or over-temperature meter event into de-duplicated
  in-memory alarm transitions. A healthy status clears a communications alarm.
- Added a deterministic seed for `demo-v2g-site`: five EVSEs, three active
  sessions, one unplugged session, exactly 30 days of 15-minute EVSE telemetry
  (14,400 rows), and two current alarms.
- Added `seed_demo_fleet(session, publish=...)`. It commits all seed state and
  current meter rows before invoking the optional in-process publisher. This
  protects a consumer on a separate database session from observing an event
  whose historian state is not yet readable.

## TDD evidence

1. The first focused run failed at collection because `v2g.seed`,
   `v2g.simulator`, and `v2g.alarms` did not exist.
2. The persistence-ordering regression test then failed as intended: an
   independent reader saw `0` telemetry rows while the publisher was called.
3. The seed now owns a short transaction and publishes only after it exits and
   commits.

## Verification

```text
cd apps/v2g-integration-app/services/v2g-api
.venv/bin/pytest tests/test_simulator.py tests/test_alarms.py -q

7 passed in 2.35s
```

The system `pytest` executable uses an Anaconda interpreter without the
declared `aiosqlite` dependency. The project virtual environment contains the
declared dependencies and was used for the persistence test.

## Scope and concerns

- No models, repository code, migrations, routes, frontend files, Docker, or
  external/device connectivity were changed.
- The schema has no raw simulator-event table. Seeded status and transaction
  state is represented by `Evse` and `ChargingSession`; meter events are
  persisted as `TelemetryPoint`; alarms are persisted as `Alarm`. The optional
  publisher remains deliberately in-process and simulator-only.
