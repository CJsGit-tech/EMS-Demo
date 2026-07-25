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

## Review follow-up

- A successful simulated smart-charging result now clears the open
  `site.smart_charging_rejected` alarm.
- A meter event carrying a temperature below 80°C now clears the matching
  EVSE's open `evse.overtemperature` alarm. Meter events without a temperature
  field do not change this alarm state.
- Replaced the shared-connection in-memory publication test with a file-backed
  SQLite test that uses separate pooled writer and publication-reader sessions:
  the reader sees zero flushed telemetry rows before commit and one afterward.

Focused follow-up verification:

```text
cd apps/v2g-integration-app/services/v2g-api
.venv/bin/pytest tests/test_alarms.py tests/test_simulator.py -q

9 passed
```

## Task 3 test-gap follow-up

- Added a regression test that calls the actual `seed_demo_fleet()` with a
  publish callback.
- The callback reads from a separate file-backed SQLite engine and requires
  every published event to observe all five EVSE rows and the complete seeded
  telemetry set (14,403 rows). Publishing before the seed transaction commits
  therefore fails the test.

Verification:

```text
cd apps/v2g-integration-app/services/v2g-api
.venv/bin/pytest tests/test_simulator.py -q

5 passed in 2.37s
```

## Task 3 — typed operational-workspace API contracts

### Delivered

- Added strict, simulator-labelled Pydantic contracts for fixed-site
  diagnostics, inverter snapshots and trends, alarm lifecycle events,
  work-order reads/transitions, and analytics.
- Added database-backed `WorkspaceReadModel` projections over only the seeded
  simulator rows. Analytics uses the required AC/DC ratio only for a positive
  DC denominator, returns `null` otherwise, and derives event counts from the
  persisted alarm lifecycle.
- Added the fixed-site endpoints under `/api/v1/sites/demo-v2g-site` and the
  local-only `PATCH /api/v1/work-orders/{work_order_id}` contract.
- The PATCH service verifies the row is simulated and delegates every state
  change to Task 2's `transition_work_order_state` boundary. It does not issue
  a direct work-order update or event insert.

### TDD and review evidence

The first focused contract run failed as intended because both routes returned
`404`. After expanding the test fixture to seed the persisted simulator model,
the test failed at import because the workspace dependencies did not exist.
During the first green run, the diagnostics count exposed an implementation
gap: a site-level alarm was excluded from the asset-only sum. The final
projection counts both site and asset alarms while retaining per-asset counts.

### Verification

```text
cd apps/v2g-integration-app/services/v2g-api
.venv/bin/pytest tests/test_workspace_api.py tests/test_api.py tests/test_postgres_audit_integration.py -q

11 passed, 5 skipped, 2 warnings

.venv/bin/pytest tests/test_work_order_security.py tests/test_workspace_seed.py tests/test_repository.py -q

10 passed
```

The five PostgreSQL audit tests skipped because this workspace does not provide
the explicitly required disposable `V2G_TEST_DATABASE_URL` and
`V2G_RUNTIME_TEST_DATABASE_URL`. The portable work-order security suite did
run and covers the constrained state pairs, attribution, and demo-site scope.

### Scope and concerns

- Changed only Task 3 contract/app/workspace/test files and this report; no
  Task 2 migration, repository policy, privilege, or immutable-audit rule was
  modified.
- The FastAPI test client dependency warning is emitted by the installed
  Starlette/httpx combination and is unrelated to the Task 3 contracts.

## Strict contract-validation repair

### Red

Added a focused `InverterResponse` regression that supplies the numeric
`ac_power_kw` field as the JSON-like string `"18.2"` and also checks an
undeclared field. Before the repair, the scalar-coercion assertion failed:

```text
.venv/bin/pytest tests/test_workspace_api.py::test_workspace_contracts_reject_scalar_coercion_and_extra_fields -q

FAILED: DID NOT RAISE ValidationError
```

### Green

`ContractModel` now sets `strict=True` while retaining `extra="forbid"` and
`allow_inf_nan=False`. An explicit `JsonTimestamp` parser preserves the
documented ISO-8601 JSON wire representation for command expiry without
reintroducing numeric/string coercion.

```text
.venv/bin/pytest tests/test_workspace_api.py tests/test_api.py tests/test_postgres_audit_integration.py -q

12 passed, 5 skipped, 2 warnings
```

The five PostgreSQL tests remain configuration-gated because this environment
does not provide the explicitly required disposable database URLs.

## Follow-up verification

- Fixed provider status rendering during synchronous stream callbacks and de-duplicated tool labels between the compact event list and live activity list.
- `npm test -- --run tests/agentcrew-api.test.js tests/agentcrew-drawer.test.jsx`: 23 passed.
- `npm run build`: passed.
