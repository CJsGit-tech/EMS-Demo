## Task 5 Report: REST and SSE supervisor contracts

- Added typed, simulator-only REST contracts for the demo site's overview, fleet, historian, alarms, recommendations, and approval-gated commands.
- Added a finite in-memory SSE replay journal. Each public event uses exactly `type`, `occurred_at`, `correlation_id`, and `payload`; events replay after the bounded `last_event_id` cursor and then close for reconnect.
- Requests reject undeclared fields, blank operator identity/reason, unknown metrics, invalid time ranges, unknown sites, and policy-invalid commands. Public payloads are allowlisted and expose no database configuration, secret, external control, or arbitrary query capability.
- Added dependency seams and test overrides for the read model, command service, and event journal; API tests use a fixed UTC clock and isolated in-memory collaborators.
- Minimal supporting change: approval reasons now flow into the existing in-memory command audit event so the audited SSE payload retains the required decision rationale without broadening the command service scope.

Verification run from `apps/v2g-integration-app/services/v2g-api`:

```text
.venv/bin/pytest tests/test_api.py tests/test_dispatch.py tests/test_commands.py -q
35 passed, 2 dependency deprecation warnings
```
