# Traditional-Chinese V2G SCADA Workspace Design

## Goal

Turn the local V2G simulator into a Traditional-Chinese-first operator workspace with a persistent, domain-grouped navigation model and meaningful simulator-backed content for 總覽, 監控, 維運, and 分析.

## Product boundary

- This remains a local simulator. It never opens an OCPP, EVSE, vehicle, utility, or grid-control connection.
- Every simulated dispatch action remains human-approved, reason-gated, and audit-recorded.
- Traditional Chinese (`zh-TW`) is the initial language. English (`en`) is an explicit user-selectable alternative.
- Reports are not in this release. The sidebar must not imply that report generation is available.

## Rationale

The operator workspace follows the practical SCADA flow of HMI visibility, centralized alarms, historian trends, analysis, and reporting rather than presenting a flat set of unrelated pages. NIST describes SCADA control centers as providing HMI display, centralized alarming, historian logging, trend analysis, and reporting. OCPP 2.0.1 adds device management, monitoring, transaction handling, security, and smart-charging capabilities that make fleet health, events, configuration context, and dispatch review first-class operator concerns.

Sources:

- [NIST SP 800-82 Rev. 3](https://csrc.nist.gov/pubs/sp/800/82/r3/final)
- [Open Charge Alliance: OCPP 2.0.1](https://openchargealliance.org/protocols/open-charge-point-protocol/)
- [Open Charge Alliance: OCPP 2.0.1 device model and monitoring](https://openchargealliance.org/wp-content/uploads/2023/07/new_in_ocpp_201-v10.pdf)

## Information architecture

The sidebar is expanded by default on desktop and becomes a compact grouped navigation pattern on narrow screens. Each group opens a real view; there are no visually active placeholder routes.

| Group | Traditional Chinese label | Initial views | Purpose |
| --- | --- | --- | --- |
| Overview | 總覽 | 電站總覽, 車隊總覽, 即時診斷 | Understand site state and whether it needs attention. |
| Monitoring | 監控 | 事件管理, 即時運轉監控, 變流器監控 | Monitor alarms, device state, telemetry freshness, and simulated inverter health. |
| Operations | 維運 | 調度監督, 維運日誌, 工單總覽 | Review simulator dispatch, audit its lifecycle, and manage simulated follow-up work. |
| Analytics | 分析 | 電站運轉效率, 變流器效率, 串列監測, 事件分析 | Compare performance, detect deviations, and investigate event patterns. |

## Global app shell

- Default language: `zh-TW`; the language control has an accessible name and shows `繁中` / `EN`.
- Header: current site name, simulator state, current data freshness, and an immutable `模擬環境・無外部控制` boundary label.
- Sidebar: domain icons, a selected view indicator, active alarm count beside 事件管理, and a small freshness state. Labels do not rely on icon meaning alone.
- Content frame: one page header plus a compact command bar where a page genuinely needs a time-range, severity, asset, or state filter. No generic nested-card stack.
- States: loading skeleton, empty state, error state, stale-data warning, and simulated-only notice use localized copy.

## View designs

### 1. 總覽 / Overview

#### 電站總覽

The default landing page. It combines current site power, available flexible capacity, EVSE availability, active alarms, a site-power trajectory, fleet matrix, dispatch posture, and attention rail. It becomes more useful by showing the relationships between current power, fleet capacity, alarms, and pending advice on one screen.

#### 車隊總覽

Shows EVSE availability tiles, active session count, charging/imported energy, unavailable devices, and a selected-device drill-in. It uses the existing simulator fleet/session records.

#### 即時診斷

Shows a data-quality/freshness strip, communication-health state per simulator asset, top active alarms, and recent telemetry gaps. It must clearly distinguish `fresh`, `stale`, and `unavailable` data.

### 2. 監控 / Monitoring

#### 事件管理

Shows a filterable event timeline grouped by severity, source asset, code, raised time, cleared time, and lifecycle state. Filters are severity, asset, and state. A selected row opens an inline detail panel with related simulated telemetry and any generated work item.

#### 即時運轉監控

Shows current site-power trajectory, EVSE state distribution, active sessions, flexible capacity, and freshness. It reuses the simulator historian; it is not a real-time control panel.

#### 變流器監控

Shows simulated inverter cards/table rows with AC power, DC power, temperature, efficiency, communication status, and alarm count. A selected inverter reveals a trend chart and recent events.

### 3. 維運 / Operations

#### 調度監督

Retains the existing human-in-the-loop workflow. It shows the recommendation rationale, constraints, projected state of charge, expected impact, expiry, confidence, and immutable audit history. The only action remains `核准模擬指令` or `拒絕模擬指令`; both require a reason.

#### 維運日誌

Shows simulated operational log entries produced from alarms, command state transitions, and work-order changes. Entries are read-only, time ordered, and filterable by source type.

#### 工單總覽

Shows simulator work items created from selected active alarms or seeded scenarios. A work item has status (`待處理`, `處理中`, `已完成`), severity, assigned team, linked asset/event, creation time, and a local-only activity log. State changes are audit-recorded but are not remote device actions.

### 4. 分析 / Analytics

#### 電站運轉效率

Shows daily energy, expected versus actual output, rolling availability, performance ratio, and a date-range comparison. Values are calculated from simulator historian data and labeled as simulated calculations.

#### 變流器效率

Shows a sortable comparison of inverter efficiency, DC-to-AC power ratio, temperature, and deviation from fleet median. A selected asset provides a time-series comparison.

#### 串列監測

Shows a heatmap-like grid of simulated string current/voltage/health variance by inverter. It exposes outliers with a visible threshold and does not claim a real electrical measurement source.

#### 事件分析

Shows event counts by severity/source, duration distribution, recurring codes, and an event-to-telemetry correlation view over the selected period.

## Data and API design

Existing overview, fleet, historian, alarm, recommendation, command, and audit contracts remain stable. New read-only simulator aggregates are added behind the V2G API:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/sites/{site_id}/diagnostics` | Asset communication, freshness, telemetry-gap, and alarm summary. |
| `GET /api/v1/sites/{site_id}/inverters` | Simulated inverter state and latest measurements. |
| `GET /api/v1/sites/{site_id}/inverters/{asset_id}/trend` | Per-inverter selected metric and range. |
| `GET /api/v1/sites/{site_id}/events` | Filtered alarm/event lifecycle timeline. |
| `GET /api/v1/sites/{site_id}/work-orders` | Read-only simulator work-order list and details. |
| `PATCH /api/v1/work-orders/{id}` | Local simulator work-order state change, actor/reason required, audited. |
| `GET /api/v1/sites/{site_id}/analytics` | Site efficiency, inverter comparison, string-health, and event aggregates. |

New persisted simulator models are `inverter_readings`, `string_readings`, `work_orders`, and `work_order_events`. They follow the current append-only audit approach. Their generated sample data is deterministic, site-scoped, timezone-aware, and identifies its source as simulated.

## i18n design

- Store messages in `src/i18n/zh-TW.js` and `src/i18n/en.js` using identical message keys.
- Add an `I18nProvider` with `locale`, `setLocale`, and `t(key, values)`.
- Persist explicit user choice in browser storage; otherwise default to `zh-TW`.
- Translate all visible UI copy, status labels, dates, number units, errors, empty states, accessibility labels, and dialog copy.
- API identifiers, persisted enum values, metric codes, and audit event types remain English/stable. API responses may add localized display labels only when they do not replace identifiers.

## Safety and failure handling

- Existing simulator-only boundary text remains visible in every view.
- Missing/non-finite simulator values render `—` and a localized explanation; they never become a zero value.
- Stale source data makes calculated KPI cards visibly stale and prevents a recommendation from appearing actionable.
- Work-order updates require non-empty actor and reason and create an append-only audit event.
- No UI action, API endpoint, seed process, or simulator event may create a socket or request to an external charging, vehicle, utility, or OCPP host.

## Acceptance criteria

1. A fresh browser session opens in Traditional Chinese; English can be selected and persists across reload.
2. The sidebar shows only 總覽, 監控, 維運, and 分析, each with the specified real, selectable views.
3. The default 電站總覽 visibly contains power, capacity, EVSE availability, active alarms, a trajectory, fleet posture, dispatch posture, and attention rail.
4. Monitoring, operations, and analytics pages show data from typed simulator API contracts, not hard-coded values.
5. All new calculated values and generated records are labelled as simulated or simulated calculation where relevant.
6. Dispatch and work-order changes remain local, reason-gated, and audit-recorded.
7. Existing backend and frontend tests stay green; new API/i18n/UI behavior has focused tests; the Docker smoke test still passes.
