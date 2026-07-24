# Current-Data EMS Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixture-led EMS tab with an energy-manager-first dashboard that reads the currently available PostgreSQL-backed snapshot, observations, and derived performance data through FastAPI.

**Architecture:** Keep the existing React/Vite shell, hash routing, site tabs, themes, locale system, and AgentCrew drawer. Add a small EMS data adapter and view model, then render a focused `EmsDashboard` subtree with truthful live, degraded, empty, and unavailable states. Do not add unsupported demand forecasts, storage, charger, revenue, or emissions data.

**Tech Stack:** React 18, Vite, JavaScript/JSX, Lucide React, Vitest, Testing Library, FastAPI REST API, PostgreSQL-backed EMS seed data.

## Global Constraints

- Browser reads only FastAPI REST endpoints; it never calls PostgreSQL or FastMCP directly.
- Every request and record remains scoped to the active external `site_id`.
- Supported metrics for this slice are `energy_kwh`, `irradiance_w_m2`, `temperature_c`, and `performance_ratio`.
- Missing, stale, insufficient, unavailable, and fallback data must be labeled and must never be rendered as zero or described as live.
- Power and energy units must not be conflated; the energy series remains `kWh`.
- Existing global navigation, site routing, tab behavior, theme, locale, and AgentCrew integration remain intact.
- No new chart library is required; the existing SVG chart approach may be reused.

---

### Task 1: Add the EMS REST adapter and normalized view model

**Files:**
- Create: `apps/site-integration-app/src/ems/emsApi.js`
- Create: `apps/site-integration-app/src/ems/emsViewModel.js`
- Create: `apps/site-integration-app/tests/ems-view-model.test.js`
- Modify: `apps/site-integration-app/src/App.jsx:40,920-946`

**Interfaces:**
- `loadEmsDashboardData({ siteCode, userId, from, to, signal })` returns `{ snapshot, observations, derived, catalog }` and throws an error with `kind` and `status` for unavailable/unauthorized responses.
- `buildEmsViewModel({ snapshot, observations, derived, catalog, locale, siteCode })` returns `{ health, kpis, energySeries, weatherSeries, performance, unavailableMetrics, assets }`.
- `EmsDashboard` consumes the normalized view model and never reads raw fixture workspace chart fields for live analytics.

- [ ] **Step 1: Write failing view-model tests.** Cover grouping of `energy_kwh`, `irradiance_w_m2`, and `temperature_c`; latest values; derived `performance_ratio`; unsupported catalog metrics; and explicit unavailable state when an envelope has no records.

```js
it("normalizes supported series without mixing units", () => {
  const model = buildEmsViewModel({ snapshot, observations, derived, catalog, locale: "en", siteCode: "site-001" });
  expect(model.energySeries.every((point) => point.unit === "kWh")).toBe(true);
  expect(model.weatherSeries.irradiance[0].unit).toBe("W/m²");
  expect(model.weatherSeries.temperature[0].unit).toBe("°C");
});

it("does not fabricate unsupported metrics", () => {
  const model = buildEmsViewModel({ snapshot, observations, derived: emptyResult, catalog, locale: "en", siteCode: "site-001" });
  expect(model.performance.state).toBe("unavailable");
  expect(model.unavailableMetrics).toContain("storage_soc");
});
```

- [ ] **Step 2: Run the focused test and confirm it fails.**

Run: `cd apps/site-integration-app && npm test -- --run tests/ems-view-model.test.js`

Expected: FAIL because the adapter and view-model exports do not exist.

- [ ] **Step 3: Implement the adapter.** Use `VITE_AGENTCREW_API_URL`, call the existing endpoints in parallel, pass `x-user-id`, encode `from`/`to` and metric codes, and preserve response envelopes. Do not silently replace a failed API response with fixture data.

```js
const API_BASE = import.meta.env.VITE_AGENTCREW_API_URL || "http://localhost:8002/api/v1";

export async function loadEmsDashboardData({ siteCode, userId, from, to, signal }) {
  const query = new URLSearchParams({
    ...(from ? { from: from.toISOString() } : {}),
    ...(to ? { to: to.toISOString() } : {}),
    metric_codes: "energy_kwh,irradiance_w_m2,temperature_c",
    limit: "1000",
  });
  const headers = { "x-user-id": userId };
  const read = async (path) => {
    const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteCode)}${path}`, { headers, signal });
    if (!response.ok) {
      const error = new Error(`EMS request failed: ${response.status}`);
      error.kind = response.status === 403 ? "unauthorized" : "unavailable";
      error.status = response.status;
      throw error;
    }
    return response.json();
  };
  const [snapshot, observations, derived, catalog] = await Promise.all([
    read(""),
    read(`/observations?${query}`),
    read(`/reports?${query}`),
    read("/metrics"),
  ]);
  return { snapshot, observations, derived, catalog };
}
```

- [ ] **Step 4: Implement pure normalization.** Keep every point’s timestamp, value, unit, quality, source, and lineage fields. Sort by timestamp, compute only display-safe latest/window totals from returned `energy_kwh` records, and expose unavailable state when a derived record is absent.

- [ ] **Step 5: Run the focused test and commit the adapter boundary.**

Run: `cd apps/site-integration-app && npm test -- --run tests/ems-view-model.test.js`

Expected: PASS.

```bash
git add apps/site-integration-app/src/ems/emsApi.js apps/site-integration-app/src/ems/emsViewModel.js apps/site-integration-app/tests/ems-view-model.test.js
git commit -m "feat: add EMS dashboard data adapter"
```

### Task 2: Build the live EMS dashboard components

**Files:**
- Create: `apps/site-integration-app/src/ems/EmsDashboard.jsx`
- Create: `apps/site-integration-app/src/ems/EmsDataHealth.jsx`
- Create: `apps/site-integration-app/src/ems/EmsKpiStrip.jsx`
- Create: `apps/site-integration-app/src/ems/EmsEnergyPanel.jsx`
- Create: `apps/site-integration-app/src/ems/EmsWeatherPanel.jsx`
- Create: `apps/site-integration-app/src/ems/EmsPerformancePanel.jsx`
- Modify: `apps/site-integration-app/src/App.jsx:2388-2480`

**Interfaces:**
- `EmsDashboard({ model, workflowContext, locale, onRetry })` renders the complete EMS tab and emits retry through `onRetry`.
- Each child receives normalized props only; no child imports `siteWorkspaceContent.js` or calls `fetch`.
- Existing workflow context remains below the live analytics and is explicitly labeled when its metrics are not API-backed.

- [ ] **Step 1: Add component tests for live and unavailable states.** Verify visible PostgreSQL/live status, energy/irradiance/temperature units, performance provenance, unsupported-metric copy, and no zero fabrication for absent records.

- [ ] **Step 2: Implement `EmsDataHealth` and `EmsKpiStrip`.** Use text labels for source, freshness, quality, point count, and unavailable values; keep units adjacent to numeric values.

- [ ] **Step 3: Implement `EmsEnergyPanel`.** Render the existing SVG signal style with an accessible summary and data-list alternative. Preserve gaps as gaps and label the time window.

- [ ] **Step 4: Implement `EmsWeatherPanel` and `EmsPerformancePanel`.** Use separate irradiance/temperature panels and display formula version, calculated-at, period, input count, and source window when present.

- [ ] **Step 5: Implement the dashboard composition and replace the inline EMS branch.** Preserve the current site tab `tabpanel` ID and surrounding navigation. Pass live load state from `App` and keep existing workflow cards below the new analytics.

- [ ] **Step 6: Run component tests and commit the dashboard slice.**

Run: `cd apps/site-integration-app && npm test -- --run tests/ems-dashboard.test.jsx`

Expected: PASS.

```bash
git add apps/site-integration-app/src/ems apps/site-integration-app/src/App.jsx apps/site-integration-app/tests/ems-dashboard.test.jsx
git commit -m "feat: build current-data EMS dashboard"
```

### Task 3: Add truthful loading, fallback, responsive styling, and localization

**Files:**
- Modify: `apps/site-integration-app/src/App.jsx`
- Modify: `apps/site-integration-app/src/styles.css`
- Modify: `apps/site-integration-app/src/i18nConfig.js`
- Modify: `apps/site-integration-app/tests/ems-dashboard.test.jsx`

**Interfaces:**
- App owns request lifecycle: `loading`, `fresh`, `degraded`, `unavailable`, and `unauthorized`.
- Dashboard receives `onRetry`; it never decides whether a fallback is live.

- [ ] **Step 1: Add lifecycle tests.** Cover loading skeleton, failed API copy, unauthorized/site mismatch, empty window, and retry behavior.

- [ ] **Step 2: Implement lifecycle state.** On site change, abort the prior request, clear prior-site data immediately, request the new site, and set a typed state. Do not retain data from the previous site while the new request is pending.

- [ ] **Step 3: Add styles.** Use the existing token system, 8px/10px radii, 44px controls, responsive 8/4 desktop split, one-column tablet layout, and stacked mobile layout. Add reduced-motion handling and visible focus states.

- [ ] **Step 4: Add English and Traditional Chinese labels.** Keep status, units, unavailable copy, data-health notices, and chart summaries structurally equivalent.

- [ ] **Step 5: Run the full frontend suite/build and commit.**

Run: `cd apps/site-integration-app && npm test -- --run && npm run build`

Expected: all tests pass and Vite build completes; chunk-size warnings are non-blocking if unchanged.

```bash
git add apps/site-integration-app/src/App.jsx apps/site-integration-app/src/styles.css apps/site-integration-app/src/i18nConfig.js apps/site-integration-app/tests/ems-dashboard.test.jsx
git commit -m "feat: add truthful EMS dashboard states"
```

### Task 4: Verify database causality and browser evidence

**Files:**
- Modify: `AppDeploy/agent-team/docs/11-visual-e2e-evidence-matrix.md`
- Modify: `AppDeploy/agent-team/docs/12-integration-readiness-checklist.md`
- Modify: `AppDeploy/agent-team/docs/13-local-development-and-operations-runbook.md`
- Test/verify: running PostgreSQL, FastAPI, FastMCP, and Vite services

**Interfaces:**
- Browser route: `http://127.0.0.1:5180/#site/tokyo-campus/ems`.
- Expected live state: `PostgreSQL / live read`, `fresh`, `valid`, and seeded asset/observation counts.

- [ ] **Step 1: Verify API responses against the seeded database.** Query snapshot, observations, reports, and metric catalog for `site-001` as `demo-user`; confirm site ID and supported metric codes.

- [ ] **Step 2: Verify database causality.** Use an isolated transaction or deterministic seed fixture to change a canonical energy observation, reload the API response, and confirm the dashboard value changes; restore the seed state afterward.

- [ ] **Step 3: Verify browser states in the required in-app browser.** Capture desktop and 375px evidence for live analytics, performance provenance, unsupported metrics, and unavailable API/fallback labeling. Do not use standalone Playwright.

- [ ] **Step 4: Update evidence and runbook documents.** Record commands, route, viewport, source state, and remaining gaps; state explicitly that unsupported metric families are unavailable in this slice.

- [ ] **Step 5: Run final checks and commit documentation.**

Run: `git diff --check`

Expected: no whitespace errors.

```bash
git add AppDeploy/agent-team/docs/11-visual-e2e-evidence-matrix.md AppDeploy/agent-team/docs/12-integration-readiness-checklist.md AppDeploy/agent-team/docs/13-local-development-and-operations-runbook.md
git commit -m "docs: record EMS dashboard evidence"
```

