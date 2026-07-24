# Current-Data EMS Dashboard Design

**Status:** Approved for specification review  
**Date:** 2026-07-24  
**Audience:** Energy manager  
**Scope:** Existing site workspace EMS tab, using only data products currently available from the local PostgreSQL-backed EMS service

## 1. Purpose

Turn the existing site EMS tab into an energy-manager-first analytics workspace that makes the available time-series and calculated data useful without presenting unsupported values as live telemetry.

The dashboard must be honest about the current data boundary. It will use the database-backed site snapshot, canonical observations, persisted derived metrics, and retrieval quality/freshness metadata. Demand forecasts, storage state, charger telemetry, export plans, commercial inventory, revenue, and emissions are future data products and must appear as unavailable—not as fabricated zeroes or fixture-backed live values.

## 2. Product outcome

An energy manager opening a site should be able to answer four questions quickly:

1. How much energy has this site produced or recorded in the selected window?
2. What do the energy and weather time series show, and where are the gaps?
3. How is the site performing according to the persisted performance ratio?
4. Can I trust these values, and can I trace them back to their source and calculation window?

The existing site shell, site tabs, AgentCrew drawer, language switcher, theme switcher, and hash routing remain unchanged.

## 3. Data boundary and source mapping

The browser reads only the FastAPI REST boundary. It never calls PostgreSQL or FastMCP directly.

| Dashboard need | Current source | Display rule |
|---|---|---|
| Site identity and assets | `GET /api/v1/sites/{site_code}` | Show site identity, timezone, capacity, and returned assets. |
| Raw/current observations | `GET /api/v1/sites/{site_code}/observations` | Request bounded, site-local windows and explicit metric codes. Preserve timestamp, unit, value, and quality metadata. |
| Energy observations | `GET /api/v1/sites/{site_code}/energy` | Use `energy_kwh`; do not relabel it as `kW` or sum it as power. |
| Persisted calculated values | `GET /api/v1/sites/{site_code}/reports` | Use `performance_ratio` only when the response includes a valid derived record. |
| Metric availability | `GET /api/v1/sites/{site_code}/metrics` | Use the catalog to mark supported metrics and clearly label unavailable families. |
| Freshness and quality | Retrieval envelope on each response | Show freshness, quality state, score, flags, source lineage, and calculation metadata when present. |

Every request and view-model record remains scoped to the active external `site_id`. The UI must not infer site identity from a display name or reuse another site’s data.

### Currently supported metric families

- `energy_kwh`
- `irradiance_w_m2`
- `temperature_c`
- `performance_ratio`

### Explicitly unavailable in this design

- Demand and generation forecasts
- Storage SOC, SOH, reserve, and round-trip efficiency
- Charger/V2G availability and utilization
- Export commitments, inventory, settlement, and revenue
- Emissions and EUI
- Forecast error and forecast bias

Unavailable metrics may be listed in a compact “Not connected in this data profile” section, but they must not occupy the primary analytical hierarchy.

## 4. Information architecture

The EMS tab is organized in this order:

### 4.1 Data-health banner

The first element is a compact, high-signal banner containing:

- Source: `PostgreSQL / live read`, fixture, or unavailable
- Last observation timestamp and age
- Freshness state: fresh, stale, or unknown
- Quality state: valid, degraded, insufficient, or rejected
- Coverage/point count when provided
- A short notice for stale, missing, duplicate, unit-mismatch, or contradictory data

The banner must not say “live” when the API is unavailable or a fallback is being shown.

### 4.2 KPI strip

The KPI strip contains only values supported by the current response:

- Energy in selected window
- Latest energy observation
- Performance ratio
- Latest irradiance
- Latest temperature
- Observed points / expected points, when coverage metadata exists

Each KPI shows its unit, observation/calculation time, and quality state in text. A missing metric displays “Not available” with an explanation, never zero.

### 4.3 Energy time-series panel

The main panel displays `energy_kwh` over a bounded site-local time window.

- Default window: last 24 hours or the latest available seeded window when the source timestamps are historical.
- Options: 24 hours and 7 days, disabled when the backend cannot provide the requested range.
- The x-axis uses the site timezone.
- Missing observations render as visible gaps.
- Hover/focus details show timestamp, value, unit, quality, and source reference.
- The panel includes a compact text summary for screen readers and a table/list alternative for keyboard users.

No second series is placed on the energy axis unless it has the same unit and semantic grain.

### 4.4 Weather context panels

Irradiance and temperature are displayed as separate small panels so incompatible units are not mixed:

- Irradiance: `W/m²`
- Temperature: `°C`

Each panel shows latest value, window range, and a small line chart or data list. The panels retain quality markers and visibly distinguish a missing or stale interval.

### 4.5 Calculated performance panel

The calculated panel presents persisted `performance_ratio` with provenance:

- Value and unit/semantic label
- Formula version
- Calculation timestamp
- Period start/end and grain
- Input/source count
- Quality state and flags
- Source-window or lineage reference when supplied

If no valid derived record exists, the panel explains that the calculation is unavailable for the selected window. The UI must not calculate a replacement value in the browser.

### 4.6 Workflow context

Existing EMS workflow rows remain below the live analytics. They communicate workflow readiness, ownership, cadence, and recommended review actions. Any metric in a workflow row that is not backed by the current API response must be marked as contextual/demo configuration or removed from the live-metric presentation.

## 5. View-model boundary

Introduce a focused EMS view model between API responses and JSX:

```text
EmsDashboard
  receives: { siteContext, snapshot, observations, derivedMetrics, metricCatalog }
  produces: { health, kpis, energySeries, weatherSeries, performance, unavailableMetrics, workflows }
```

The view model is responsible for:

- Normalizing response envelopes.
- Keeping metric code, unit, timestamp, and quality metadata together.
- Sorting records by observation time.
- Separating energy, irradiance, and temperature series.
- Formatting values by unit and locale.
- Identifying missing/unsupported metrics.
- Passing formula and lineage metadata through unchanged.

The view model must not invent freshness, coverage, forecast confidence, derived values, or quality flags.

## 6. Component boundary

The EMS branch should be extracted from the monolithic app surface into focused components without changing global navigation:

```text
src/ems/
  EmsDashboard.jsx
  EmsDataHealth.jsx
  EmsKpiStrip.jsx
  EmsEnergyPanel.jsx
  EmsWeatherPanel.jsx
  EmsPerformancePanel.jsx
  emsViewModel.js
  emsFormatters.js
```

Existing chart rendering may remain SVG-based. A chart library is not required for this slice.

## 7. State and error behavior

Every dashboard section supports these states:

- **Loading:** preserve headings and use layout-matched skeletons.
- **Fresh/valid:** show the value and provenance.
- **Stale/degraded:** show last-known time, age, and affected quality notice.
- **Insufficient:** omit unsafe KPI/chart values and explain the missing input.
- **Empty:** distinguish “no records in this window” from an API failure.
- **Unavailable:** label the source/API failure and offer retry.
- **Fallback/demo:** clearly say fixture/demo; never say PostgreSQL/live.
- **Unauthorized/site mismatch:** fail closed and preserve no data from the prior site.

Errors should be concise, actionable, and bilingual wherever the surrounding UI is bilingual.

## 8. Responsive and accessibility requirements

- Desktop: KPI strip followed by an 8/4 analytical split when space allows; weather and performance panels remain readable.
- Tablet: collapse to one column while keeping the energy chart before secondary context.
- Mobile: stack panels, allow horizontal scrolling for the time axis, and keep every control at least 44px high.
- Site tabs retain semantic tab behavior and visible selected state.
- Charts expose units, time range, and text summaries; color is never the sole quality/status signal.
- Focus rings remain visible in both themes.
- Respect reduced-motion preferences.
- Loading, refresh, and error transitions use polite live-region announcements.

## 9. Acceptance criteria

1. The normal browser path requests site snapshot, observations/energy, derived reports, and metric catalog from FastAPI.
2. The main energy chart values originate from the API response, not `site-detail-workspaces.json`.
3. The dashboard displays energy, irradiance, temperature, and performance ratio with correct units.
4. A missing or stale point is not rendered as zero or described as current.
5. Performance ratio displays its calculation/provenance metadata when returned.
6. Unsupported metric families are explicitly labeled unavailable.
7. Switching site context cannot display the prior site’s observations or derived metric.
8. Loading, valid, degraded, insufficient, empty, unavailable, and fallback states have distinct visible copy.
9. The dashboard passes frontend component tests and a production build.
10. In-app browser evidence verifies desktop and narrow layouts, live PostgreSQL data, time-series rendering, calculated metric provenance, and an unavailable-metric state.

## 10. Out of scope for this slice

- Adding new database metric families.
- Creating forecasts or storage/charger simulation data.
- Browser-side calculation of production KPIs.
- Direct MCP calls from the frontend.
- Replacing the global shell, site routing, AgentCrew drawer, or existing app framework.

