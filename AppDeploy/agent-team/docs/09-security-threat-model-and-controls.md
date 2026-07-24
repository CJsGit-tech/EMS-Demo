# Verde EMS AgentCrew MVP — Security Threat Model and Controls

The OpenAI provider is server-side only. `OPENAI_API_KEY` is never sent to the browser, MCP tool payloads, audit records, prompts returned to users, or report output. Responses requests use `store=false`; only validated specialist output and safe model metadata are retained locally.

**Status:** Ready for implementation  
**Owner:** Security Engineer  
**Dependencies:** `02-system-architecture.md`, `03-api-and-run-state-contract.md`, `04-agent-routing-and-output-contracts.md`, `05-mcp-tool-contracts-and-fixtures.md`  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)

Memory and preference controls are site-bound by `(user_id, site_id, session_id)`, with explicit confirmation for inferred memories and no hidden reasoning storage. The browser exposes reviewable memory/persona controls, while FastAPI performs authorization and redaction.

## Primary threats and controls

| Threat | Control |
|---|---|
| Cross-site read or confused deputy | Server-side session site binding; every MCP request/response filtered by immutable active `site_id`; audit violations. |
| Forged approval or approval carryover | Bind approval to user, session, site, action key, policy version, and expiry; invalidate on site/user/policy change. |
| Prompt/tool injection through EMS data | Treat tool data as untrusted; typed schemas, allowlisted tools/handoffs, no arbitrary tool creation. |
| Unsafe report HTML | Reject scripts, handlers, external URLs/stylesheets, unsafe SVG; render in sandboxed preview; validate before persistence. |
| Secret leakage in audit | Redact credentials/tokens/headers before persistence and response; never store hidden chain-of-thought. |
| Unauthorized audit access | Filter by current user and authorized site; view-only; no replay, mutation, or export. |
| Unsafe personalization | Store approved user/agent overlays only; sandbox validation; forbid permissions, scope, approval, and tool changes. |
| Resource exhaustion | Bound retries, repair attempts, report size, history retention, request idempotency, MCP time ranges, page size, response bytes, and database statement timeouts. |

## EMS database and MCP controls

FastMCP is an untrusted client of FastAPI. A shared service token authenticates the delegate process only; it does not authorize caller-supplied `user_id`, `site_id`, `session_id`, or `run_id`. FastAPI must issue and validate a short-lived capability containing the authenticated subject, site, run, session, allowlisted tools, policy version, expiry, and nonce before an EMS repository query.

EMS strings such as `asset_name`, `status`, `value_text`, imported source columns, file names, and JSON metadata are untrusted evidence. Only allowlisted fields enter model context; raw source payloads, credentials, arbitrary paths, and instructions embedded in telemetry are excluded. Rejected or quarantined rows never reach the LLM.

MCP read tools are strictly named and typed. They enforce server-side time windows, metric allowlists, keyset cursor binding, page/byte limits, and database statement timeouts. Every response includes quality/freshness/lineage metadata. Derived metrics include formula version and dependencies. No first-release MCP write tools are allowed.

MCP acceptance must cover forged identity, cross-site asset/channel IDs, approval carryover, expired capabilities, nonce replay, oversized queries, prompt injection in telemetry, secret-like values in nested metadata, database outage fail-closed behavior, and report source references that are not a subset of observed tool lineage.

## Security acceptance checks

Cross-site request/response is rejected and audited; expired approvals fail closed; session approval cannot cross sites; malicious HTML is rejected; audit payloads contain no secrets; report iframe is sandboxed; untrusted data cannot create tools or handoffs; all failures return safe typed messages.
