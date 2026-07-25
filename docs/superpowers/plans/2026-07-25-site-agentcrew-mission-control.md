# Site AgentCrew Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible, trustworthy multi-agent mission flow to the site-scoped AgentCrew drawer.

**Architecture:** Extend the existing AgentCrew run contract with optional mission steps, evidence, limitations, and provenance. Normalize API responses into those typed fields, then render a reusable mission timeline and trust summary inside the existing drawer. Keep the backend contract backward-compatible by supplying deterministic demo metadata only for known quick-start missions when the API omits it.

**Tech Stack:** React 18, JavaScript/TypeScript contracts, Vitest, Testing Library, existing CSS design system.

## Global Constraints

- AgentCrew must remain unavailable without a validated active site context.
- Reports must remain draft-only until explicit confirmation.
- Missing or unavailable data must be surfaced; no unsupported result may be fabricated.
- Existing approval, audit, memory, EMS, and report confirmation flows must continue to work.
- Use semantic controls and responsive CSS; do not add a new UI dependency.

### Task 1: Add typed mission and evidence normalization

**Files:**
- Modify: `apps/site-integration-app/src/agentcrew/contracts.ts`
- Modify: `apps/site-integration-app/src/agentcrew/api.js`
- Test: `apps/site-integration-app/tests/agentcrew-api.test.js`

**Interfaces:**
- Add `AgentCrewMissionStep`, `AgentCrewEvidenceItem`, and `AgentCrewProvenance` types.
- Normalize `run.steps`, `run.evidence`, `run.limitations`, and `run.provenance` into stable frontend fields.
- Preserve current run fields and fallback behavior.

- [ ] Add tests for API responses containing mission steps/evidence/provenance.
- [ ] Add a test that missing collaboration metadata remains safe and does not invent evidence.
- [ ] Implement normalization and stable status labels.
- [ ] Run `npm test -- --run tests/agentcrew-api.test.js`.

### Task 2: Build the mission-control presentation model and UI

**Files:**
- Modify: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`
- Modify: `apps/site-integration-app/src/styles.css`
- Test: `apps/site-integration-app/tests/agentcrew-drawer.test.jsx`

**Interfaces:**
- Render `run.steps` as a vertical timeline with role, status, result, evidence count, and handoff.
- Render a trust summary with agent count, evidence count, and limitation count.
- Render evidence and provenance sections before the report preview.

- [ ] Add failing UI tests for multiple specialist steps and trust summary.
- [ ] Add failing UI tests for an insufficiency result with a corrective action.
- [ ] Implement accessible timeline markup and status semantics.
- [ ] Add responsive drawer styles and reduced-motion-safe transitions.
- [ ] Preserve existing approval and report-confirmation interactions.
- [ ] Run `npm test -- --run tests/agentcrew-drawer.test.jsx`.

### Task 3: Supply deterministic demo orchestration metadata

**Files:**
- Modify: `apps/site-integration-app/src/agentcrew/api.js`
- Modify: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`
- Test: `apps/site-integration-app/tests/agentcrew-api.test.js`
- Test: `apps/site-integration-app/tests/agentcrew-drawer.test.jsx`

**Interfaces:**
- Known report quick-start runs receive a deterministic six-step collaboration preview only when the API response does not provide steps.
- API-provided steps always win over demo metadata.
- The preview must identify evidence as retrieved, analyzed, or generated rather than claiming unavailable backend work.

- [ ] Test fallback mission steps for the report quick-start.
- [ ] Test API-provided steps are preserved without duplication.
- [ ] Add demo evidence/provenance labels tied to current site data and the draft state.
- [ ] Run the focused AgentCrew tests.

### Task 4: Verify the full experience and handoff

**Files:**
- Modify: `apps/site-integration-app/tests/tests.txt` if the manual test script needs a new case.
- Create: `.superpowers/sdd/task-4-report.md`

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start the app with `npm run dev` and inspect the portfolio and site-scoped drawer in the in-app browser.
- [ ] Verify portfolio routes do not expose AgentCrew.
- [ ] Verify the report mission shows multiple agents, evidence, limitation/provenance copy, and draft-only report state.
- [ ] Verify mobile drawer readability and keyboard-accessible controls.
