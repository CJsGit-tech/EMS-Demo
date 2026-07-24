# AgentCrew API and Run-State Contract

**Owner:** Backend Architect  
**Dependencies:** FastAPI/Uvicorn service on `8002`; FastAPI-owned `AgentCrewService`; authorized active-site context; four skill packages; current-site fixture gateway; frontend REST adapter  
**Status:** Implemented FastAPI contract; PostgreSQL durability adapter wired, production identity and live DB certification pending  
**Implementation mapping:** `services/ems-api/src/agentcrew/app.py`, `service.py`, `contracts.py`, `runtime.py`; `apps/site-integration-app/src/agentcrew/api.js`  
**Acceptance mapping:** `services/ems-api/tests/test_fastapi_app.py`, `services/ems-api/tests/test_runtime.py`, and [the API test matrix](10-api-test-plan-and-contract-matrix.md)  
**Decision sources:** [Framework and Runtime Decisions](00-framework-decisions.md), [Product backlog and acceptance](./01-product-backlog-and-acceptance.md), [shared runtime contracts](../../../services/ems-api/src/agentcrew/contracts.py), [shared errors](../../../services/ems-api/src/agentcrew/errors.py)

## Purpose and authority

This is the implemented REST contract between the React/Vite site workspace and the authoritative FastAPI service. The browser owns route-derived display context, drawer state, approval controls, report preview, and view-only audit presentation. FastAPI owns routing, synchronous run execution, approvals, report drafts, audit events, idempotency, and current-site MCP policy.

The separate FastMCP process on `8003` is not a second API authority. It exposes MCP tools and delegates to authenticated FastAPI `/internal/agentcrew/*` endpoints using `X-EMS-Service-Token`. The frontend does not call MCP directly.

Every run is site-scoped. The current local implementation accepts `site_id`, `site_name`, `user_id`, and `source_route` in the request model, then validates that the route starts with `site/{site_id}/`. Production authentication and server-side site authorization are not yet wired; do not interpret the demo payload fields as a security boundary.

## Transport conventions

- REST base path: `/api/v1/agentcrew`.
- FastAPI/Uvicorn defaults to `127.0.0.1:8002`; `EMS_API_HOST` and `EMS_API_PORT` override the bind settings.
- REST requests may use the current frontend’s `snake_case` fields. FastAPI also accepts the documented camelCase aliases; responses use camelCase keys where the service projection defines them.
- Responses include `requestId`; the API echoes `X-Correlation-ID` or generates one.
- `POST /runs` returns `202` but executes the deterministic fixture workflow synchronously before returning the current snapshot. There is no implemented SSE endpoint. The browser may poll `GET /runs/{run_id}` if a future asynchronous implementation requires it.
- MCP calls are bounded to attempts 1–3 by `runtime.validate_tool_request`; each attempt is audited by `FixtureGateway`.
- Internal endpoints require the exact `X-EMS-Service-Token` configured by `EMS_SERVICE_TOKEN`.

### Common request context

```json
{
  "site_id": "site-001",
  "site_name": "Verde North",
  "user_id": "user-1",
  "source_route": "site/site-001/overview",
  "session_id": "session-user-1-site-001"
}
```

### Common run representation

```json
{
  "runId": "run-789",
  "status": "waiting_for_tool_approval",
  "siteContext": {
    "siteId": "site-001",
    "siteName": "Verde North",
    "userId": "user-1",
    "sourceRoute": "site/site-001/overview"
  },
  "activeHat": "device_monitoring_expert",
  "message": "A current-site data read needs approval.",
  "routing": {
    "selectedHat": "device_monitoring_expert",
    "handoffSequence": ["device_monitoring_expert"],
    "rationale": "Matched the request to a bounded specialist."
  }
}
```

The optional `result` contains safe fixture records, source references, quality notices, or a sanitized report draft. It must not contain hidden reasoning, raw secret-bearing payloads, or another site’s records.

## Implemented REST operations

### Establish site context

`POST /api/v1/agentcrew/context`

The service validates the route and returns the canonical site context plus `agentCrew`, `audit`, and `reports` capabilities. Invalid or missing site/user/route data returns a typed `400` error.

### Start a run

`POST /api/v1/agentcrew/runs`

Request fields: `site_id`, `site_name`, `user_id`, `source_route`, `session_id`, and a non-empty `message` of at most 4000 characters. `Idempotency-Key` is optional in the local implementation; when present, FastAPI returns the first run snapshot for a repeated key.

The router selects one of the four fixed hats. The deterministic service immediately enters `running`, requests the required current-site tool, and normally returns `waiting_for_tool_approval` with `202`.

### Read a run

`GET /api/v1/agentcrew/runs/{run_id}`

Returns the FastAPI-owned snapshot. The current implementation returns `404` when the run ID is absent.

### Resolve tool approval

`POST /api/v1/agentcrew/runs/{run_id}/approvals`

Request:

```json
{"session_id": "session-user-1-site-001", "mode": "approve_step"}
```

`mode` is `approve_step` or `approve_all_session`. The service records approval by session and tool, audits `approval.resolved`, executes the pending read, and returns the updated snapshot. A session approval covers the current local allowlist; it is not durable across process restart and is not a production authorization grant.

### Interrupt and recover

- `POST /api/v1/agentcrew/runs/{run_id}/interrupt` with `session_id` changes a non-terminal run to `interrupted` and records `run.interrupted`.
- `POST /api/v1/agentcrew/runs/{run_id}/recover` with `session_id` reuses an interrupted run and executes it again. Only interrupted runs may be recovered.

Both operations return the current run snapshot with `202`. Ownership is checked against the session stored by FastAPI.

### Read audit events

`GET /api/v1/agentcrew/audit?site_id=site-001&user_id=user-1`

Returns the FastAPI service’s site-and-user-filtered audit events. Fixture mode may use the local compatibility repository when PostgreSQL is unavailable; the durable target is the PostgreSQL audit table. The current response is view-only and has no replay, mutation, export, pagination, or retention API.

### Site-scoped memory and preferences

`POST /api/v1/agentcrew/memory/recall` returns bounded recent messages, candidate/confirmed memories, and active preferences for the supplied `(user_id, site_id, session_id)`. `POST /api/v1/agentcrew/preferences` creates a versioned site-scoped preference. These records are never recalled for another site; the FastAPI Memory Manager is the only owner and FastMCP cannot read it directly.

## Internal FastAPI endpoints used by FastMCP

These endpoints are not frontend APIs:

| Method and path | Purpose | Required control |
|---|---|---|
| `POST /internal/agentcrew/runs` | Start a run on behalf of an MCP caller | `X-EMS-Service-Token` |
| `GET /internal/agentcrew/runs/{run_id}` | Read the authoritative run snapshot | `X-EMS-Service-Token` |
| `POST /internal/agentcrew/tools/{tool_key}` | Execute an allowlisted current-site fixture read through `FixtureGateway` | `X-EMS-Service-Token`, path/payload tool match |

`mcp_server.py` sends the active site, user, source route, session, run, tool key, and arguments to these routes. FastAPI rejects a missing or incorrect token with `401`, rejects a tool path/payload mismatch with `400`, and performs the actual scope and audit checks.

## Run states

The shared vocabulary in `contracts.py` is:

```text
queued, running, waiting_for_tool_approval,
waiting_for_removal_confirmation, repairing, completed,
interrupted, failed, failed_validation
```

The deterministic implementation exercises this path:

```text
queued → running → waiting_for_tool_approval → running → completed
                                      └──────→ interrupted → running
```

Report requests additionally execute the bounded sequence:

```text
report_generation_specialist → data_analysis_specialist → report_generation_specialist
```

The remaining enum states are contract vocabulary for future validation, removal-confirmation, and failure paths; the current `AgentCrewService` does not expose separate endpoints for them.

## Error behavior

Expected domain errors use the codes in `errors.py`: `site_context_required`, `invalid_site_route`, `site_scope_violation`, `tool_approval_required`, `validation_failed`, and `run_interrupted`. FastAPI maps ordinary validation and domain failures to `400`, scope/interruption conflicts to `409`, missing runs to `404`, internal token failures to `401`, and unexpected exceptions to `500`.

The MCP gateway returns typed `ToolResult` outcomes including `success`, `approval_required`, `scope_violation`, `missing_source`, and `error`. It discards records whose `site_id` does not equal the active site and audits the violation. No raw exception or cross-site record is returned to a specialist.

## Implementation and acceptance mapping

- **Implementation:** `app.py` is the only REST authority; `service.py` is the only local state owner; `mcp_server.py` is a separate FastMCP streamable-HTTP delegate; `api.js` is the REST-only frontend adapter.
- **Acceptance:** Verify FastAPI health, `202` run creation, approval completion, idempotency, invalid route rejection, internal-token rejection, tool delegation, interruption/recovery, scope mismatch, bounded retries, and user/site-filtered audit output using the mapped tests.

## EMS retrieval and calculated-metric contract

The EMS database is a separate bounded context. Its FastAPI service exposes typed, site-scoped retrieval routes for the browser and an internal adapter for MCP. The LLM never receives database credentials and never submits SQL.

Recommended REST surface:

```text
GET /api/v1/sites/{site_id}
GET /api/v1/sites/{site_id}/assets
GET /api/v1/sites/{site_id}/observations
GET /api/v1/sites/{site_id}/weather
GET /api/v1/sites/{site_id}/energy
GET /api/v1/sites/{site_id}/reports
GET /api/v1/sites/{site_id}/metrics
```

Time-series routes use `event_time >= from AND event_time < to`, require bounded ranges, return keyset pagination, and include quality, freshness, units, and source lineage. Calculated metrics include `formula_version`, dependencies, aggregation rule, `calculated_at`, and the source observation window. Persisted `derived_metric_values` and materialized views are preferred for frequent or expensive metrics; regular views are reserved for inexpensive always-current calculations.

### MCP tools backed by EMS data

FastMCP exposes named read tools: `get_site_snapshot`, `list_site_assets`, `query_energy_timeseries`, `query_weather_observations`, `get_device_health_and_alerts`, `get_generation_reports`, `get_metric_catalog`, `get_data_quality_summary`, and restricted `get_source_lineage`. `report_inputs` is an application composition step, not a generic query tool.

FastAPI derives effective user/site/session/run identity from authoritative server state. MCP arguments are assertions only. Strict per-tool schemas enforce metric allowlists, time windows, row/byte limits, cursor binding, and no unknown fields. Production MCP calls fail closed on database/audit failure; fixture fallback is available only under explicit deterministic-demo configuration.
