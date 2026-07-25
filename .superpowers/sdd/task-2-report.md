# Task 2 Report — MCP gateway, autonomy policy, and persistence

## Status

Completed. The production AgentCrew path now selects an authoritative, database-backed EMS MCP adapter when `EMS_MCP_GATEWAY_MODE` is `database` (the production default when `DATABASE_URL` is configured). Fixture mode remains an explicit `fixtures` / `deterministic-fixtures` setting.

Implemented:

- Canonical production tool allowlist with active-site validation and no fixture aliases.
- Bounded three-attempt retrieval retries, approval checks, attempt/audit persistence, and redacted stored metadata.
- Production workflow mappings for supervisor-selected specialists and bounded session approvals.
- Gateway-derived citation provenance for report drafts, durable draft/revision support, and owner-only final report confirmation.
- Checkpointed public SSE supervisor artifacts and retrieval by supervisor run ID.
- FastAPI’s internal authoritative adapter now reuses the configured EMS service; non-canonical tools are rejected outside fixture mode.

## Commits

- `51613d1 feat(agentcrew): add authoritative MCP gateway`

## Verification

Commands run from `apps/site-integration-app/services/ems-api`:

```text
$ uv run --with asyncpg python -m pytest tests/test_authoritative_mcp_gateway.py -q
..                                                                       [100%]
2 passed in 0.01s

$ uv run --with asyncpg python -m pytest tests/test_agentcrew_stream_persistence.py -q
.                                                                        [100%]
1 passed, 1 warning in 0.12s

$ uv run --with asyncpg python -m pytest tests/test_runtime.py -q
........                                                                 [100%]
8 passed in 0.02s

$ uv run --with asyncpg python -m pytest -q
.ss.................s.sss............................................... [ 92%]
......                                                                   [100%]
72 passed, 6 skipped, 1 warning in 0.45s

$ uv run --with asyncpg python -m py_compile src/agentcrew/config.py src/agentcrew/mcp.py src/agentcrew/persistence.py src/agentcrew/service.py src/agentcrew/app.py src/ems/mcp_adapter.py
# exit 0; no output

$ git diff --cached --check
# exit 0; no output
```

The expected TDD red phase for the new production-gateway test failed with `ImportError: cannot import name 'AuthoritativeMcpGateway'`; it passed after implementation.

## Concerns

- Six PostgreSQL/live-database tests are intentionally skipped unless `EMS_LIVE_DB=1`; the full production persistence path has not been exercised against a running isolated database in this task.
- The shared worktree contains broad unrelated modifications and untracked Task 1/support files. Only the Task 2 files listed in commit `51613d1` were staged; nothing else was reverted or committed.
- Explicitly set `EMS_MCP_GATEWAY_MODE=database` in deployed environments as a defense-in-depth guard, even though a configured `DATABASE_URL` already selects it by default.
