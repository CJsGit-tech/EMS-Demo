# Operator walkthrough: local simulator

After you complete this walkthrough, you can start the local V2G simulator,
interpret its seeded data, review its alarms and recommendations, and
accurately distinguish a local approval record from simulated execution.

## Prerequisites

- Docker Desktop (or Docker Engine) with Docker Compose v2.
- A trusted local development machine. The stack has no authentication and is
  not an operational control system.

## 1. Start the local stack

From `apps/v2g-integration-app`, start the stack and wait for it to become
healthy:

```bash
V2G_COMPOSE_PROJECT=v2g-local-simulator docker compose --project-name v2g-local-simulator up --build -d
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh
```

The smoke script waits on Compose health checks and then verifies:

- `http://localhost:8005/healthz` returns an `ok` status;
- the `demo-v2g-site` overview is available; and
- `http://localhost:5181/` returns HTTP 200.

Open `http://localhost:5181/`. The header must say `SIMULATOR · NO EXTERNAL
CONTROL`. If it does not, stop and verify that you are using this local stack.

**Current readiness blocker:** the current read-only UI container exits before
the UI serves because Nginx still uses its default
`/var/cache/nginx/fastcgi_temp` directory. The API can become healthy, but the
smoke check fails until Docker/Nginx routes that directory to writable `tmpfs`
storage. Do not treat a healthy API alone as a successful stack startup.

## 2. Read Operations, Fleet, and Historian data

Start in **Operations**. `Site power` and `Flexible capacity` are calculated
from deterministic demo data. The `Observed` timestamp comes from
`data_freshness.observed_at`; the quality value is supplied by the response.

The seed uses the fixed UTC time `2026-07-25` and contains 30 days of
quarter-hour `power_kw` telemetry for five EVSEs. It has three active sessions
(`evse-01`, `evse-02`, and `evse-04`) and one unplugged session (`evse-05`).
`evse-03` is unavailable in the demo scenario.

Use **Historian** to view the 6-, 24-, or 72-hour windows. The API limits a
historian response to 1,000 points and marks it `truncated` when the requested
range has more matches. The UI only displays the selected window; it does not
create new telemetry.

### Freshness and quality

`good` means the simulator supplied a good-quality flag. It does not mean the
value is current in the real world. The current seed returns `good` data even
though its timestamps are fixed.

`stale` is a visible warning state when the overview freshness quality is
`stale`, or when a historian resource or any historian point has `stale`
quality. The current seed does not automatically turn stale as time passes;
there is no wall-clock staleness threshold. When you see a stale warning,
review the timestamp and do not rely on the value for a real-world decision.

## 3. Review alarms

Open **Alarms** to view simulator alarm state, severity, source, message, and
raised time. The default seed produces two open scenarios:

| Alarm | Severity | Meaning in this demo |
| --- | --- | --- |
| `evse.communication_lost` on `evse-03` | `major` | The simulator emitted an unavailable status with reason `CommunicationLost`. |
| `site.smart_charging_rejected` | `warning` | The simulator rejected a smart-charging request because of its site load limit. |

The simulator can also model `evse.overtemperature` at `critical` severity
when a meter event contains `temperature_c >= 80`. A healthy availability
status clears the communications alarm; an accepted smart-charging result
clears the site rejection; and a temperature below 80 clears the matching
over-temperature alarm.

There is no alarm-acknowledgement endpoint or UI action. The alarm feed is
read-only. If you review an alarm during a demo, record that review in your
team's external demo notes; do not imply that the simulator has acknowledged,
silenced, or corrected an alarm.

## 4. Review a dispatch recommendation

Open **Dispatch**. The API returns a `proposed` recommendation with:

- the simulated expected site impact and a 15-minute expiry derived from the
  fixed observed timestamp;
- assumptions about representative telemetry and available flexible capacity;
- constraints for flexible capacity and minimum departure SOC; and
- a simulator-only reason stating that no device or network action occurs.

A recommendation is advice, not a command. The current API recommendation
does not carry a `command_id` or projected SOC, so the UI presents it as
advisory and disables `Approve simulated command`. This is the expected,
fail-closed behavior for the shipped local stack.

## 5. Understand the local command workflow

The HTTP contract supports a separately created local command. A valid
`POST /api/v1/commands` supplies the demo site ID, power, projected SOC,
timezone-aware expiry, correlation ID, and idempotency key. It validates the
request and returns `awaiting_approval`.

An approval or rejection must include a non-empty `actor` and `reason`:

```text
request
  → requested
  → validated
  → awaiting_approval
  → approve with named actor and reason → approved
  → reject with named actor and reason  → rejected
```

The service test suite proves the model-level approved path continues to
`simulated`, recording `command.requested`, `command.validated`,
`command.awaiting_approval`, `command.approved`, and `command.simulated`.
That transition is not exposed by the running HTTP API. After an HTTP
approval, no simulated-result endpoint runs and no device is contacted. The
API can publish the observed request, approval, or rejection state to its
bounded in-memory SSE stream at `GET /api/v1/events`.

The command state and audit events are process-local and disappear on API
restart. There is no command audit retrieval API. The separately tested
PostgreSQL append-only audit repository does not currently back these routes.

## 6. Reset the demo

To remove the containers, networks, and named PostgreSQL volume, run:

```bash
V2G_COMPOSE_PROJECT=v2g-local-simulator ./scripts/smoke_test_v2g_stack.sh --teardown
```

Start the stack again with the command in step 1 to create a freshly seeded,
deterministic local demo. This reset is destructive for the named demo volume;
do not reuse the command or project name for data you need to keep.

## Troubleshooting

If the smoke script times out, inspect the Compose service state before
retrying:

```bash
V2G_COMPOSE_PROJECT=v2g-local-simulator docker compose --project-name v2g-local-simulator ps
```

The smoke script uses a 90-second health-check timeout by default. Set
`V2G_SMOKE_TIMEOUT_SECONDS` to a larger positive value for a slow local Docker
startup, then rerun the smoke script.
