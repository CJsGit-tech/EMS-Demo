# Verde EMS AgentCrew MVP — Product Backlog & Acceptance

**Status:** Ready for implementation  
**Owner:** Product Lead  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)  
**Operating rules:** [AppDeploy/AGENTS.md](../../AGENTS.md)  
**Current product context:** [Site Integration App context](../../../docs/context/apps/site-integration-app/README.md)  
**Last updated:** 2026-07-22

## Product outcome

An operations manager can open an authorized EMS site from the existing map-first React/Vite dashboard, ask a site-scoped AgentCrew for help, safely approve required tool steps, and receive a useful, user-visible result. The MVP proves this with a sanitized HTML report preview saved as a draft through the chain **Router → Report Generation → Data Analysis → Report Generation**.

The MVP is complete only when all four specialist hats have passed an end-to-end workflow with routing, current-site MCP access, structured-output validation, audit logging, and user-visible output.

## Ownership, dependencies, and status

| Area | Owner | Dependencies | Status |
|---|---|---|---|
| Product scope, prioritization, acceptance, release gate | Product Lead | Grill decisions; site-integration context | Ready |
| Site workspace entry, drawer, approvals, preview, audit UI | Frontend Developer; UX Architect | Existing `#site/:siteId/:tab` route; React/Vite shell; site context contract | Not started |
| Router, run state, allowlisted handoffs | AI Engineer; Software Architect | Four skill manifests; typed run states; approval state | Not started |
| API, persistence, retries, interruption, retention | Backend Architect | PostgreSQL/service boundary; API contracts; audit/report repositories | Implemented local compatibility path; PostgreSQL adapter and migration foundation wired, live DB certification pending |
| Four base skill packages and validators | AI Engineer; Data Engineer | EMS data fixtures; schemas; validation rules; tool manifests | Not started |
| Current-site MCP gateway and payload audit | MCP Builder; Security Engineer | Active site context; authorization policy; secret redaction | Not started |
| Sanitized HTML report drafts and revisions | Report Generation specialist owner; Backend Architect; Frontend Developer | HTML sanitizer; Reports tab; draft persistence | Not started |
| Contract and end-to-end test evidence | API Tester; Evidence Collector; Reality Checker | Executable workflows; in-app browser; screenshot paths | Not started |
| Documentation and handoff records | Technical Writer | Final interfaces, commands, test/evidence results | Not started |

**Dependencies that block MVP approval:** a valid active-site context, an authorized current-site data fixture/repository, four loadable skill packages, typed AgentCrew API/run contracts, persisted audit and draft records, and the required in-app browser evidence. No cross-site behavior may be introduced to unblock a workflow.

## MVP scope

- AgentCrew is available only inside a valid, authorized site workspace; it is absent from portfolio screens.
- Four shared base hats are available through lazy-loaded skills: Site Security Manager, Device Monitoring Expert, Data Analysis Specialist, and Report Generation Specialist.
- A unified router selects the initial hat automatically. Allowlisted handoffs are automatic; tool execution requires one-step approval or “approve all for this session.”
- Every request, handoff, approval, MCP attempt/retry, validation result, scope violation, and output has a safe audit record. Hidden chain-of-thought, secrets, and credentials are never exposed or persisted.
- MCP access is limited to the current `site_id`. Out-of-scope payloads are discarded and recorded; the user is asked once per violation whether to continue after removal.
- Structured output is validated before rendering. Invalid output may be repaired at most three times; a final failure is `failed_validation` and preserves errors and any partial preview.
- Reports are sanitized, script-free, external-resource-free HTML previews with trusted inline CSS and sanitized inline SVG permitted. They save to Reports as drafts; there is no download, export, ready, or final state.
- Reports can contain conditional missing/stale/contradictory-data notices and suggested corrective actions. Users can propose revisions to selected semantic sections and must confirm before a new draft is saved.
- Skill personalization is per user and per agent, persists only after explicit approval, runs in an isolated sandbox, keeps the latest five versions, and cannot change tools, permissions, site scope, or approval policy.
- Users can view their own records in a standalone, view-only Agent Audit area, grouped by site and defaulted to the current site. Retain the latest 50 audit rounds per user/site and latest five generated report versions.
- Force-quit saves an interrupted run and displays its state.

## Prioritized user stories

Priority order is a delivery order, not a promise that every item has equal product value. P0 items are release blockers; P1 items are required for a complete MVP experience but can follow the core safety path.

### P0 — release blockers

#### AC-01 — Enter a site-scoped AgentCrew workspace

**Owner:** Frontend Developer / UX Architect  
**Dependencies:** Existing site route and authorized site data; active-site contract  
**Status:** Not started

As an operations manager, I want AgentCrew to appear only after I open an authorized site so that every question and action has an unambiguous site boundary.

**Acceptance criteria**

- [ ] Given a portfolio route, an invalid site route, or an unauthorized site, when the page renders, then no AgentCrew entry point or MCP-capable context is available.
- [ ] Given a valid authorized site route, when the site workspace renders, then the AgentCrew drawer is available and visibly identifies the active site.
- [ ] Given any AgentCrew request, when it is sent to the backend, then it carries exactly one active `site_id`, user/session context, and source route.
- [ ] Given a site change or sign-out, when the session changes, then prior session approvals cannot authorize the new site.

#### AC-02 — Route intent to a specialist and manage a run

**Owner:** AI Engineer / Software Architect  
**Dependencies:** Four skill manifests; typed contracts; session state  
**Status:** Not started

As a manager, I want the router to choose the right specialist and show safe progress so that I can complete a task without manually orchestrating agents.

**Acceptance criteria**

- [ ] Given an intent about security, devices, analysis, or reports, when a run starts, then the matching hat is loaded automatically without a route-approval prompt.
- [ ] Given a report request requiring insights, when Report Generation runs, then the allowlisted handoff is `Report Generation → Data Analysis → Report Generation`.
- [ ] Given an active run, when progress is shown, then the UI exposes the active hat, handoff sequence, tool status, retry count, validation status, concise routing rationale, and usage metrics without hidden reasoning.
- [ ] Given force-quit or worker interruption, when the run stops, then its status is saved as `interrupted` with a safe summary and recoverable audit timeline.
- [ ] Given an invalid or failed run, when it ends, then the UI shows a typed error state and does not claim successful completion.

#### AC-03 — Enforce current-site MCP access and approval

**Owner:** MCP Builder / Security Engineer  
**Dependencies:** Active-site contract; authorization service; redaction policy  
**Status:** Not started

As a manager, I want agent data access constrained and understandable so that automation cannot read another site or execute an unapproved tool step.

**Acceptance criteria**

- [ ] Given a valid current-site tool request and response, when MCP executes, then only records matching the active `site_id` reach the skill.
- [ ] Given a request or response containing another site, when the gateway detects it, then the out-of-scope data is discarded/quarantined, the violation is audited, and one removal confirmation is requested.
- [ ] Given a tool step awaiting approval, when the user chooses approve-this-step, then only that step proceeds; when the user chooses approve-all-for-session, then matching steps proceed only until the chat session ends.
- [ ] Given a timeout or tool error, when retrying, then MCP retries no more than two times and audits every attempt; after the final failure it returns a typed missing-source result.
- [ ] Given any audit payload, when it is persisted or viewed, then secrets and credentials are redacted and unrelated sensitive attributes are absent.

#### AC-04 — Validate specialist output and handle insufficiency

**Owner:** AI Engineer / Data Engineer  
**Dependencies:** Skill schemas; EMS data contracts and fixtures; validator pipeline  
**Status:** Not started

As a manager, I want answers to state their limitations so that I can distinguish a supported operational result from incomplete or uncertain data.

**Acceptance criteria**

- [ ] Given a specialist output, when it is returned, then its typed schema and required source references are validated before it becomes user-visible.
- [ ] Given missing, stale, or contradictory inputs, when a useful result remains possible, then the result completes with an insufficiency notice and suggested corrective actions only for the detected issue.
- [ ] Given materially uncertain required inputs, when the run cannot safely continue, then the agent asks a clarifying question or returns a typed insufficient-data outcome.
- [ ] Given invalid structured output, when repair is attempted, then repair occurs at most three times; after the limit the run is `failed_validation` and preserves errors and any partial preview.

#### AC-05 — Produce and persist the proving report draft

**Owner:** Report Generation specialist owner / Backend Architect  
**Dependencies:** AC-02–AC-04; HTML sanitizer; Reports tab; draft persistence  
**Status:** Not started

As a manager, I want a formal site report preview saved in Reports so that I can review an actionable draft without treating it as a final operational decision.

**Acceptance criteria**

- [ ] Given a valid report request, when the proving chain completes, then a sanitized HTML preview contains report metadata, semantic sections, source references, and the active site ID.
- [ ] Given report HTML, when it is validated, then scripts, event handlers, external URLs, external stylesheets, and unsafe markup are rejected; the preview is sandboxed.
- [ ] Given an accepted preview, when persistence completes, then it appears in the active site’s Reports tab as a draft linked to the AgentCrew run; it never enters a ready/final state.
- [ ] Given a selected semantic section and revision instruction, when the user confirms the proposal, then a new validated draft version is saved; without confirmation, the original draft remains unchanged.
- [ ] Given report versions, when retention runs, then only the latest five generated report versions are retained.

#### AC-06 — Meet the four-hat end-to-end completion gate

**Owner:** Reality Checker  
**Dependencies:** AC-01–AC-05; API Tester contract tests; Evidence Collector in-app browser evidence  
**Status:** Not started

As the product team, we need executable proof for every runtime hat so that “MVP complete” means the integrated safety and user-value path works, not merely that skills exist.

**Acceptance criteria**

- [ ] Each hat passes one end-to-end workflow using an authorized active site and records the same five gates: routing, current-site MCP access, structured-output validation, audit logging, and user-visible output.
- [ ] Each workflow has a reproducible fixture, executable test result, run/audit identifier, and in-app browser screenshot or equivalent visual evidence.
- [ ] The report workflow specifically demonstrates `Router → Report Generation → Data Analysis → Report Generation`, a valid sanitized preview, draft persistence, and the insufficiency path when source data is missing/stale/contradictory.
- [ ] The report workflow demonstrates invalid-output repair and confirms that the fourth failed validation attempt cannot silently publish a draft.
- [ ] Reality Checker signs off only after API Tester and Evidence Collector evidence are attached and known gaps are documented.

### P1 — required MVP experience after the safety path

#### AC-07 — Inspect the Agent Audit history

**Owner:** Frontend Developer / Backend Architect  
**Dependencies:** Audit event schema and retention job  
**Status:** Not started

As a manager, I want a view-only audit history grouped by site so that I can understand what AgentCrew did and why a result was produced.

**Acceptance criteria**

- [ ] Given the Agent Audit area, when it opens, then it defaults to the current site and shows the user’s runs, handoffs, approvals, MCP attempts/responses, validation, violations, and outputs in timeline order.
- [ ] Given audit records, when they are displayed, then safe summaries and redacted full MCP payloads are available; hidden chain-of-thought, secrets, and credentials are not.
- [ ] Given an audit record, when the user views it, then replay, mutation, and export controls are absent.
- [ ] Given retention execution, when records exceed the policy, then the latest 50 audit rounds per user/site remain available.

#### AC-08 — Propose approved per-agent personalization

**Owner:** AI Engineer / Backend Architect  
**Dependencies:** Skill package format; sandbox runner; version repository  
**Status:** Not started

As a manager, I want to approve useful EMS-site-related preferences for a specific agent so that future work fits my operating style without changing safety boundaries.

**Acceptance criteria**

- [ ] Given an explicit or inferred EMS-site preference, when AgentCrew proposes an update, then the user can inspect a diff before approval.
- [ ] Given an approved update, when sandbox fixtures and regression validation pass, then it becomes the active version for that user and hat and persists across sessions.
- [ ] Given a failed or rejected sandbox update, when activation is attempted, then the update is rejected and the previous active version remains active.
- [ ] Given any overlay, when it is validated, then it cannot create tools, widen site scope, change permissions, or change approval rules; unrelated sensitive attributes are neither inferred nor persisted.
- [ ] Given version history, when more than five versions exist, then only the latest five are retained and restore/reset-to-base remain available.

#### AC-09 — Maintain safe, responsive drawer behavior

**Owner:** UX Architect / Frontend Developer  
**Dependencies:** Existing calm, operational site-first design direction; AgentCrew API events  
**Status:** Not started

As a manager, I want the AgentCrew interaction to feel native to the site workspace so that it supports operations work without overwhelming the dashboard.

**Acceptance criteria**

- [ ] Given a desktop site workspace, when AgentCrew opens, then it uses a right-side drawer without obscuring the active site identity or core navigation.
- [ ] Given a narrow viewport, when AgentCrew opens, then it becomes a usable full-screen panel with keyboard-accessible close, composer, approvals, and result controls.
- [ ] Given loading, approval, interruption, validation failure, and empty states, when each renders, then the state and next user action are clear and no false success is shown.
- [ ] Given keyboard and assistive-technology use, when the drawer opens or an approval appears, then focus management, labels, contrast, and status announcements meet the project’s accessibility bar.

## Explicitly out of scope for MVP

| Item | Decision | Revisit condition |
|---|---|---|
| Cross-site agent analysis or joins | Do not build; site isolation is a release boundary. | Reassess only with an approved authorization and product-scope decision. |
| AgentCrew on portfolio screens | Do not build; the active site is mandatory context. | Revisit after site-scoped usage proves value. |
| Permanent tool or handoff approvals | Do not build; approvals expire with the chat session. | Revisit with a separately reviewed permission model. |
| Raw skill-source editing or arbitrary code/tool creation | Do not build; personalization is a constrained overlay. | Revisit after sandbox/version governance is proven. |
| Download, export, external sharing, ready state, or final operational decision status for reports | Do not build; reports are sanitized previews saved as drafts. | Revisit after draft review behavior and operational liability are understood. |
| Audit replay, mutation, and export | Do not build; audit is view-only history. | Revisit with a separate security and governance review. |
| Hidden chain-of-thought display or persistence | Never expose or persist. | Not an MVP deferral; remains prohibited. |
| Broad personalization from unrelated personal or sensitive attributes | Do not infer or persist. | Not an MVP deferral; remains prohibited. |
| Permanent background autonomy, scheduled runs, or cross-session approval carryover | Do not build; MVP is user-initiated and session-scoped. | Revisit with an explicit autonomy and incident-response design. |

## Four runtime hat end-to-end completion checklist

Use one authorized site fixture per workflow. Every row is required for the corresponding hat, and every completed row must link to an executable test result plus in-app browser evidence.

### Shared completion gates for every hat

- [ ] **Routing:** The user intent reaches the intended hat through the unified router; the selected hat and safe routing summary are visible.
- [ ] **Current-site MCP access:** At least one tool read succeeds with the active `site_id`; a cross-site payload test proves it is discarded, audited, and gated by removal confirmation.
- [ ] **Validation:** The hat’s typed output is validated before rendering; the test covers an invalid output and the documented repair/failed-validation behavior where applicable.
- [ ] **Audit logging:** The run records routing, handoffs, approvals, every MCP attempt/retry, validation, scope events, and the final output without secrets or hidden reasoning.
- [ ] **User-visible output:** The manager sees a truthful completed, interrupted, insufficient, or failed state with the next action clearly stated.
- [ ] **Evidence:** API Tester result, run/audit IDs, fixture name, screenshot path, tester/owner, and known gaps are attached to the release record.

### Site Security Manager

- [ ] Workflow: ask for a site security/authorization status for the active site.
- [ ] Routing selects Site Security Manager and identifies the site scope.
- [ ] MCP reads only current-site access/security records; an out-of-scope record is removed and recorded.
- [ ] Output validates into a concise security status with source references and any uncertainty.
- [ ] UI shows the security result and the audit timeline shows approvals, MCP activity, validation, and output.

### Device Monitoring Expert

- [ ] Workflow: ask for current device health, alerts, or an abnormal device condition for the active site.
- [ ] Routing selects Device Monitoring Expert and identifies the site scope.
- [ ] MCP reads current-site device/alert data and demonstrates retry behavior for a transient failure, capped at two retries.
- [ ] Output validates into device status, relevant findings, and data-freshness/quality notes when needed.
- [ ] UI shows the monitoring result and the audit timeline shows the tool attempts, validation, and output.

### Data Analysis Specialist

- [ ] Workflow: ask for a site-scoped energy trend, comparison, anomaly, or KPI analysis.
- [ ] Routing selects Data Analysis Specialist and identifies the site scope.
- [ ] MCP reads current-site energy data and handles missing/stale/contradictory inputs with an insufficiency notice or a clarifying question.
- [ ] Output validates into findings, source references, confidence/limitations, and suggested corrective actions only when an issue exists.
- [ ] UI shows the analysis result and the audit timeline shows the data reads, validation, and output.

### Report Generation Specialist

- [ ] Workflow: ask for a formal report for the active site with analysis insights.
- [ ] Router starts Report Generation and automatically executes the allowlisted chain `Report Generation → Data Analysis → Report Generation`.
- [ ] MCP reads only current-site report inputs; retries and scope-violation handling are evidenced.
- [ ] Report structured output and sanitized HTML pass validation; the repair loop is exercised up to three times and the final `failed_validation` path preserves errors/partial preview.
- [ ] A script-free, external-resource-free HTML preview is visible in the drawer and persisted as a draft in the current site’s Reports tab.
- [ ] The report includes semantic sections, source references, and a conditional insufficiency notice when the fixture requires it.
- [ ] A selected-section revision is proposed, shown for confirmation, and saved only after confirmation as a new draft version.
- [ ] Audit history links the complete chain, validation, preview, draft ID, and revision confirmation; no ready/final status is present.

## Release decision

## EMS database-backed fake data acceptance

The database-backed EMS slice adds these release gates before the four-hat workflow may claim real data access:

- [ ] Deterministic fake seed creates sites, assets, channels, source lineage, canonical observations, quality cases, and derived metrics with a repeatable manifest hash.
- [ ] Canonical observations preserve source lineage and controlled quality states; rejected rows remain quarantined and replayable.
- [ ] Frequently requested or expensive calculations are persisted in `derived_metric_values` or materialized views, with freshness, formula version, dependencies, and calculation timestamp.
- [ ] Interval energy and cumulative counters use separate aggregation semantics; PR, efficiency, achievement rate, and CO₂ reduction have golden expected values.
- [ ] Bounded FastAPI retrieval routes and named MCP read tools return site identity, page metadata, quality, freshness, units, lineage, and calculated-field metadata.
- [ ] LLM retrieval is server-authorized, site-scoped, paginated, byte-limited, replay-resistant, and does not expose arbitrary SQL or raw secrets.
- [ ] Database → API → MCP → AgentCrew → UI retrieval survives API restart and proves that fixture mode was not silently used.

**MVP ships only when:** AC-01 through AC-06 are complete; the four hat checklist has executable and visual evidence; the security review is complete; and no known scope violation, secret exposure, cross-site read, unsafe HTML, or unverified “success” state remains open. AC-07 through AC-09 must also be complete for the intended manager-facing MVP release unless Product Lead records an explicit, time-bounded exception with an owner and follow-up date.

**Product trade-off:** The MVP deliberately favors trustworthy site-scoped workflows and a reviewable report draft over breadth such as exports, permanent approvals, cross-site analysis, and autonomous background work. This keeps the first release measurable: successful end-to-end completion per hat, safe handling of uncertainty, and auditable user-visible outcomes.
