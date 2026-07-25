# Task 2 — V2G historian and append-only command audit schema

## Scope and constraints

Implemented only the V2G API persistence surface under
`apps/v2g-integration-app/services/v2g-api/` plus this report. No frontend or
other application files were changed. The schema and repository remain scoped
to the simulator-only V2G application; the repository is the API persistence
writer boundary.

## Required role prompts consulted

Confirmed consulted before implementation:

- `apps/v2g-integration-app/agency/agents/database-optimizer.toml`
- `apps/v2g-integration-app/agency/agents/data-engineer.toml`

The database-optimizer guidance informed the compound-index and foreign-key
index coverage. The data-engineer guidance informed the append-only,
timestamped historian design and explicit schema contract.

## Delivered

- Alembic foundation migration: `0001_v2g_scada_foundation` creates `evses`,
  `telemetry_points`, `charging_sessions`, `alarms`,
  `dispatch_recommendations`, `simulated_commands`, and `audit_records`.
- SQLAlchemy models for all seven required entities, using PostgreSQL JSONB
  (with a portable JSON variant for local SQLite validation).
- Historian indexes on `(asset_id, occurred_at)` and `(site_id, occurred_at)`;
  alarm `(state, severity)`; command `(state, expires_at)`; and compound
  indexes covering every EVSE foreign-key access path.
- `audit_records` enforces `UNIQUE (command_id, sequence)` and indexes
  `command_id` for ordered stream reads.
- PostgreSQL migration installs an `UPDATE`/`DELETE`-rejecting trigger, making
  persisted audit rows append-only at the database boundary.
- `V2GRepository.append_audit(command_id, event_type, payload)` calculates the
  next per-command sequence inside its transaction. PostgreSQL transactions
  take a transaction-scoped advisory lock on the command stream before
  allocating the sequence; the uniqueness constraint remains the integrity
  backstop.
- `V2GRepository.audit_events(command_id)` retrieves the immutable stream in
  sequence order. No update or delete repository methods are exposed.

## TDD evidence

1. Added the audit API test first; it failed as expected with
   `ModuleNotFoundError: No module named 'v2g.repository'`.
2. Added the schema-index test before the models; it failed as expected because
   `v2g.models` did not exist.
3. Added the missing dispatch foreign-key index expectation; it failed as
   expected before that index was implemented.
4. Implemented the minimal schema/repository/migration code and re-ran the
   focused tests successfully.

## Validation

Executed from `apps/v2g-integration-app/services/v2g-api`:

```text
alembic upgrade head
alembic downgrade base
alembic upgrade head
pytest -q
```

Result: migration upgrade/downgrade/upgrade completed successfully from a
fresh local SQLite validation database, and all 3 tests passed. The generated
local validation database was removed afterward.

## Notes / concerns

- The append-only trigger is PostgreSQL-specific by design; SQLite is used only
  as a portable migration/test harness. Production deployment should point
  `DATABASE_URL` at PostgreSQL so JSONB and the immutability trigger are active.
- This is the initial migration, so its indexes are created alongside new
  tables. Future indexes on populated production tables should use a separate,
  non-transactional `CREATE INDEX CONCURRENTLY` migration.

## Operational workspace extension (2026-07-25)

### Delivered

- Added `0002_v2g_operational_workspace` with `InverterReading`,
  `StringReading`, `WorkOrder`, and `WorkOrderEvent`, including matching
  foreign keys, query indexes, PostgreSQL append-only triggers, and immutable
  event-table grants.
- Seeded five deterministic inverter rows, eight arithmetic deviations from
  each inverter median (40 simulated string readings total), three ordered
  work orders, and one simulated event per seeded work order.
- Added `list_work_orders(site_id)` and `append_work_order_event(...)`, plus
  seed-count helpers required by the workspace contract.

### TDD evidence

RED seed contract:

```text
.venv/bin/pytest tests/test_workspace_seed.py -q
F                                                                        [100%]
AttributeError: 'V2GRepository' object has no attribute 'count_inverter_readings'
1 failed in 2.45s
```

GREEN seed contract:

```text
.venv/bin/pytest tests/test_workspace_seed.py -q
.                                                                        [100%]
1 passed in 2.36s
```

RED work-order event boundary:

```text
.venv/bin/pytest tests/test_workspace_seed.py -q
.F                                                                       [100%]
AttributeError: 'V2GRepository' object has no attribute 'append_work_order_event'
1 failed, 1 passed in 4.53s
```

GREEN seeded and appended events:

```text
.venv/bin/pytest tests/test_workspace_seed.py -q
..                                                                       [100%]
2 passed in 4.55s
```

Initial focused verification:

```text
.venv/bin/pytest tests/test_workspace_seed.py tests/test_repository.py -q
.....                                                                    [100%]
5 passed in 4.42s
```

The migration environment test passed in 0.23s. PostgreSQL offline SQL
included both work-order event append-only triggers and:

```text
REVOKE ALL ON TABLE audit_records, work_order_events FROM v2g_runtime;
GRANT SELECT, INSERT ON TABLE audit_records, work_order_events TO v2g_runtime;
```

### Bootstrap privilege-boundary repair

The bootstrap's broad table grant initially narrowed only `audit_records`, so
it could have re-granted `UPDATE` and `DELETE` on `work_order_events` after
migration. The repair now revokes all rights on both immutable event tables,
retains an explicit `UPDATE, DELETE, TRUNCATE` revoke, and grants only
`SELECT, INSERT` to `v2g_runtime`.

RED focused grant contract:

```text
.venv/bin/pytest tests/test_task7_infrastructure_security.py -q
.F.                                                                      [100%]
AssertionError: 'REVOKE ALL ON TABLE audit_records, work_order_events FROM v2g_runtime' not found in bootstrap
1 failed, 2 passed in 0.02s
```

GREEN focused grant contract:

```text
.venv/bin/pytest tests/test_task7_infrastructure_security.py -q
...                                                                      [100%]
3 passed in 0.00s
```

Final repair verification:

```text
.venv/bin/pytest tests/test_workspace_seed.py tests/test_repository.py tests/test_task7_infrastructure_security.py -q
........                                                                 [100%]
8 passed in 4.37s
```

`git diff --check` passed for the repair scope. No unresolved Task 2 privilege
boundary concern remains; live PostgreSQL trigger execution still requires a
PostgreSQL integration environment.

## Security-review repair (2026-07-25)

### Controlled state-transition boundary

- `V2GRepository.transition_work_order_state(work_order_id, site_id, state,
  actor, reason)` is the only repository state-transition operation. It rejects
  blank actor/reason, locks and verifies the expected site in the portable
  implementation, accepts only `open → in_progress → completed`, and appends
  the state event in the same transaction as the state update.
- PostgreSQL enforces the same boundary with the owner-defined,
  `SECURITY DEFINER` `transition_work_order_state(...)` function. The runtime
  role has `SELECT` on `work_orders` and `EXECUTE` on this function, but no
  direct `UPDATE`, `DELETE`, or `INSERT` rights on `work_orders`. This remains
  usable by a future Task 3 service without granting it a repository-policy
  bypass.
- `WorkOrderEvent` now records `actor` and `reason`; a database check and
  `append_work_order_event(...)` both reject a `work_order.state_changed` event
  without non-empty attribution. The deterministic seeded non-open events now
  include credible simulator actor/reason values and a `simulated` source
  marker. Seeded work orders also have `source="simulated"`.

### Site consistency and defaults

- `StringReading` has a composite foreign key to `(inverter_id, site_id)` and
  `WorkOrder` has a composite foreign key to `(asset_id, site_id)`. The parent
  tables have matching unique constraints, preventing cross-site rows even if
  a caller bypasses the repository.
- Model server defaults now match the migration for operational source fields,
  work-order state, and work-order event timestamps.

### TDD and validation evidence

Focused security tests were written before the implementation and initially
failed as expected:

```text
.venv/bin/pytest tests/test_work_order_security.py -q
FFF                                                                      [100%]
AttributeError: 'V2GRepository' object has no attribute 'transition_work_order_state'
Failed: DID NOT RAISE <class 'sqlalchemy.exc.IntegrityError'>
3 failed in 6.60s
```

After implementing the repository and composite constraints, the portable
security/Task 2 suite passed:

```text
.venv/bin/pytest tests/test_migrations_env.py tests/test_workspace_seed.py tests/test_work_order_security.py tests/test_repository.py tests/test_task7_infrastructure_security.py -q
............                                                             [100%]
12 passed in 11.07s
```

The PostgreSQL integration suite documents explicit skip requirements for
`V2G_TEST_DATABASE_URL` and `V2G_RUNTIME_TEST_DATABASE_URL`, both restricted
to local `v2g_test`. With no URLs it skipped explicitly. The healthy local
Docker stack was then used to create only the disposable `v2g_test` database
and run the suite inside the Compose network:

```text
docker compose run ... api pytest tests/test_postgres_audit_integration.py -q
....                                                                     [100%]
4 passed in 2.51s
```

That live suite proves the audit and work-order event append-only triggers,
the runtime role's lack of `UPDATE` on `work_orders` and `work_order_events`,
its permitted `SELECT`/event `INSERT`/function `EXECUTE` rights, and a
successful controlled runtime transition. An initial live failure exposed the
missing migration `USAGE` grant on `public`; adding that grant made the
security-definer function resolvable by `v2g_runtime`.

## Re-review repair: fixed simulator scope and exact transitions (2026-07-25)

The stable Task 2 artifact was re-read from
`.superpowers/sdd/v2g-zh-task-2-brief.md`; the generic brief path was not used.

### Boundary changes

- The only permitted state pairs are now exactly `open → in_progress`,
  `in_progress → completed`, and `in_progress → open`. The repository map and
  the PostgreSQL security-definer function use the same predicate; every other
  pair, including all completed-work-order transitions, is rejected.
- Both repository transitions and PostgreSQL transitions reject any site other
  than `demo-v2g-site`, even when the work-order record genuinely exists at
  another site.
- Generic event append is demo-scoped. On PostgreSQL it uses the new
  `append_demo_work_order_event(...)` security-definer function. Runtime direct
  `work_order_events` insertion is blocked by a trigger even if another
  bootstrap step later grants table `INSERT`; state events must use the
  transition function.
- Runtime transition payloads now use `source: simulated-runtime`.

### TDD and verification evidence

New portable tests were added before this repair and failed as expected:

```text
.venv/bin/pytest tests/test_work_order_security.py -q
..FF.                                                                    [100%]
ValueError: state transition from 'in_progress' to 'open' is not permitted
Failed: DID NOT RAISE <class 'ValueError'>
2 failed, 3 passed in 8.86s
```

After the repair, the focused portable suite passed:

```text
.venv/bin/pytest tests/test_work_order_security.py tests/test_workspace_seed.py tests/test_repository.py tests/test_task7_infrastructure_security.py -q
.............                                                            [100%]
13 passed in 12.97s
```

The live PostgreSQL integration suite now checks every rejected normal-state
pair, a real other-site work order, controlled append refusal, and the direct
runtime-insert trigger:

```text
docker compose run ... api pytest tests/test_postgres_audit_integration.py -q
.....                                                                    [100%]
5 passed in 3.24s
```
