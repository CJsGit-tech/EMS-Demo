## Task 7 Report: containerized local V2G simulator stack

- Added a self-contained three-service Compose project for PostgreSQL, the
  FastAPI simulator, and the built React/Nginx UI. API and UI ports are bound
  to `127.0.0.1:8005` and `127.0.0.1:5181`; PostgreSQL has no published port.
- PostgreSQL is health-gated. The API waits for it through Compose, runs the
  existing async Alembic migration command, and runs an idempotent deterministic
  five-EVSE seed before Uvicorn begins serving requests.
- UI API requests are same-origin and Nginx proxies them to the Compose
  hostname `api:8000`; no frontend component or API contract changed. There
  are no source mounts or real-device/protocol integrations.
- Added container health checks, non-root/read-only API runtime, loopback-only
  published ports, a teardown-capable smoke script, and V2G-only local run
  instructions.
- Added seed coverage for the required five EVSEs and for foreign-key ordering.
  The latter found a real PostgreSQL bootstrap fault: dependent alarms could
  flush before EVSE principals. The seed now explicitly flushes EVSEs first.

Verification:

```text
services/v2g-api/.venv/bin/pytest tests/test_seed.py -q
2 passed

services/v2g-api/.venv/bin/pytest -q
52 passed, 3 skipped, 2 warnings

docker compose --project-name v2g-task7-smoke --file apps/v2g-integration-app/docker-compose.yml up --build -d
V2G_COMPOSE_PROJECT=v2g-task7-smoke apps/v2g-integration-app/scripts/smoke_test_v2g_stack.sh
V2G simulator smoke passed: API healthy, demo overview returned, UI HTTP 200.

docker compose ps
postgres healthy; api healthy (127.0.0.1:8005->8000); v2g-scada healthy (127.0.0.1:5181->80)

SELECT count(*) FROM evses WHERE site_id = 'demo-v2g-site';
5

V2G_COMPOSE_PROJECT=v2g-task7-smoke apps/v2g-integration-app/scripts/smoke_test_v2g_stack.sh --teardown
all verification containers, networks, and demo volume removed
```
