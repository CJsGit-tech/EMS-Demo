# Task 5 — localized Operations and Analytics workspaces

## Delivered

- Added localized Operations Log and Work Orders routes, with visible asset,
  alarm, severity, assigned-team, and timeline context.
- Work-order actions follow the fixed `open → in_progress → completed` and
  `in_progress → open` lifecycle. They require a non-empty actor and reason,
  call only the simulator's guarded work-order PATCH endpoint, and replace only
  the transitioned local record. The UI contains no device-control action.
- Added the analytics API client and localized site-efficiency, inverter-
  efficiency, string-health, and event-analysis workspaces. They consume the
  analytics aggregate and render unavailable/null calculations as `—`.
- Localized the Dispatch page and approval dialog through translation keys
  while retaining the existing closed eligibility gate and mandatory decision
  reason.

## TDD evidence

1. Added `operations-workspace.test.jsx` and `analytics.test.jsx` before the
   workspace modules existed.
2. The first focused run failed at collection because the Work Orders and
   Analytics page modules were absent.
3. Added the smallest implementation needed to pass the reason-validation,
   attributed local update, calculated/outlier, sortable inverter, and null
   placeholder behaviors.

## Verification

```text
cd apps/v2g-integration-app
npm test -- --run tests/operations-workspace.test.jsx tests/analytics.test.jsx tests/command-approval.test.jsx

3 files passed, 13 tests passed

npm test -- --run && npm run build

9 files passed, 52 tests passed
vite build passed
```

## Re-review repair follow-up

- String Health now calculates the DC-power average only from finite numeric
  values. Rows with null or nonfinite power render `—` for the health variance
  and cannot be classified as outliers, even if an upstream variance value is
  present.
- Replaced the remaining UI literals with dictionary keys in both locales:
  Dispatch's unavailable expiry, the approval dialog's simulator-only eyebrow,
  and the Inverter Efficiency table header.
- Added focused regressions for finite-only String Health averaging, neutral
  invalid rows, Chinese localization of the Dispatch/dialog fallbacks, and the
  localized inverter column header.

Verification:

```text
cd apps/v2g-integration-app
npm test -- --run tests/analytics.test.jsx tests/command-approval.test.jsx

2 files passed, 15 tests passed

npm test -- --run && npm run build

9 files passed, 56 tests passed
vite build passed
```

## Scope and concerns

- Changes are limited to Task 5 frontend integration, localization, tests, and
  this report. Existing uncommitted Operations dashboard and its styles/tests
  were preserved and are intentionally excluded from the Task 5 commit.
- The Task 3 `AnalyticsResponse` exposes only aggregate event severity counts
  and string DC power. The Event Analysis page therefore shows `—` for absent
  source, recurring-code, duration, and trend aggregates; String Health shows
  `—` for absent current/voltage values while still calculating power-based
  variance when enough string data is present.

## Review repair follow-up

- Replaced partial ARIA grid/row roles in String Health with a labelled native
  list of semantic cards.
- Made Event Analysis collection rendering safe for explicit `null` aggregate
  fields and retained `—` as the unavailable value.
- Added localized Dispatch eyebrow and command-state maps for every simulator
  command lifecycle state. Default Chinese rendering no longer exposes raw
  backend values such as `awaiting_approval` or `proposed`.

Verification:

```text
cd apps/v2g-integration-app
npm test -- --run tests/analytics.test.jsx tests/command-approval.test.jsx

2 files passed, 13 tests passed

npm test -- --run && npm run build

9 files passed, 54 tests passed
vite build passed
```
