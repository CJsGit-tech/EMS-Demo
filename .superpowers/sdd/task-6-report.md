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

### Historical visual smoke-test limitation — resolved

The required in-app browser smoke test was attempted after starting the Vite
server. The installed browser skill directory lacks its required
`scripts/browser-client.mjs` module, so the in-app browser cannot be initialized
in this environment. No alternate browser automation was used, per repository
instructions. This environment issue was subsequently resolved; the completed
browser evidence is recorded below.

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
browser automation was used. This limitation is resolved by the completed
browser verification recorded below.

---

# Task 6 verification report — V2G SCADA simulator

Date: 2026-07-25
Scope: Task 6 documentation and verification only. Unrelated dirty-checkout
changes were preserved.

## Outcome

All Task 6 verification passed, including the required in-app browser review.
The earlier browser-skill environment issue is resolved.

## Changes made

- Updated `scripts/smoke_test_v2g_stack.sh` to verify the seeded fixed-site
  overview, analytics, and diagnostics endpoints; the V2G SCADA UI identity;
  and absence of external-control transport patterns in the API source.
  Analytics uses the required fixed, timezone-aware range
  `2026-07-24T00:00:00Z` to `2026-07-26T00:00:00Z` because the API contract
  requires `from` and `to`.
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
| API suite | PASS | `.venv/bin/pytest tests -q`: **67 passed, 5 skipped** in 31.11s. The skips require `V2G_TEST_DATABASE_URL`; equivalent live PostgreSQL role/audit checks were run below. |
| Frontend suite | PASS | `npm test -- --run`: **9 files / 56 tests passed** in 1.41s. Includes Chinese-default navigation, English localization behavior, real navigation views, and no Reports label. |
| Production build | PASS | `npm run build`: 57 modules transformed; completed in 307ms. |
| Smoke script syntax | PASS | `bash -n scripts/smoke_test_v2g_stack.sh`. |
| Updated live smoke | PASS | `V2G_COMPOSE_PROJECT=v2g-task6-verify V2G_API_HOST_PORT=18005 V2G_UI_HOST_PORT=15181 ./scripts/smoke_test_v2g_stack.sh`. |

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

The Compose stack was rebuilt and started at
`http://127.0.0.1:5181/`. Browser verification confirmed:

- The default interface is Traditional Chinese. The sidebar contains only
  **總覽**, **監控**, **維運**, and **分析**; Reports is absent.
- Switching to English rendered **Site overview**. Switching back rendered
  **電站總覽**.
- The **Event management**, **Work orders**, and **Event analysis** routes each
  rendered their corresponding heading. Event analysis reported a Reports
  count of `0`.
- Screenshot review of the Chinese Event Analysis dashboard passed: dark
  operational SCADA layout, active sidebar state, and no Reports group.

This browser evidence completes the previously blocked checks. The stale,
empty, and error states remain covered by the passing frontend suite; no
browser blocker or Task 6 product concern remains.
