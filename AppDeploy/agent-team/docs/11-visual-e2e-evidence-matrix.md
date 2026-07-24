# Verde EMS AgentCrew MVP — Visual E2E Evidence Matrix

**Status:** Live PostgreSQL EMS and report revision confirmation verified in-app; full desktop/narrow evidence archive pending  
**Owner:** Evidence Collector  
**Dependencies:** `07-agentcrew-ux-and-ui-spec.md`, `08-frontend-implementation-handoff.md`, `10-api-test-plan-and-contract-matrix.md`  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)

Local verification completed for the valid site launcher, ready drawer, current-site label, memory/persona control, composer, and desktop/narrow responsive states using the required in-app browser. The report revision confirmation, retention, insufficiency, and bounded repair logic are covered by API/component and live database regression tests, but their in-app/browser archive evidence is still pending.

The 2026-07-24 live PostgreSQL run additionally verified the EMS tab and live data region, the site-scoped AgentCrew drawer, the current-site context label, approval-required state for a Data Analysis Specialist read, approved execution, routing status, structured-output validation, and the visible current-site specialist result panel. The panel displayed the completed result plus evidence count and retained source-lineage messaging. The same run verified the report chain through the in-app drawer, including the report-generation handoff, validated structured output, a sanitized `DRAFT PREVIEW · NOT FINAL` state, and explicit confirmation into `CONFIRMED REVISION · V2`. A 375px-wide in-app viewport check also verified the drawer remains visible without horizontal overflow.

Use the required in-app browser after starting the Vite app. Capture desktop and narrow viewport evidence for: portfolio-hidden AgentCrew, valid site launcher, ready drawer, routing/handoff timeline, approval card, approve-all session indicator, completed specialist result, insufficient-data warning, interrupted/resume state, failed validation, sanitized report preview, Reports draft, Agent Audit timeline, and confirmed revision state.

Each evidence record must include workflow ID, fixture, route, viewport, screenshot path, expected visible state, actual result, and known gaps. Naming: `agentcrew-<workflow>-<state>-<viewport>.png`. Evidence is not accepted from a standalone Playwright run.

## EMS database-backed evidence captured

| Workflow | Route / viewport | Expected | Actual | Evidence state |
|---|---|---|---|---|
| EMS live retrieval | `site/tokyo-campus/ems`, desktop in-app browser | Live source, fresh quality metadata, and site assets are visible; fixture fallback is not used | `PostgreSQL / live read`, `fresh`, `valid`, `2` assets displayed | Verified in-app on 2026-07-24 |
| EMS current-data dashboard | `site/taoyuan-logistics/ems`, desktop + 375px in-app browser | Live PostgreSQL KPI strip and charts use only returned metrics; missing metrics remain explicitly unavailable; no horizontal overflow | `PostgreSQL／即時讀取`, `fresh`, `valid`, `3564 kWh`, `88%` performance ratio, irradiance/temperature shown as `沒有有效資料`; desktop and mobile have no horizontal overflow | Verified in-app on 2026-07-24 |
| AgentCrew ready drawer | `site/tokyo-campus/ems`, desktop in-app browser | Site-scoped drawer, current-site label, approved actions | Site-scoped AgentCrew drawer with Tokyo Campus context, current-site-only notice, composer, and specialist shortcuts | Verified in-app on 2026-07-24 |
| AgentCrew approval, validation, and result | `site/tokyo-campus/ems`, desktop in-app browser | Approval gate, Data Analysis routing, validated output, and visible current-site result | Approval-required card, `Approve step`, `Routed to Data Analysis Specialist`, `Structured output validated`, `Specialist result · current site`, `2 evidence records · source lineage retained` | Verified in-app on 2026-07-24 |
| AgentCrew report chain and draft preview | `site/tokyo-campus/overview`, desktop in-app browser | Report-generation handoff, validated output, and sanitized non-final preview | `Routed to Report Generation Specialist`, `report_generation_specialist → data_analysis_specialist → report_generation_specialist`, `Structured output validated`, `DRAFT PREVIEW · NOT FINAL` | Verified in-app on 2026-07-24 |
| AgentCrew report revision confirmation | `site/tokyo-campus/overview`, desktop in-app browser | A draft can be explicitly confirmed into a new visible revision; repeat confirmation is idempotent | `CONFIRMED REVISION · V2` visible after `Confirm report revision`; confirmation action removed; durable revision is covered by the API/database regression test | Verified in-app on 2026-07-24 |

The captured live-panel screenshot is retained in the task evidence stream. The complete desktop/narrow screenshot archive, including report confirmation, insufficiency, repair, retention scheduling, and source-lineage states, remains outstanding; the narrow viewport was checked for visible drawer layout and horizontal overflow but has not yet been archived as a complete evidence set.
