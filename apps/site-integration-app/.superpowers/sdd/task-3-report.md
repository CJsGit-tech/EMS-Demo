# Task 3 — AgentCrew frontend streaming copilot

## Scope

Only AgentCrew frontend API, drawer, localization, and focused frontend tests were changed. No backend, compose, migration, ledger, or unrelated UI files were modified.

## Files

- `src/agentcrew/api.js` — POST SSE client for `/api/v1/agentcrew/runs/stream`, defensive typed-envelope parser, and incremental stream-state reducer.
- `src/agentcrew/AgentCrewDrawer.jsx` — incremental user/assistant messages plus provider, activity, citations, approval, draft, demo-mode, and terminal-error states.
- `src/i18nConfig.js` — English and Traditional Chinese labels for streamed states.
- `tests/agentcrew-api.test.js` — split-frame and malformed-envelope parser coverage.
- `tests/agentcrew-drawer.test.jsx` — streamed provider/activity/citation/approval/draft rendering coverage.

## Tests

- `npm test -- --run tests/agentcrew-api.test.js tests/agentcrew-drawer.test.jsx`
  - API tests: 17 passed.
  - Drawer tests: 5 passed, 1 failed. The new streamed-state test does not yet observe the expected `GPT-5 mini` status after its synchronous mock callback sequence.
- No further test or build command was run after that result, per the final instruction to commit immediately.

## Commit

Implementation commit: `0e0d631` (`feat(agentcrew): stream copilot run updates`).

## Assumptions

- Backend SSE uses `event: <type>` with a JSON envelope containing `eventId`, `type`, `runId`, `sequence`, `occurredAt`, and object `data`.
- Current backend event types are supported directly; approval and report-draft event handling is intentionally defensive for typed server states delivered by the stream.
- Deterministic fixture provider mode is shown as visible Demo mode.
