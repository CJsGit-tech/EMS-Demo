# Task 4A Dispatch Report

**Date:** 2026-07-25  
**Status:** Complete

## Scope

Implemented the narrow V2G Task 4A contract in `v2g.dispatch`:

- `build_recommendation(site_state) -> DispatchRecommendation`
- `validate_request(request, state) -> None`
- Local immutable `SiteState`, `CommandRequest`, and `DispatchRecommendation` dataclasses
- `CommandPolicyError` for policy violations

## Evidence

Focused test command:

```text
.venv/bin/pytest tests/test_dispatch.py -q
...
3 passed in 0.00s
```

Covered behaviors:

1. A valid state produces a proposed advisory recommendation with site impact, expiry, assumptions, constraints, confidence, and reason.
2. A request whose absolute power magnitude exceeds flexible capacity raises `CommandPolicyError("insufficient flexible capacity")`.
3. A signed discharge request projected below minimum departure SOC raises `CommandPolicyError("departure SOC violation")`.

## QA assessment

- Simulator-only boundary: pass. The module is pure and has no device, network, persistence, or command-execution calls.
- Reproducibility: pass. Recommendation expiry derives from the supplied timezone-aware observation timestamp.
- Model/fairness review: not applicable. This task contains deterministic policy logic, not a trained or statistical model, and processes no protected or personal data.
- Scope control: pass. Only the two task implementation/test files and this report are owned by this change.

## Concerns / follow-up

- Request expiry enforcement and approval/state transitions belong to the later command-service task; this narrow contract only covers the two required capacity/SOC constraints.
- The recommendation is advisory and intentionally does not persist or execute anything.

## Follow-up QA Finding — Numeric Fail-Open

**Date:** 2026-07-25
**Severity:** High
**Status:** Remediated

### Observation and evidence

Non-finite request/state numeric values were not uniformly rejected before policy evaluation. In particular, `NaN` comparisons can evaluate false, allowing a request to bypass the capacity or discharge-SOC checks. Regression coverage now verifies rejection of `NaN` in request power, projected SOC, and all state numeric policy inputs, including recommendation construction.

### Impact assessment

Without the guard, a malformed `NaN` input could produce an apparently valid advisory dispatch result instead of a policy error. The affected behavior is limited to the simulator-only advisory path; no device, network, persistence, or command-execution side effect exists in this module.

### Remediation

Added field-specific finite-number validation before capacity/SOC comparisons. Each violation raises `CommandPolicyError("non-finite numeric value: <field>")`. Focused evidence: `.venv/bin/pytest tests/test_dispatch.py -q` passes with the original three tests plus six numeric fail-open regressions.
