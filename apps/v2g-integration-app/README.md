# V2G SCADA simulator

> A local, deterministic V2G SCADA demo for reviewing simulated fleet data and recording local command decisions. It never controls equipment.

## Safety boundary

This application is a simulator, not an EV charging management system. It has
no external OCPP, EVSE, vehicle, utility, grid, or market connection, and it
does not implement OCPP or any other protocol transport. The OCPP-shaped event
labels describe local test data only.

The UI and API bind only to the local machine. See
[the simulator safety boundary](docs/simulator-safety-boundary.md) before you
run it or interpret its output.

## Quick start

You need Docker Desktop (or Docker Engine) with Docker Compose v2. From this
directory, start the isolated stack and run its smoke check:

```bash
V2G_COMPOSE_PROJECT=v2g-local-simulator docker compose --project-name v2g-local-simulator up --build -d
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh
```

Open [the local operator UI](http://localhost:5181). The local API health
check is [http://localhost:8005/healthz](http://localhost:8005/healthz).

> **Current smoke status:** The read-only UI container runs Nginx on port 8080
> with its temporary paths under `/tmp`; Compose mounts `/tmp` as `tmpfs`.
> The smoke check is valid for this configuration and verifies API health, the
> seeded overview/analytics/diagnostics responses, the V2G SCADA UI identity,
> and the simulator API's external-transport safety scan.

## What the stack contains

Docker Compose starts four local services:

| Service | Purpose | Host access |
| --- | --- | --- |
| `v2g-scada` | React operator UI served by Nginx | `127.0.0.1:5181` |
| `api` | FastAPI simulator API | `127.0.0.1:8005` |
| `migrator` | Applies migrations and seeds the demo database before the API starts | No published host port |
| `postgres` | Demo seed and schema storage | No published host port |

The browser uses same-origin `/api` paths. Nginx proxies those requests only
to the internal Compose API hostname. The one-shot migrator applies migrations
and seeds deterministic demo data before the API starts.

## Run, reset, and stop

Use a project name to keep this demo separate from other Compose stacks. The
smoke script waits for Compose health checks, verifies the API health endpoint
plus the fixed demo site's overview, analytics, and diagnostics responses,
verifies that the UI identifies itself as V2G SCADA, and rejects
external-control transport patterns in the simulator API source.

```bash
# Start or rebuild the stack, then wait for all service health checks.
V2G_COMPOSE_PROJECT=v2g-local-simulator docker compose --project-name v2g-local-simulator up --build -d

# Verify the running stack.
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh

# Remove containers, networks, and the named demo database volume.
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh --teardown
```

After teardown, starting the stack again creates and seeds a new local demo
database. Do not use these commands against a production Compose project.

## Demo data and scenarios

The only site is `demo-v2g-site`. Its deterministic seed contains:

- Five EVSEs: `evse-01` through `evse-05`.
- Three active charging sessions and one unplugged session.
- Thirty days of `power_kw` history, sampled every 15 minutes for each EVSE
  (14,400 historical points), plus three current meter points from the seed
  tick.
- An unavailable `evse-03` with a simulated communications-loss condition.
- A simulated smart-charging rejection caused by a site load limit.

The historian API accepts timezone-aware `from` and `to` values and returns at
most 1,000 points. A response sets `truncated` when the requested range exceeds
that response limit. The UI offers 6-, 24-, and 72-hour windows.

The simulator produces deterministic status, transaction, meter, and
smart-charging-result events for a given seed and timestamp. It does not poll,
listen to, or command a real charger.

## Workspace language and scope

On a browser with no saved preference, the workspace opens in Traditional
Chinese. Use the header language control to switch to English or back to
Traditional Chinese; the selected locale is retained in that browser's local
storage. The four supported navigation domains are **Overview**,
**Monitoring**, **Operations**, and **Analytics**. They contain the real
simulator views, including diagnostics, event and inverter monitoring,
simulated work orders, dispatch advice, historian ranges, and deterministic
analysis of five inverters and forty strings.

Reports are deliberately out of scope for this simulator. No Reports group or
route is rendered; do not use this demo as a source for production reporting.

## Operator workflow

Use the console to review simulated telemetry, fleet availability, alarms,
historian data, and dispatch advice. The currently shipped recommendation is
an advisory record with status `proposed`; it is not a pending command and its
button is disabled by design.

The API also exposes local command request, approval, and rejection endpoints
for contract testing. They enforce capacity, projected SOC, expiry, a named
actor, and a non-empty reason. Their states and the present UI limitation are
described in [the operator walkthrough](docs/operator-walkthrough.md).

Work-order state changes are a separate local workflow. A transition requires
a non-empty actor and reason, is restricted to the seeded demo site, and is
recorded as a simulated work-order event. It never sends an equipment command.

## Data freshness, quality, and alarms

`data_freshness.observed_at` identifies the source timestamp shown in the
Operations view. The API exposes only `good` and `stale` quality values. The
seed returns `good` data; it does not calculate staleness from wall-clock time.
Treat it as demo data, never as current operational telemetry.

Alarm entries are read-only simulator output. They can be `open` or `cleared`;
the UI has no acknowledgement action. See the walkthrough for the exact alarm
scenarios and how to record an operator review without claiming a state change.

## Local validation

Run the frontend checks from this directory:

```bash
npm test -- --run
npm run build
```

Run the API tests from the API directory. The repository's virtual environment
contains the declared Python dependencies:

```bash
cd services/v2g-api
.venv/bin/pytest tests -q
```

## Documentation

- [Simulator safety boundary](docs/simulator-safety-boundary.md): scope,
  network limits, acceptance status, and known readiness limits.
- [Operator walkthrough](docs/operator-walkthrough.md): local startup, data
  interpretation, alarms, and the request/approve/reject workflow.
