# Verde EMS AgentCrew MVP — API Test Plan

**Status:** Ready for implementation  
**Owner:** API Tester  
**Dependencies:** `03-api-and-run-state-contract.md`, `04-agent-routing-and-output-contracts.md`, `05-mcp-tool-contracts-and-fixtures.md`, `09-security-threat-model-and-controls.md`  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)

| Area | Required tests |
|---|---|
| Context | portfolio/unknown/invalid routes rejected; valid site context accepted; user/site binding enforced |
| Sessions | create/end, site change invalidation, expiry, approval reset |
| Routing | all four hats; report handoff chain; unknown intent clarification |
| MCP | typed parameters, current-site filtering, cross-site discard, two-retry cap, every attempt audited |
| Approvals | one-step, session approval, rejection, expiry, policy-version invalidation |
| Validation | schema/semantic/source/HTML checks; three repairs; `failed_validation` preservation |
| Data quality | missing, stale, contradictory, empty, and fresh fixtures |
| Reports | sanitized preview, source/section requirements, draft save, confirmed revision, five-version retention |
| Resilience | idempotency conflicts, interrupted checkpoint, explicit resume, safe upstream failure |
| Privacy | secret redaction, no hidden reasoning, user/site audit filtering |

Every test names its fixture, expected status/error code, audit assertions, and idempotency behavior. No success test may assert only an HTTP 2xx; it must assert typed output and persisted lineage.
| Memory/persona | Recall rejects invalid site route, returns only same-site messages/preferences, versions explicit preferences, and never exposes hidden reasoning | `services/ems-api/tests/test_fastapi_app.py::test_memory_and_preferences_are_site_scoped` |

## EMS database, calculations, and MCP matrix

| Area | Required database/MCP evidence |
|---|---|
| Migration | Empty PostgreSQL upgrade, downgrade, re-upgrade, foreign keys, composite site integrity, checks, partitions, and materialized-view definitions |
| Fake seed | Same seed/version produces the same logical sites, devices, observations, derived metrics, quality flags, and manifest hash |
| Ingestion | File/content deduplication, concurrent retry safety, raw-row lineage, rejected-row replay, and no duplicate canonical facts |
| Calculations | Golden interval/cumulative energy semantics, PR, efficiency, achievement rate, CO₂ reduction, formula versions, and divide-by-zero/missing-input behavior |
| Freshness | Affected-window recalculation, materialized-view refresh, stale metric classification, and formula-version backfill/invalidation |
| MCP schema | Named tools only; strict Pydantic inputs; no SQL/table/URL selectors; bounded ranges, metrics, page size, bytes, and statement timeout |
| MCP authorization | Forged identity, cross-site asset/channel, expired capability, approval carryover, nonce replay, and run/session mismatch fail closed before repository access |
| MCP output | Site identity, ordered records, units, quality/freshness, keyset cursor, source lineage, formula version, and typed outcomes are present |
| LLM safety | Telemetry prompt injection and secret-like values cannot alter tool selection or enter model/audit/report payloads |
| End to end | Seed → PostgreSQL → FastAPI → MCP → AgentCrew → UI returns the expected value after API restart without fixture fallback |

Performance tests must include indexed site/time retrieval, derived metric retrieval, 10× seed volume, response-byte limits, and concurrent MCP calls. Capture `EXPLAIN (ANALYZE, BUFFERS)` and p50/p95/p99 latency evidence.
