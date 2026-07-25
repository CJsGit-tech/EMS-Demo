# Task 8 — V2G simulator documentation and readiness handoff report

**Date:** 2026-07-25
**Status:** Complete with documented readiness limits

## Delivered

- Expanded `apps/v2g-integration-app/README.md` with local ports, Compose
  lifecycle commands, demo data range, smoke command, and links to the two
  handoff documents.
- Added `docs/simulator-safety-boundary.md` with the explicit simulator-only
  boundary, network exposure, Task 8 acceptance status, and real-integration
  release gate.
- Added `docs/operator-walkthrough.md` with startup, reset, data
  freshness/quality/staleness, alarm scenarios, and the actual local command
  workflow.

## Read-only external-control scan

Task 8 scan run from the repository root:

```text
rg -n 'websocket|ocpp|socket\.connect|requests\.(post|put)' apps/v2g-integration-app/services/v2g-api/src
```

Result: no matches. A broader read-only scan found only same-origin browser
`fetch`, local smoke-test `curl` calls, and OCPP-shaped labels in the pure
simulator. No external-control client implementation was found.

## Readiness finding

The full in-memory command service is tested through
`requested → validated → awaiting_approval → approved → simulated` with local
audit events. The shipped HTTP/UI path exposes request, approve, reject, and
bounded in-memory SSE state notifications only. It does not expose simulated
execution, command-audit retrieval, durable command state, or authentication.
The docs present this as a readiness limitation, not an operator capability.

The dispatch API's current `proposed` recommendation has no `command_id` or
projected SOC. The UI therefore correctly treats it as advisory and keeps the
approval control disabled. Alarm state is also read-only; the UI has no
acknowledgement action.

## Validation

- `npm test -- --run`: passed, 23 tests.
- `npm run build`: passed.
- `services/v2g-api/.venv/bin/pytest tests -q`: 52 passed, 3 skipped, and 3
  failed in `test_task7_infrastructure_security.py`. Those failures assert
  infrastructure hardening that the current Compose/UI files do not fully
  satisfy; no application or Docker source was changed in this task.
- Docker built the local stack; PostgreSQL, migrator, and API became healthy.
  The smoke check failed because `v2g-scada` exited before it could serve the
  UI. Nginx reported `mkdir() "/var/cache/nginx/fastcgi_temp" failed (30:
  Read-only file system)`. The current Nginx configuration routes some temp
  paths to `/tmp` but leaves `fastcgi_temp` at its read-only default. This is
  a Docker/Nginx follow-up outside Task 8 documentation scope.

## Scope

Only Task 8 documentation and this report were changed. No frontend, backend
application source, Docker configuration, tests, or smoke-script behavior was
modified.
