# Site AgentCrew Mission Control Design

## Goal

Make the site-scoped AgentCrew experience visibly demonstrate that specialized agents can query site data, review operational conditions, analyze trends, and produce a trustworthy report draft.

## Product behavior

The assistant remains available only inside a validated site workspace. It offers two mission templates:

- Create a site operations report
- Investigate a site issue

The report mission is the first implementation target. A run shows a human-readable plan and a vertical handoff timeline:

1. Mission Planner — scopes the request to the active site and identifies required evidence.
2. Data Engineer — retrieves the site snapshot, telemetry, alerts, and report history.
3. Device Monitoring Expert — reviews asset status and operational exceptions.
4. Data Analysis Specialist — analyzes trends, forecast confidence, and data quality.
5. Site Security Manager — checks site scope and permission-sensitive findings.
6. Report Generation Specialist — composes a reviewable draft from validated results.

Each step has a role, status, short result, evidence count, and handoff label. The user sees collaboration progress without needing to understand backend implementation details.

## Trust model

The final report is explicitly a draft until confirmed. It contains:

- Executive finding
- Evidence reviewed
- Agent findings
- Data quality and limitations
- Recommended actions
- Open questions
- Report provenance

Claims must be tied to evidence records or marked as an inference. Missing or unavailable data produces an insufficiency state with a corrective action. The UI must never imply that a report is final merely because generation completed.

## Architecture

The existing `AgentCrewDrawer` remains the interaction shell. Typed collaboration data is added to the existing run normalization path rather than creating a second chat state model. The frontend uses deterministic demo metadata when the local AgentCrew API returns only a coarse run response, while preserving API errors and approval states. No portfolio route can create a mission context.

## Visual direction

Keep the existing Verde operational visual language quiet and site-first. Add one signature element: a mission summary rail showing agent count, evidence count, limitations, and draft state. Use a vertical timeline for the run because order and handoff are the meaning-bearing structure. Respect responsive layout, keyboard focus, and reduced-motion preferences.

## Failure and safety behavior

- API unavailable: show an explicit unavailable message and do not fabricate a completed result.
- Tool approval required: keep the run paused and expose one-step/session approval actions.
- Insufficient data: show missing evidence, reason, and next action.
- Report draft: show “Draft preview · not final” until confirmation returns a durable revision state.
- Site change or drawer close: existing session approval semantics remain unchanged.

## Success criteria

- A user can launch the report mission from the site-scoped drawer.
- The drawer visibly shows multiple specialist agents and handoffs.
- The run exposes evidence and limitations before the report preview.
- The report preview includes provenance and draft-only language.
- Existing approval, audit, site-scope, EMS, and report confirmation behavior remains intact.
- Frontend tests cover mission rendering, evidence/limitation states, and report confirmation.
