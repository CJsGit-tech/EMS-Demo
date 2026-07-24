# Verde EMS AgentCrew MVP — MCP Tool Contracts and Deterministic Fixtures

**Owner:** MCP Builder  
**Dependencies:** FastAPI-owned `AgentCrewService`; FastMCP process; active-site context validation; `FixtureGateway`; session approval state; deterministic EMS fixtures; specialist output schemas and validators; Security Engineer redaction policy  
**Status:** Implemented deterministic MCP contract; production data source pending  
**Scope:** Current-site reads for the four runtime specialist hats  
**Implementation mapping:** `services/ems-api/src/agentcrew/mcp_server.py`, `mcp.py`, `runtime.py`, `fixtures.py`, `app.py`  
**Acceptance mapping:** `services/ems-api/tests/test_fastapi_app.py::test_internal_tool_delegates_to_authoritative_service_and_enforces_token`, `services/ems-api/tests/test_runtime.py`, and `services/ems-api/tests/test_skill_packages.py`  

The production-shaped database and MCP target is specified in [16-ems-database-and-mcp-design.md](16-ems-database-and-mcp-design.md). The contracts below describe the current deterministic compatibility surface; the migration plan must add typed database retrieval without changing the site-scope boundary.

**Project rules:** [AppDeploy/AGENTS.md](../../AGENTS.md)  
**Approved decisions:** [AgentCrew grill session](../../agentcrew-grill-session.html)  
**Product acceptance:** [01-product-backlog-and-acceptance.md](./01-product-backlog-and-acceptance.md)

## Contract purpose

The MCP gateway is the single boundary between AgentCrew skills and EMS data. The official `mcp.server.fastmcp.FastMCP` server runs in a separate streamable-HTTP process on `127.0.0.1:8003`. It exposes typed tools but delegates each operation to FastAPI over an authenticated internal REST call. FastAPI on `127.0.0.1:8002` remains the authority for run, approval, report, audit, scope, retry, and fixture state.

A tool call is valid only when it is made during a run with one active site. Skills may request an existing tool, but neither a skill manifest nor a personalization overlay may add tools, widen site scope, change permissions, or change approval policy. The frontend never calls this MCP endpoint; it remains REST-only.

FastMCP is stateless per call. It receives the complete active-site context and delegates with `X-EMS-Service-Token`; FastAPI validates the request before fixture access, applies session approval, filters the response, redacts audit values, and returns the typed result. FastMCP surfaces an unavailable FastAPI service as a safe runtime error and never creates competing run or audit state.

## Shared typed envelopes

The following names align with the existing Python and TypeScript AgentCrew contracts. JSON field names use `snake_case` at the MCP boundary.

```python
class ActiveSiteContext(TypedDict):
    site_id: str          # non-empty, authorized site identifier
    site_name: str        # display name only
    user_id: str          # authenticated user
    source_route: str     # validated #site/:siteId/:tab route

class ToolRequest(TypedDict):
    run_id: str
    session_id: str
    active_site: ActiveSiteContext
    tool_key: Literal[
        "site_status",
        "security_access_records",
        "device_health_and_alerts",
        "energy_timeseries",
        "report_inputs",
    ]
    arguments: dict[str, JSONValue]
    approval_mode: Literal["approve_step", "approve_all_session"] | None
    attempt: int                 # starts at 1; maximum is 3

class SourceReference(TypedDict):
    tool: str
    reference: str

class DataQualityNotice(TypedDict):
    code: Literal["missing", "stale", "contradictory"]
    message: str
    affected_fields: list[str]
    corrective_actions: list[str]

class ToolExecutionResult(TypedDict):
    run_id: str
    session_id: str
    site_id: str
    tool_key: str
    outcome: Literal[
        "success", "insufficient_data", "scope_violation",
        "approval_required", "missing_source", "error",
    ]
    records: list[dict[str, JSONValue]]
    sources: list[SourceReference]
    quality_notices: list[DataQualityNotice]
    discarded_record_count: int
    retry_count: int
    error: {"code": str, "message": str} | None
```

`records` contains only data for the requested site. `sources` is safe to show to a specialist and must identify the tool and a site-scoped reference. `quality_notices` is empty unless the fixture or source identifies a real missing, stale, or contradictory condition. A successful tool response is not permitted to use `error` as a hidden side channel; failures use an explicit `outcome` and typed error.

## Tool registry

Tool names are intentionally specific so a model can select the correct read from the name and description alone. All tools are read-only in the MVP.

| Tool key | Intended hat(s) | Typed arguments | Successful `records` shape |
|---|---|---|---|
| `site_status` | Site Security Manager, Report Generation Specialist | `{site_id: string}` | `{site_id, status, as_of, incident_count}` |
| `security_access_records` | Site Security Manager | `{site_id: string, include_expired: boolean = false}` | `{site_id, record_id, subject_type, access_status, expires_at}` |
| `device_health_and_alerts` | Device Monitoring Expert, Report Generation Specialist | `{site_id: string, device_ids?: string[], include_resolved: boolean = false}` | `{site_id, device_id, status, observed_at, alert_code?, alert_state?}` |
| `energy_timeseries` | Data Analysis Specialist, Report Generation Specialist | `{site_id: string, start: ISO-8601, end: ISO-8601, metric: "energy_kwh" \| "power_kw", interval: "15m" \| "1h"}` | `{site_id, timestamp, metric, value, unit, quality}` |
| `report_inputs` | Report Generation Specialist | `{site_id: string, period_start: ISO-8601, period_end: ISO-8601}` | `{site_id, site_status, device_findings, energy_summary, sources}` |

The gateway derives the effective site from `active_site.site_id`; `arguments.site_id` is required for explicitness and must equal it byte-for-byte after normal validation. A tool implementation must reject unknown arguments, malformed IDs, invalid time ranges, unsupported metrics/intervals, and requests from a missing or unauthorized context before repository access.

The registry must also declare each tool’s owning repository, allowed hats, read-only capability, and response validator. Those declarations are policy data, not skill-controlled input. No generic `query`, arbitrary table, SQL, URL, or repository selector is exposed to the model.

## Current-site enforcement

Enforcement applies at both request and response boundaries:

1. Confirm the route resolves to an authorized `ActiveSiteContext`. Portfolio routes, invalid site routes, unknown sites, empty users, and sign-out state produce `site_context_required` or `invalid_site_route`; no MCP-capable context is created.
2. Confirm `run_id`, `session_id`, user, and current site belong to the authenticated session. Session approvals expire on session end, sign-out, site change, or policy change.
3. Validate every site-bearing request argument against the active `site_id`. Reject a mismatch before the repository call.
4. Validate every returned record, nested source reference, and report input containing a site identifier. Records for another site are quarantined/discarded and never reach the skill.
5. Emit one removal-confirmation event per individual scope violation. After confirmation, continue with valid records when the requested outcome remains possible. Without confirmation, pause the run in `waiting_for_removal_confirmation`.
6. If the remaining data cannot support the requested result, return `insufficient_data` or `missing_source`; the specialist must state the limitation rather than infer cross-site data.

The audit copy may include the full request/response payload after secret redaction, but the skill receives only the filtered result. Secrets, credentials, authorization headers, tokens, and unrelated sensitive attributes are never persisted or exposed.

## Response and failure shapes

The MCP adapter returns an MCP structured JSON content block containing `ToolExecutionResult`; human-readable text is a short safe summary derived from the same object. It must not return a stack trace.

| Condition | Result | Run behavior |
|---|---|---|
| Valid current-site read | `outcome: success` | Pass records to the skill and validate specialist output. |
| Valid read with real data issue | `outcome: insufficient_data` plus notices | Continue when possible; report the exact issue and corrective action. |
| Out-of-scope request/response | `outcome: scope_violation` after filtering | Ask once for removal confirmation; never pass discarded records onward. |
| Approval absent | `outcome: approval_required` | Set run to `waiting_for_tool_approval`; do not call the source. |
| Exhausted transient failure | `outcome: missing_source` | Continue only if the specialist can produce a truthful limited result. |
| Invalid arguments or unauthorized context | typed `error` | Do not retry; fail the request/run with the corresponding AgentCrew error. |
| Unexpected non-transient source failure | typed `error` | Do not retry unless classified transient; preserve safe error details. |

The report workflow consumes these results through the allowlisted chain `Router → Report Generation → Data Analysis → Report Generation`. A valid report result must still pass structured-output and sanitized-HTML validation before a draft is saved.

## Retry policy

Retry only timeout, connection reset, 5xx, or explicitly classified transient source errors. The initial call is attempt 1, followed by at most two retries (attempts 2 and 3). Invalid arguments, authorization failures, scope violations, approval requirements, validation failures, and deterministic empty/missing data are not retried.

Each attempt uses the same `run_id`, `session_id`, `site_id`, tool key, and normalized arguments. Use bounded exponential backoff with jitter in production; deterministic fixtures use a zero-delay clock. A retry must not duplicate a mutating action because all MVP MCP tools are read-only. After attempt 3, return `missing_source` with `retry_count: 2` and preserve the last safe error. Every attempt, including the initial attempt and final failure, produces an audit event.

## Audit event contract

Every event includes `event_id`, `event_type`, `occurred_at`, `run_id`, `session_id`, `user_id`, `site_id`, `tool_key` when applicable, `attempt` when applicable, and a redacted `payload`. Event timestamps and IDs are injected by the harness in tests so fixtures remain deterministic.

Required MCP event types:

| Event type | Required payload fields |
|---|---|
| `mcp_tool_requested` | normalized tool key, argument digest, approval mode, active site |
| `mcp_tool_approval_required` | tool key, run state, requested approval mode |
| `mcp_tool_attempted` | attempt number, timeout budget |
| `mcp_tool_retried` | previous attempt, retry reason, next attempt |
| `mcp_tool_responded` | outcome, record count, source count, retry count |
| `mcp_scope_violation_detected` | violating path, observed site ID, expected site ID |
| `mcp_scope_records_discarded` | discarded count, safe record count |
| `mcp_removal_confirmation_requested` | violation ID, confirmation ordinal (always 1 per violation) |
| `mcp_payload_redacted` | redaction paths, redaction count; never the secret value |
| `mcp_validation_failed` | validator name, error codes, repair attempt if applicable |

Audit is view-only, grouped by site, and retained under the MVP rule of the latest 50 audit rounds per user/site. Store enough payload for diagnosis and evidence, but never hidden chain-of-thought, secrets, credentials, or unrelated personal attributes.

## Deterministic fixture set

Fixtures should be JSON objects consumed by gateway tests and specialist end-to-end tests. They must use fixed IDs, timestamps, ordering, and outcomes; no wall clock, random UUID, live API, or network access is allowed.

| Fixture | Purpose and expected assertion |
|---|---|
| `site-001/healthy-current-site` | Authorized context for `site-001`; one valid `site_status`, device, security, and energy response is accepted. |
| `site-001/cross-site-response` | Response includes valid `site-001` records plus one `site-002` record; the latter is discarded, audited, and never passed to the skill. |
| `site-001/transient-then-success` | `device_health_and_alerts` fails with a timeout on attempt 1 and succeeds on attempt 2; exactly two attempts and one retry event are asserted. |
| `site-001/exhausted-transient` | `energy_timeseries` fails transiently on attempts 1–3; result is `missing_source`, retry count is 2, and no fourth attempt occurs. |
| `site-001/missing-stale-contradictory` | Data analysis receives a precisely labeled quality issue and returns an insufficiency notice/corrective action only for the affected issue. |
| `site-001/report-proving-chain` | Fixed report request exercises `Router → Report Generation → Data Analysis → Report Generation`, validates sources/sections, and yields a draft-only sanitized HTML preview. |
| `site-001/unsafe-report-html` | Script, event-handler, external URL, or external stylesheet is rejected; no draft persistence event is emitted. |
| `site-001/redaction-payload` | Request/response contains token-like values and authorization headers; audit contains redaction markers and no secret values. |
| `portfolio/no-active-site` | Portfolio or invalid route yields no MCP call and a typed site-context error. |

The baseline representative outputs remain compatible with the existing `services/ems-api/tests/test_skill_packages.py` values: `site-001`, fixed 2026-07-22 timestamps, `hvac-07` warning data, `energy_timeseries` source references, and `draft-001` report metadata. Fixture tests should assert exact normalized JSON, event order, counts, and safe error codes. Tests must also prove the four-hat completion gates: routing, current-site access, validation, audit logging, and user-visible truthful output.

## Key decisions

1. **Current site is mandatory context.** MCP receives one active site and cannot search, join, infer, or return cross-site data.
2. **Small named read tools over a generic query tool.** This keeps model selection understandable, makes authorization reviewable, and limits the data surface.
3. **Filter and record scope violations.** Valid current-site data may continue after user-confirmed removal; invalid data is never silently passed through.
4. **Retry only transient failures, twice maximum.** Deterministic failures surface as typed outcomes, and every attempt is auditable.
5. **Structured results are the source of truth.** Text summaries are derived presentation; skills and reports consume typed records, sources, and quality notices.
6. **Fixtures are first-class release evidence.** Each hat and failure path must be reproducible without external services, with exact audit assertions and linked test evidence.

## PostgreSQL-backed MCP evolution

The fixture tool keys remain compatibility aliases while the new EMS repository is introduced:

```text
site_status              → get_site_snapshot
device_health_and_alerts → get_device_health_and_alerts
energy_timeseries        → query_energy_timeseries
report_inputs            → bounded composition of retrieval tools
```

Add `list_site_assets`, `query_weather_observations`, `get_generation_reports`, `get_metric_catalog`, `get_data_quality_summary`, and restricted `get_source_lineage`. All are named read tools; no arbitrary SQL or repository selector is exposed. Responses must include page metadata, freshness, quality, source lineage, and formula metadata for derived metrics. `report_inputs` must preserve the lineage returned by its component tools.

FastAPI must derive the effective site from a short-lived server-issued run capability bound to user, site, session, run, tool allowlist, policy version, expiry, and nonce. The current `_tool_call()` argument merge must not permit a caller-supplied `site_id` to override the authoritative site. Production retrieval applies the site predicate in the repository query before response filtering, uses keyset pagination and server-side limits, and fails closed if durable storage or audit persistence is unavailable.
