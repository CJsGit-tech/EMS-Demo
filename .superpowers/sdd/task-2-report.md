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
