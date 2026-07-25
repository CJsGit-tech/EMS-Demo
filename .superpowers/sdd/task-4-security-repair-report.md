# Task 4 Security Repair Report

**Date:** 2026-07-25
**Status:** Complete

## Scope

Repaired only the Task 4 V2G dispatch/command service implementation and
regressions:

- `apps/v2g-integration-app/services/v2g-api/src/v2g/dispatch.py`
- `apps/v2g-integration-app/services/v2g-api/src/v2g/commands.py`
- `apps/v2g-integration-app/services/v2g-api/tests/test_dispatch.py`
- `apps/v2g-integration-app/services/v2g-api/tests/test_commands.py`

The command service remains a local, in-memory simulator. No device, network,
database, or external-system integration was introduced.

## Findings and remediation

### High — malformed numeric values could poison an idempotency key

`math.isfinite()` raised `TypeError` for non-numeric runtime values after the
service had persisted a `requested` command and idempotency index entry.
Booleans were also accepted as numeric values. An attacker or malformed caller
could therefore leave a request in a non-retryable state under its idempotency
key.

`dispatch._require_finite_numeric()` now rejects non-numeric values and
booleans before calling `isfinite()`, and separately rejects `NaN`/infinity.
`CommandService.request()` validates a new request while holding the repository
lock but before creating a command or storing its idempotency key. A valid retry
using the same key can therefore proceed after a rejected malformed request.

### Medium — denied-operation tests read stale command snapshots

Commands are immutable snapshots, so checking the value returned by `request()`
after reject/cancel/expire did not prove the repository was updated.

The injected in-memory repository now supports reload, exposed through
`CommandService.reload()`. Regressions assert the persisted terminal state and
exact audit event sequence for rejection, cancellation, and expiry.

## Regression evidence

The new tests were first run against the prior implementation and produced the
expected failures: invalid strings raised `TypeError`, booleans were accepted,
non-finite requests persisted failed/idempotency records, and no reload API
existed. The repair passes:

```text
.venv/bin/pytest tests/test_dispatch.py tests/test_commands.py -q
27 passed in 0.02s
```

Coverage includes non-finite and invalid numeric types, retry after malformed
input, persisted rejected/cancelled/expired audit histories, and concurrent
same-idempotency-key requests creating exactly one command.
