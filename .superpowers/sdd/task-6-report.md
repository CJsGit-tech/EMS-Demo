## Task 6 Report: SCADA operator interface

### Delivered

- Added a simulator-only Task 5 HTTP client for overview, fleet, alarms,
  recommendations, historian, and guarded command approval/rejection.
- Built one responsive SCADA application frame with accessible Operations,
  Fleet, Dispatch, Alarms, and Historian tabs.
- Reused and extended the existing metric strip, SVG trend chart, and native
  command dialog. Live overview metrics display freshness beside each value;
  historian surfaces supplied point quality.
- Added explicit loading, empty, error, and stale-data states. Navigation is
  hardened against in-flight tab changes so a prior endpoint response cannot
  crash the newly selected view.
- Dispatch presents expiry, constraint summaries, projected SOC, and expected
  site impact. A proposal from the Task 5 contract remains visibly advisory
  and non-actionable because it does not include a command ID or projected SOC.
  Only an explicit `awaiting_approval` command-shaped recommendation can open
  the native dialog named exactly `Approve simulated command`; approve and
  reject both require a reason and call simulator-only endpoints.
- The UI makes the simulator boundary explicit and does not add live device,
  vehicle, grid, or external integration behavior.

### Verification

Run from `apps/v2g-integration-app`:

```text
npm test -- --run
15 passed

npm run build
vite build succeeded (40 modules transformed)
```

### Historical visual smoke-test limitation

The required in-app browser smoke test was attempted after starting the Vite
server. The installed browser skill directory lacks its required
`scripts/browser-client.mjs` module, so the in-app browser cannot be initialized
in this environment. No alternate browser automation was used, per repository
instructions. The later resolved claim is not treated as current evidence by
the corrective verification below.

### Focused repair — 2026-07-25

- Tab navigation now follows the accessible automatic-activation tab pattern:
  ArrowLeft/ArrowRight wrap through the five sections, Home/End jump to the
  bounds, and only the selected tab remains in the tab sequence.
- Approval is fail-closed against the Task 5 command contract. It requires a
  non-empty backend `command_id`, `awaiting_approval` command state, a future
  parseable `expires_at`, finite `projected_soc_percent`, and at least one
  non-empty rendered constraint. Advisory records never receive a synthetic
  approval ID. Missing command action handlers also show an error rather than
  recording a local success.
- A successful approve/reject response updates the displayed command state and
  disables further action immediately; the app also merges that returned state
  into the current Dispatch resource when it is still present.
- Historian warnings derive only from the historian response's own freshness
  and point-quality fields, independent of the Operations resource.
- `npm run dev` now proxies `/api` to `http://127.0.0.1:8005` by default, with
  `VITE_V2G_API_PROXY_TARGET` available for an alternate supported API base.
  The development server routed an overview request to the proxy (HTTP 500
  because no API process was listening locally), rather than returning the Vite
  SPA fallback/404.

#### Repair verification

```text
npm test -- --run
23 passed

npm run build
vite build succeeded (41 modules transformed)
```

The in-app browser visual check was unavailable at that point because its
installed browser skill was missing `scripts/browser-client.mjs`; no alternate
browser automation was used. Live UI evidence remains pending unless it is
reproduced by the controller.

---

# Task 6 verification report — V2G SCADA simulator

Date: 2026-07-25
Scope: Task 6 documentation and verification only. Unrelated dirty-checkout
changes were preserved.

## Corrective outcome

The safety regression, isolated Compose smoke, browser verification, and the
five PostgreSQL audit integration tests passed. The shell smoke verifies
service and safety behavior; it does not prove UI language state or switching.

## Changes made

- Updated `scripts/smoke_test_v2g_stack.sh` to verify the seeded fixed-site
  overview, analytics, and diagnostics endpoints; the V2G SCADA UI identity;
  and absence of external-control transport patterns in the API source.
  Analytics uses the required fixed, timezone-aware range
  `2026-07-24T00:00:00Z` to `2026-07-26T00:00:00Z` because the API contract
  requires `from` and `to`.
- Corrected the safety regex to detect concrete `socket.connect`,
  `requests.post`, and `requests.put` calls. The script now requires `rg`,
  fails closed on scanner absence/error, and scans before Compose startup. A
  narrow shell regression uses harmless temporary source snippets.
- Updated the README and operator walkthrough for the Traditional Chinese
  default, persisted English switcher, four real workspace domains, generated
  analysis data, historian range controls, deliberately absent Reports group,
  simulated work-order workflow, and reset procedure.
- Updated the simulator safety boundary to document the restricted runtime
  database role and append-only local work-order-event boundary. No simulator
  safeguard was weakened.

## Automated verification

| Check | Result | Evidence |
| --- | --- | --- |
| Safety regression | PASS | `bash tests/smoke_test_safety_scan.sh`: the three concrete call fixtures were rejected and missing `rg` failed closed. |
| Smoke script syntax | PASS | `bash -n scripts/smoke_test_v2g_stack.sh tests/smoke_test_safety_scan.sh`. |
| Updated live smoke | PASS | `V2G_COMPOSE_PROJECT=v2g-task6-corrective V2G_API_HOST_PORT=18006 V2G_UI_HOST_PORT=15182 ./scripts/smoke_test_v2g_stack.sh`: all services became healthy and the smoke success line was emitted. |
| PostgreSQL audit integration | PASS | Temporary Compose API container with repository tests mounted read-only against disposable `v2g_test`: `docker compose -f apps/v2g-integration-app/docker-compose.yml run --rm -T -v /Users/chuang/Desktop/projects/EMS/EMS-Demo/apps/v2g-integration-app/services/v2g-api/tests:/app/tests:ro -e V2G_TEST_DATABASE_URL=postgresql+asyncpg://v2g_owner:v2g_owner_local_only@postgres:5432/v2g_test -e V2G_RUNTIME_TEST_DATABASE_URL=postgresql+asyncpg://v2g_runtime:v2g_runtime_local_only@postgres:5432/v2g_test api pytest tests/test_postgres_audit_integration.py -q` → `5 passed`; one pytest-cache warning was expected because `/app` is read-only. |

## Compose, migration, seed, and API verification

The default API port `127.0.0.1:8005` was already occupied by an unrelated
local process. To preserve it, the isolated project was brought up on
loopback-only alternate ports:

```bash
V2G_API_HOST_PORT=18005 V2G_UI_HOST_PORT=15181 \
  docker compose --project-name v2g-task6-verify up -d
```

Results:

- PostgreSQL and API reported healthy; the one-shot migrator completed
  successfully; the UI reported healthy.
- The database was at Alembic revision `0002_v2g_operational_workspace`.
- Seed counts were 3 work orders, 5 inverter readings, and 40 string readings.
- Live `curl --fail` checks passed for `/healthz`, fixed-site `overview`,
  range-bounded `analytics`, and `diagnostics`.
- Analytics returned `simulated: true`, five inverters, forty strings, and two
  events. Diagnostics returned `simulated: true`, five EVSE assets, and two
  open alarms.

## Runtime-role and audit boundary verification

Using the live PostgreSQL container as `v2g_runtime` confirmed:

```text
current_user | alembic revision                 | work_orders | inverters | strings
v2g_runtime | 0002_v2g_operational_workspace   | 3           | 5         | 40

UPDATE work_orders | UPDATE work_order_events | DELETE work_order_events |
TRUNCATE work_order_events | EXECUTE guarded transition
false              | false                    | false                    |
false                      | true
```

An actual no-row direct update attempt was denied before it could change data:

```text
ERROR:  permission denied for table work_order_events
```

This confirms the runtime role is limited to the guarded transition path and
cannot directly mutate the append-only work-order-event table.

## Browser verification — completed

At `http://127.0.0.1:5181/`, the default interface rendered in Traditional
Chinese. Switching to English rendered **Site overview**; switching back
rendered **電站總覽**. Each real view was individually navigated and rendered
its `h1`:

`電站總覽`, `車隊總覽`, `診斷`, `事件管理`, `即時監控`, `變流器監控`, `營運儀表板`,
`維運紀錄`, `工作單`, `調度監督`, `電力歷史資料`, `站點效率`, `變流器效率`,
`組串健康度`, and `事件分析`.

No **Reports** entry appeared in the DOM snapshot. The console error log was
empty before the induced error-state test. After the local API was briefly
stopped and the UI reloaded, the browser rendered the alerts
`無法載入模擬資料。` and `Simulator request failed (502).` After the API was
restarted, `/healthz` returned `{"status":"ok"}` and a reload returned
**電站總覽** with no alert. No stale or empty-state result is claimed.

The shell smoke result is not used as evidence for language state or language
switching; those claims are supported only by the browser verification above.
