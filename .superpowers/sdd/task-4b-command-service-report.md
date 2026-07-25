# Task 4B — Approval-gated simulated command service

**Date:** 2026-07-25
**Status:** Complete

## Scope

Implemented only the Task 4B-owned files:

- `apps/v2g-integration-app/services/v2g-api/src/v2g/commands.py`
- `apps/v2g-integration-app/services/v2g-api/tests/test_commands.py`
- `.superpowers/sdd/task-4b-command-service-report.md`

No dispatch, persistence model/repository, API route, frontend, Docker, or
device/network integration was changed.

## Delivered behavior

- An explicit, module-local in-memory repository stores immutable command
  snapshots and idempotency-key lookups behind an async lock.
- `CommandRequest` extends the dispatch request type with required correlation
  ID and idempotency-key metadata. `CommandService.request` reuses
  `v2g.dispatch.validate_request` for capacity, site, and SOC policy checks.
- The valid flow is audited as:
  `requested -> validated -> awaiting_approval -> approved -> simulated`.
- Every transition appends an immutable audit event named `command.<state>`
  with timestamp, correlation ID, previous/next state, actor, and reason where
  applicable.
- Approval, rejection, cancellation, and simulated execution fail closed:
  actors and reject/cancel reasons must be non-empty; execution requires the
  `approved` state; expired commands are moved to `expired` and cannot be
  approved or executed.
- Execution changes only in-memory command state. The module imports no
  device, socket, HTTP, or database adapter.

## TDD evidence

The tests were created before `commands.py`; the initial run failed during
collection with `ModuleNotFoundError: No module named 'v2g.commands'`.

Two additional red/green cycles were recorded:

1. Cancellation with an empty reason initially failed because `cancel` was
   absent; it now raises `CommandPolicyError` while preserving pending state.
2. A request with `expires_at=None` initially exposed an `AttributeError` from
   the dispatch validator; the service now rejects it as a policy error before
   validation.

## Verification

```text
.venv/bin/pytest tests/test_commands.py -q
8 passed in 0.01s

.venv/bin/pytest tests/test_dispatch.py tests/test_commands.py -q
17 passed in 0.01s
```

The command tests cover expiry rejection, idempotency, the full state/audit
sequence, reject/cancel reason enforcement, execution without approval,
metadata requirements, and malformed expiry handling.

## Security and follow-up concerns

- **Informational:** This is deliberately process-local state. A restart loses
  commands and audit history; later API/persistence work must use the existing
  durable audit boundary without weakening transition checks.
- **Informational:** A non-empty named actor is a local guardrail, not identity
  verification or authorization. The API layer must authenticate the actor and
  enforce its approval scope before calling this service.
- **Compatibility note:** Task 4A's dispatch request intentionally has only
  physical request fields. This task adds correlation and idempotency metadata
  through a local subclass to respect the ownership boundary. The API adapter
  must construct `v2g.commands.CommandRequest`, rather than dropping that
  metadata when translating a dispatch recommendation.
