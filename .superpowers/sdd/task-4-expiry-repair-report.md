# Task 4 Expiry Repair Report

**Date:** 2026-07-25
**Status:** Complete

## Scope

- `apps/v2g-integration-app/services/v2g-api/src/v2g/commands.py`
- `apps/v2g-integration-app/services/v2g-api/tests/test_commands.py`

## Repair

Approval now captures one timezone-aware UTC timestamp while holding the
repository lock. That timestamp is used for the expiry decision and for the
resulting `command.approved` audit event. If the command is expired, the same
timestamp is used for its `command.expired` audit event.

The deterministic boundary-clock regression first demonstrated the old defect:
the expiry check passed one microsecond before expiry while a second clock read
recorded approval at expiry. The repair keeps the approval transition at the
single captured pre-expiry instant, so a command cannot receive an approval
audit transition at or after its expiry due to a split-time check/transition.

## Verification

```text
.venv/bin/pytest tests/test_commands.py -q
16 passed in 0.01s

.venv/bin/pytest tests/test_dispatch.py tests/test_commands.py -q
28 passed in 0.02s
```
