# V2G SCADA simulator

This is an isolated, local-only V2G simulator. It does not connect to an
OCPP server, EVSE, vehicle, utility, or any other external control system.

## Run the local stack

Docker Compose builds the React UI, API, and an isolated PostgreSQL database.
The API applies asynchronous Alembic migrations and inserts the deterministic
five-EVSE demo seed before it starts serving requests.

```bash
cd apps/v2g-integration-app
V2G_COMPOSE_PROJECT=v2g-local-simulator docker compose --project-name v2g-local-simulator up --build -d
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh
```

Open the UI at http://localhost:5181 and the API health endpoint at
http://localhost:8005/healthz. Both ports are bound to `127.0.0.1` only. The
browser uses same-origin API paths; the UI container proxies them to the
internal Compose API hostname, so no host-only API configuration is needed.

Tear down the isolated stack and its demo database when finished:

```bash
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh --teardown
```
