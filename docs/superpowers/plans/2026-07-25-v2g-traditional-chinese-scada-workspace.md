# Traditional-Chinese V2G SCADA Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Traditional-Chinese-first, simulator-only V2G SCADA workspace with functional Overview, Monitoring, Operations, and Analytics domains.

**Architecture:** Preserve the standalone React/FastAPI/PostgreSQL simulator. Add deterministic simulator persistence/read models for inverter, string, work-order, diagnostic, and analysis views; expose them with typed, fixed-site API contracts; then render them through an i18n-aware sidebar workspace. English remains an explicit UI alternative, while stable API identifiers and enum values remain English.

**Tech Stack:** React 18, Vite, Vitest, FastAPI, Pydantic v2, SQLAlchemy async, Alembic, PostgreSQL, Docker Compose.

## Global Constraints

- Traditional Chinese (`zh-TW`) is the initial locale; English (`en`) is an explicit persistent choice.
- No endpoint, process, UI control, or seed logic may connect to an OCPP, EVSE, vehicle, utility, grid, or arbitrary external host.
- All generated values are deterministic, timezone-aware, site-scoped, and labelled `simulated` / `模擬` where meaningful.
- Existing command approval/rejection remains reason-gated and append-only audited.
- New work-order state changes require non-empty `actor` and `reason` and append to the immutable audit stream.
- API route site IDs remain fixed to `demo-v2g-site`; no arbitrary query or table access is added.
- Do not add Reports routes in this release.

---

### Task 1: Add a tested Traditional-Chinese-first i18n foundation

**Files:**
- Create: `apps/v2g-integration-app/src/i18n/en.js`
- Create: `apps/v2g-integration-app/src/i18n/zh-TW.js`
- Create: `apps/v2g-integration-app/src/i18n/I18nProvider.jsx`
- Create: `apps/v2g-integration-app/src/components/LanguageSwitcher.jsx`
- Modify: `apps/v2g-integration-app/src/main.jsx`
- Modify: `apps/v2g-integration-app/src/App.jsx`
- Test: `apps/v2g-integration-app/tests/i18n.test.jsx`

**Interfaces:**
- Produces `useI18n()` returning `{ locale, setLocale, t }`.
- `t(key, values?)` returns an exact message from the selected locale, interpolating `{name}` tokens; a missing key returns the key.
- Reads and writes `v2g-scada-locale` in `localStorage`, defaulting to `zh-TW` when unset or invalid.

- [ ] **Step 1: Write failing locale behavior tests.**

```jsx
test("starts in Traditional Chinese and persists an explicit English choice", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "電站總覽" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "English" }));
  expect(screen.getByRole("heading", { name: "Site overview" })).toBeVisible();
  expect(window.localStorage.getItem("v2g-scada-locale")).toBe("en");
});
```

- [ ] **Step 2: Run the focused test to confirm it fails.**

Run: `npm test -- --run tests/i18n.test.jsx`

Expected: FAIL because no i18n provider or language switcher exists.

- [ ] **Step 3: Add exact dictionaries and provider.**

```jsx
const storageKey = "v2g-scada-locale";
const supportedLocales = new Set(["zh-TW", "en"]);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const stored = window.localStorage.getItem(storageKey);
    return supportedLocales.has(stored) ? stored : "zh-TW";
  });
  const setLocale = (next) => {
    if (!supportedLocales.has(next)) return;
    window.localStorage.setItem(storageKey, next);
    setLocaleState(next);
  };
  const t = (key, values = {}) => (messages[locale][key] ?? key)
    .replace(/\{(\w+)\}/g, (_, token) => String(values[token] ?? `{${token}}`));
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}
```

- [ ] **Step 4: Wire translated sidebar/header strings and accessible switcher labels.**

```jsx
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <div aria-label={t("language.label")} className="language-switcher">
    <button aria-pressed={locale === "zh-TW"} onClick={() => setLocale("zh-TW")}>{t("language.zhTw")}</button>
    <button aria-pressed={locale === "en"} onClick={() => setLocale("en")}>{t("language.en")}</button>
  </div>;
}
```

- [ ] **Step 5: Run i18n and existing frontend tests.**

Run: `npm test -- --run tests/i18n.test.jsx tests/app.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/v2g-integration-app/src/i18n apps/v2g-integration-app/src/components/LanguageSwitcher.jsx apps/v2g-integration-app/src/main.jsx apps/v2g-integration-app/src/App.jsx apps/v2g-integration-app/tests/i18n.test.jsx
git commit -m "feat(v2g): add traditional chinese i18n foundation"
```

### Task 2: Persist deterministic simulator operational-analysis data

**Files:**
- Create: `apps/v2g-integration-app/services/v2g-api/migrations/versions/0002_v2g_operational_workspace.py`
- Modify: `apps/v2g-integration-app/services/v2g-api/src/v2g/models.py`
- Modify: `apps/v2g-integration-app/services/v2g-api/src/v2g/seed.py`
- Modify: `apps/v2g-integration-app/services/v2g-api/src/v2g/repository.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_workspace_seed.py`

**Interfaces:**
- Produces models `InverterReading`, `StringReading`, `WorkOrder`, and `WorkOrderEvent`.
- `seed_demo_fleet()` persists five deterministic inverter rows, per-inverter string readings, three work orders, and one append-only work-order event per seeded work order.
- Repository exposes `list_work_orders(site_id)`, `append_work_order_event(work_order_id, event_type, payload)`, and test-only `create_schema()` creates all metadata.

- [ ] **Step 1: Write failing deterministic-seed tests.**

```python
async def test_seed_creates_simulated_analysis_and_work_order_rows(repository, session):
    await seed_demo_fleet(session)
    assert await repository.count_inverter_readings("demo-v2g-site") == 5
    assert await repository.count_string_readings("demo-v2g-site") == 40
    orders = await repository.list_work_orders("demo-v2g-site")
    assert [order.state for order in orders] == ["open", "in_progress", "completed"]
```

- [ ] **Step 2: Run seed test to verify failure.**

Run: `.venv/bin/pytest tests/test_workspace_seed.py -q`

Expected: FAIL because the operational models and repository methods do not exist.

- [ ] **Step 3: Add models and migration with explicit indexes/foreign keys.**

```python
class WorkOrder(Base):
    __tablename__ = "work_orders"
    work_order_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    site_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("evses.asset_id", ondelete="RESTRICT"))
    source_alarm_code: Mapped[str | None] = mapped_column(String(128))
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    assigned_team: Mapped[str] = mapped_column(String(128), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

The migration creates matching PostgreSQL grants for the restricted runtime role: `SELECT`/`INSERT` only for immutable event tables and no `UPDATE`/`DELETE` permission for `audit_records` or `work_order_events`.

- [ ] **Step 4: Extend deterministic seed data.**

```python
InverterReading(
    inverter_id="inv-01",
    site_id=DEMO_SITE_ID,
    ac_power_kw=18.2,
    dc_power_kw=19.1,
    temperature_c=42.0,
    efficiency_percent=95.3,
    communication_state="good",
    occurred_at=at,
)
```

Generate eight `StringReading` values per inverter using a deterministic arithmetic deviation from its inverter median; do not use random values. Label all source rows `simulated`.

- [ ] **Step 5: Run focused seed and repository tests.**

Run: `.venv/bin/pytest tests/test_workspace_seed.py tests/test_repository.py -q`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/v2g-integration-app/services/v2g-api/migrations apps/v2g-integration-app/services/v2g-api/src/v2g/models.py apps/v2g-integration-app/services/v2g-api/src/v2g/seed.py apps/v2g-integration-app/services/v2g-api/src/v2g/repository.py apps/v2g-integration-app/services/v2g-api/tests/test_workspace_seed.py
git commit -m "feat(v2g): seed operational analysis simulator data"
```

### Task 3: Add typed diagnostics, operations, and analytics API contracts

**Files:**
- Modify: `apps/v2g-integration-app/services/v2g-api/src/v2g/contracts.py`
- Modify: `apps/v2g-integration-app/services/v2g-api/src/v2g/app.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/workspace.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_workspace_api.py`

**Interfaces:**
- Produces fixed-site endpoints `/diagnostics`, `/inverters`, `/inverters/{asset_id}/trend`, `/events`, `/work-orders`, and `/analytics`.
- Produces `PATCH /api/v1/work-orders/{work_order_id}` that requires `{actor, reason, state}` and only allows `open -> in_progress -> completed` or `in_progress -> open` simulator transitions.
- Every response uses strict Pydantic models, finite numeric values, timezone-aware timestamps, and explicit `simulated: true` metadata.

- [ ] **Step 1: Write failing API contract tests.**

```python
def test_analytics_returns_simulated_efficiency_string_and_event_aggregates(client):
    response = client.get("/api/v1/sites/demo-v2g-site/analytics", params={"from": START, "to": END})
    assert response.status_code == 200
    body = response.json()
    assert body["simulated"] is True
    assert {"site_efficiency", "inverters", "strings", "events"} <= body.keys()

def test_work_order_transition_requires_actor_reason_and_audits(client):
    response = client.patch("/api/v1/work-orders/work-001", json={"state": "in_progress"})
    assert response.status_code == 422
```

- [ ] **Step 2: Run API tests to verify failure.**

Run: `.venv/bin/pytest tests/test_workspace_api.py -q`

Expected: FAIL with 404 responses.

- [ ] **Step 3: Implement immutable read-model services.**

```python
class WorkspaceReadModel:
    async def diagnostics(self, site_id: str) -> DiagnosticsResponse: ...
    async def inverters(self, site_id: str) -> InvertersResponse: ...
    async def analytics(self, site_id: str, from_: datetime, to: datetime) -> AnalyticsResponse: ...

class WorkOrderService:
    async def transition(self, work_order_id: str, state: WorkOrderState, *, actor: str, reason: str) -> WorkOrderResponse: ...
```

`analytics()` calculates site efficiency as `sum(ac_power_kw) / sum(dc_power_kw) * 100` only when the denominator is positive; otherwise returns `None` and UI renders `—`. It derives event aggregates from the persisted alarm lifecycle and never queries arbitrary metrics.

- [ ] **Step 4: Add routes with existing fixed-site enforcement.**

```python
@app.get("/api/v1/sites/{site_id}/analytics", response_model=AnalyticsResponse)
async def analytics(site_id: str, from_: datetime = Query(alias="from"), to: datetime = Query(...)):
    _require_demo_site(site_id)
    return await get_workspace_read_model().analytics(site_id, from_, to)
```

- [ ] **Step 5: Run API and audit-safety suites.**

Run: `.venv/bin/pytest tests/test_workspace_api.py tests/test_api.py tests/test_postgres_audit_integration.py -q`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/v2g-integration-app/services/v2g-api/src/v2g/contracts.py apps/v2g-integration-app/services/v2g-api/src/v2g/workspace.py apps/v2g-integration-app/services/v2g-api/src/v2g/app.py apps/v2g-integration-app/services/v2g-api/tests/test_workspace_api.py
git commit -m "feat(v2g): expose localized scada workspace contracts"
```

### Task 4: Build the localized workspace shell and Overview/Monitoring views

**Files:**
- Create: `apps/v2g-integration-app/src/features/overview/SiteOverviewPage.jsx`
- Create: `apps/v2g-integration-app/src/features/overview/FleetOverviewPage.jsx`
- Create: `apps/v2g-integration-app/src/features/overview/DiagnosticsPage.jsx`
- Create: `apps/v2g-integration-app/src/features/monitoring/EventManagementPage.jsx`
- Create: `apps/v2g-integration-app/src/features/monitoring/LiveMonitoringPage.jsx`
- Create: `apps/v2g-integration-app/src/features/monitoring/InverterMonitoringPage.jsx`
- Create: `apps/v2g-integration-app/src/components/ScadaSidebar.jsx`
- Create: `apps/v2g-integration-app/src/components/PageState.jsx`
- Modify: `apps/v2g-integration-app/src/App.jsx`
- Modify: `apps/v2g-integration-app/src/api/client.js`
- Modify: `apps/v2g-integration-app/src/styles.css`
- Test: `apps/v2g-integration-app/tests/overview.test.jsx`
- Test: `apps/v2g-integration-app/tests/monitoring.test.jsx`

**Interfaces:**
- `v2gApi.getDiagnostics()`, `getInverters()`, `getEvents(filters)`, and existing overview/fleet/historian/alarm calls return typed API JSON.
- `ScadaSidebar` accepts `{ activeView, onSelect, alarmCount }` and renders Chinese domain labels from `t()`.
- Pages receive `{ data, state, error }` and must render localized loading, empty, error, and stale states.

- [ ] **Step 1: Write failing overview/monitoring UI tests.**

```jsx
test("uses Chinese grouped navigation and opens the event management workspace", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "事件管理" }));
  expect(await screen.findByRole("heading", { name: "事件管理" })).toBeVisible();
  expect(screen.getByText("嚴重度")).toBeVisible();
});

test("renders diagnostics freshness as an operational state", () => {
  render(<DiagnosticsPage data={{ simulated: true, assets: [{ asset_id: "evse-03", freshness: "stale" }] }} state="ready" />);
  expect(screen.getByText("資料可能已過期")).toBeVisible();
});
```

- [ ] **Step 2: Run UI tests to verify failure.**

Run: `npm test -- --run tests/overview.test.jsx tests/monitoring.test.jsx`

Expected: FAIL because no localized grouped page components exist.

- [ ] **Step 3: Refactor the sidebar into real localized views.**

```jsx
const groups = [
  { key: "overview", label: t("nav.overview"), items: ["siteOverview", "fleetOverview", "diagnostics"] },
  { key: "monitoring", label: t("nav.monitoring"), items: ["events", "liveMonitoring", "inverters"] },
  { key: "operations", label: t("nav.operations"), items: ["dispatch", "operationsLog", "workOrders"] },
  { key: "analytics", label: t("nav.analytics"), items: ["siteEfficiency", "inverterEfficiency", "stringHealth", "eventAnalysis"] },
];
```

Do not create a Reports group. Keep direct keyboard focus on each real selected view; do not use inactive fake buttons.

- [ ] **Step 4: Implement visual pages from real contracts.**

- Site overview: KPI strip, trend, fleet matrix, dispatch posture, attention rail.
- Fleet overview: EVSE tiles, active sessions, imported/exported energy, selected device detail.
- Diagnostics: freshness strip, communication state, telemetry-gap list, active alarm summary.
- Event management: severity/state/asset filters and selected event detail.
- Live monitoring: trend, capacity, session distribution, freshness.
- Inverter monitoring: latest AC/DC power, temperature, efficiency, communication state, and selected trend.

All calculated/seeded panels render `模擬資料` or `模擬計算` from the message dictionary.

- [ ] **Step 5: Run the focused frontend suite and production build.**

Run: `npm test -- --run tests/i18n.test.jsx tests/overview.test.jsx tests/monitoring.test.jsx tests/app.test.jsx && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add apps/v2g-integration-app/src apps/v2g-integration-app/tests
git commit -m "feat(v2g): add localized overview and monitoring workspaces"
```

### Task 5: Build localized Operations and Analytics workspaces

**Files:**
- Create: `apps/v2g-integration-app/src/features/operations/OperationsLogPage.jsx`
- Create: `apps/v2g-integration-app/src/features/operations/WorkOrdersPage.jsx`
- Create: `apps/v2g-integration-app/src/features/analytics/SiteEfficiencyPage.jsx`
- Create: `apps/v2g-integration-app/src/features/analytics/InverterEfficiencyPage.jsx`
- Create: `apps/v2g-integration-app/src/features/analytics/StringHealthPage.jsx`
- Create: `apps/v2g-integration-app/src/features/analytics/EventAnalysisPage.jsx`
- Modify: `apps/v2g-integration-app/src/features/dispatch/DispatchPage.jsx`
- Modify: `apps/v2g-integration-app/src/components/CommandApprovalDialog.jsx`
- Modify: `apps/v2g-integration-app/src/App.jsx`
- Modify: `apps/v2g-integration-app/src/api/client.js`
- Modify: `apps/v2g-integration-app/src/styles.css`
- Test: `apps/v2g-integration-app/tests/operations-workspace.test.jsx`
- Test: `apps/v2g-integration-app/tests/analytics.test.jsx`

**Interfaces:**
- `v2gApi.getWorkOrders()`, `transitionWorkOrder(id, { state, actor, reason })`, and `getAnalytics({ from, to })` consume Task 3 routes.
- `WorkOrdersPage` refreshes only its local record after a successful transition and never exposes a remote-control action.
- Analytics pages consume the `AnalyticsResponse` aggregate and render `—` for `null` calculations.

- [ ] **Step 1: Write failing Operations/Analytics tests.**

```jsx
test("requires a reason before a simulated work order transition", async () => {
  render(<WorkOrdersPage data={fixture} state="ready" onTransition={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "開始處理" }));
  expect(screen.getByText("請填寫處理原因")).toBeVisible();
});

test("marks calculated efficiency as simulated and displays string outliers", () => {
  render(<StringHealthPage data={fixture} state="ready" />);
  expect(screen.getByText("模擬計算")).toBeVisible();
  expect(screen.getByText("偏差過高")).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests to verify failure.**

Run: `npm test -- --run tests/operations-workspace.test.jsx tests/analytics.test.jsx`

Expected: FAIL because the new pages and clients are missing.

- [ ] **Step 3: Localize and preserve dispatch safety.**

Use the existing eligibility gate unchanged. Replace copy with `t()` keys for `核准模擬指令`, `拒絕模擬指令`, constraints, expiry, confidence, projected SOC, and action errors. Approval/rejection must continue to require a non-empty reason.

- [ ] **Step 4: Implement work-order lifecycle and activity log.**

```jsx
const allowedTransitions = {
  open: [{ state: "in_progress", label: t("workOrders.start") }],
  in_progress: [{ state: "completed", label: t("workOrders.complete") }, { state: "open", label: t("workOrders.reopen") }],
  completed: [],
};
```

Render the linked asset/alarm, status, severity, team, timeline, and localized state labels. Do not render a work-order transition as a device command.

- [ ] **Step 5: Implement analysis visualizations.**

- Site efficiency: actual/expected/availability KPI strip and period comparison.
- Inverter efficiency: sortable comparison table and selected inverter trend.
- String health: accessible labelled grid with current/voltage/health variance and explicit outlier threshold.
- Event analysis: severity/source distribution, recurring codes, duration, and a trend over selected range.

- [ ] **Step 6: Run frontend suite and build.**

Run: `npm test -- --run tests/operations-workspace.test.jsx tests/analytics.test.jsx tests/command-approval.test.jsx && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add apps/v2g-integration-app/src apps/v2g-integration-app/tests
git commit -m "feat(v2g): add localized operations and analytics workspaces"
```

### Task 6: Integrate, harden, document, and verify the full simulator stack

**Files:**
- Modify: `apps/v2g-integration-app/README.md`
- Modify: `apps/v2g-integration-app/docs/operator-walkthrough.md`
- Modify: `apps/v2g-integration-app/docs/simulator-safety-boundary.md`
- Modify: `apps/v2g-integration-app/scripts/smoke_test_v2g_stack.sh`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_workspace_api.py`
- Test: `apps/v2g-integration-app/tests/app.test.jsx`

**Interfaces:**
- Docker retains loopback-only UI/API ports and separate migration/runtime database roles.
- Smoke test checks the Chinese default UI, language switch, overview API, analytics API, and no external-control string patterns in V2G API source.

- [ ] **Step 1: Add a failing smoke assertion for Chinese default UI and workspace endpoints.**

```bash
curl --fail http://127.0.0.1:${V2G_API_PORT}/api/v1/sites/demo-v2g-site/analytics
curl --fail http://127.0.0.1:${V2G_API_PORT}/api/v1/sites/demo-v2g-site/diagnostics
curl --fail http://127.0.0.1:${V2G_UI_PORT} | grep -q 'V2G SCADA'
```

- [ ] **Step 2: Run smoke test to verify failure before updating it.**

Run: `./scripts/smoke_test_v2g_stack.sh`

Expected: FAIL until the new API routes exist.

- [ ] **Step 3: Update smoke coverage and operator documents.**

Document the Chinese-default setting, English switcher, four supported domains, simulated work-order boundary, generated analysis data, range controls, reset procedure, and the fact that Reports are deliberately out of scope.

- [ ] **Step 4: Run full quality verification.**

Run:

```bash
cd apps/v2g-integration-app/services/v2g-api && .venv/bin/pytest tests -q
cd ../../.. && cd apps/v2g-integration-app && npm test -- --run && npm run build
docker compose up --build -d
./scripts/smoke_test_v2g_stack.sh
docker compose down
```

Expected: backend tests pass, frontend tests pass, production build passes, and the isolated stack reports healthy API/UI/analytics/diagnostics responses.

- [ ] **Step 5: Browser verification using the in-app browser.**

Start the stack and verify the default Chinese sidebar, switch to English and back, navigate every real view, inspect a stale/empty/error state using test fixtures or API failure simulation, and confirm no Reports group is rendered.

- [ ] **Step 6: Commit.**

```bash
git add apps/v2g-integration-app
git commit -m "docs(v2g): verify traditional chinese scada workspace"
```

## Plan self-review

- **Spec coverage:** Tasks 1–6 cover locale default/persistence, four functional domains, new deterministic simulator data, typed APIs, local audit-gated operations, safety labels, no Reports route, documentation, Docker smoke, and browser verification.
- **Placeholder scan:** No task relies on unspecified routes, unspecified models, or generic test instructions; all changed units, route names, expected states, and commands are explicit.
- **Type consistency:** Task 2 defines persisted names; Task 3 exposes their typed read models; Tasks 4–5 consume the named client methods; Task 6 verifies the same route names.
