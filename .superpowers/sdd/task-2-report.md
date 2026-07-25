# AgentCrew Task 2 report — MCP gateway, autonomy policy, and persistence

## Delivered

- Routed every internal/direct MCP tool request through `AgentCrewService.call_tool` and the selected gateway. Canonical database-mode reads now receive the same active-site validation, approval checks, bounded retries, audit events, and `McpAttemptRecord` persistence as supervised runs.
- Made database mode fail closed. It never selects the in-memory EMS repository; an unavailable PostgreSQL authority returns a bounded, safe `authoritative_repository_unavailable` result. Fixture data remains available only when `EMS_MCP_GATEWAY_MODE` is explicitly a fixture mode.
- Suppressed the five fixture-only legacy MCP tools when database mode is selected. Canonical typed tools remain advertised.
- Fixed report chains so `approve_step` approves only the pending read. After the report-input read, the analysis read remains blocked until its own step approval; `approve_all_session` still approves the bounded session allowlist.
- Added restart recovery through `GET /api/v1/agentcrew/runs/{run_id}` and the internal MCP read path. Both require matching active-site context, user, and session before returning local or persisted artifacts.
- Made production persistence failures fail safely instead of being silently disabled. A checkpoint failure marks an in-memory run failed with `persistence_unavailable` and emits `run.persistence_failed`; initial required persistence failures surface as a safe 503. Explicit fixture/offline modes retain their non-durable behavior.
- Strengthened the Docker PostgreSQL integration contract to invoke the canonical `query_energy_timeseries` tool, assert two exact deterministic seed rows, and verify the gateway selects `EmsRepository` rather than `InMemoryEmsRepository`.
- Prevented a required `save_run` checkpoint failure from immediately triggering another durable completion-message write. The run now returns its safe terminal `persistence_unavailable` result, while explicit fixture/offline persistence behavior remains unchanged.
- Corrected `AuditEvent.occurred_at` to generate a real UTC timestamp when each event is constructed.
- Added idempotent migration `0007_agentcrew_public_approvals` to ensure the AgentCrew approval indexes exist in the public persistence boundary without modifying the EMS-owned approval table.

## Verification

Executed from `apps/site-integration-app/services/ems-api`:

```text
$ uv run --with asyncpg python -m pytest -q
...sss....................s.sss......................................... [ 81%]
................                                                         [100%]
=============================== warnings summary ===============================
.venv/lib/python3.12/site-packages/fastapi/testclient.py:1
  /Users/chuang/Desktop/projects/EMS/EMS-Demo/apps/site-integration-app/services/ems-api/.venv/lib/python3.12/site-packages/fastapi/testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
81 passed, 7 skipped, 1 warning in 0.49s
```

The seven skips are isolated environment-dependent tests; the new Docker integration test does not depend on `EMS_LIVE_DB`.

```text
$ uv run --with asyncpg python -m alembic upgrade head
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 0006_report_draft_revisions -> 0007_agentcrew_public_approvals, Restore the AgentCrew approval boundary to the public persistence schema.

$ EMS_INTEGRATION_DATABASE=1 EMS_PERSISTENCE_MODE=postgres EMS_MCP_GATEWAY_MODE=database uv run --with asyncpg python -m pytest tests/test_agentcrew_postgres_integration.py -q
.                                                                        [100%]
1 passed in 5.21s

$ uv run --with asyncpg python -m py_compile src/agentcrew/app.py src/agentcrew/mcp.py src/agentcrew/mcp_server.py src/agentcrew/persistence.py src/agentcrew/runtime.py src/agentcrew/service.py migrations/versions/0007_agentcrew_public_approvals.py
# exit 0; no output
```

The PostgreSQL integration test uses the healthy local Docker stack and proves the selected repository is the authoritative `EmsRepository`, returns exact seeded `query_energy_timeseries` records, persists direct MCP attempt/audit rows, and recovers a persisted run across a new service instance. The full suite includes a regression fake that fails `save_run` and all subsequent writes, proving the terminal failure path performs no second write.

## Commit

- `3f82658611ad5c471e86ea1b102bfde695b670ff` — `fix(agentcrew): handle failed run checkpoints safely`

## Concerns

- The existing FastAPI TestClient dependency emits one upstream deprecation warning during the suite; it is unrelated to this task.
- Database integration requires the local Docker PostgreSQL stack and explicit `EMS_INTEGRATION_DATABASE=1`; it intentionally does not use or depend on `EMS_LIVE_DB`.
