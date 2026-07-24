# EMS Database and MCP Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a PostgreSQL-backed EMS bounded context with deterministic fake site/device data, persisted calculated metrics, fast serving views, and typed site-scoped MCP retrieval for AgentCrew.

**Architecture:** Keep AgentCrew operational persistence separate from EMS telemetry persistence. Ingest synthetic source files into Bronze lineage tables, normalize into Silver canonical observations, calculate selected metrics into `derived_metric_values` and materialized views, expose bounded async FastAPI repositories, and let FastMCP delegate named read tools to FastAPI.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2 async, asyncpg, Alembic, PostgreSQL 15+, Pydantic, FastMCP streamable HTTP, pytest, deterministic seed fixtures, React/Vite REST-only frontend.

## Global Constraints

- Use the accepted PostgreSQL 15+, SQLAlchemy 2 async, asyncpg, and Alembic decisions in `AppDeploy/agent-team/docs/00-framework-decisions.md`.
- Do not merge EMS telemetry repositories into `services/ems-api/src/agentcrew/persistence.py`.
- Keep the existing AgentCrew external `site_id` string contract; use an internal EMS key only behind the EMS repository.
- Every repository query and MCP result is bound to exactly one server-authorized site.
- MCP exposes named read-only tools only; no arbitrary SQL, table names, joins, URLs, or repository selectors.
- Time-series windows are inclusive at `from` and exclusive at `to`; raw windows are limited to 31 days and aggregated windows to 366 days.
- MCP pages default to 100 records, cap at 1,000 records and approximately 2 MB, and use opaque keyset cursors.
- The server owns retry sequencing; transient MCP failures retry at most twice.
- Fake data is deterministic, versioned, timezone-aware, synthetic, and never presented as live device data.
- Persist derived values only when expensive, frequently requested, report-critical, audited, or required for reproducibility.
- Derived values always include quality state, freshness/calculated-at timestamp, formula version, dependencies, aggregation rule, and source-window lineage.
- Production database or audit failure fails closed; fixture fallback is enabled only by explicit deterministic-demo configuration.
- Do not expose hidden chain-of-thought, credentials, raw secrets, or unclassified source payloads to the model, browser, or audit projection.

---

## File Map

Create the EMS bounded context under `services/ems-api/src/ems/`:

- `models.py`: SQLAlchemy EMS dimension, ingestion, canonical, quality, and derived metric models.
- `schemas.py`: Pydantic request/response contracts for REST and MCP retrieval.
- `repositories.py`: async site, asset, observation, quality, lineage, and derived-metric queries.
- `service.py`: site authorization boundary, ingestion orchestration, calculation refresh, and retrieval composition.
- `router.py`: `/api/v1/sites/*` routes and internal AgentCrew EMS delegation.
- `ingestion.py`: source manifest, raw-row, quarantine, normalization, and idempotent batch operations.
- `calculations.py`: approved formula registry and affected-window recalculation.
- `seed.py`: deterministic fake data generator and manifest hash.
- `mcp_adapter.py`: compatibility adapter from AgentCrew tool requests to EMS retrieval service.

Create or modify:

- `services/ems-api/migrations/versions/0002_ems_data_foundation.py`
- `services/ems-api/migrations/versions/0003_ems_observations_and_derived_metrics.py`
- `services/ems-api/migrations/versions/0004_ems_serving_views_and_security.py`
- `services/ems-api/src/agentcrew/app.py`
- `services/ems-api/src/agentcrew/mcp.py`
- `services/ems-api/src/agentcrew/mcp_server.py`
- `services/ems-api/src/agentcrew/runtime.py`
- `services/ems-api/src/agentcrew/service.py`
- `services/ems-api/src/agentcrew/persistence.py`
- `services/ems-api/src/agentcrew/config.py`
- `services/ems-api/src/agentcrew/contracts.py`
- `services/ems-api/tests/test_ems_migrations.py`
- `services/ems-api/tests/test_ems_seed.py`
- `services/ems-api/tests/test_ems_ingestion.py`
- `services/ems-api/tests/test_ems_calculations.py`
- `services/ems-api/tests/test_ems_api.py`
- `services/ems-api/tests/test_ems_mcp.py`
- `services/ems-api/tests/test_ems_security.py`
- `services/ems-api/tests/test_ems_performance.py`
- `services/ems-api/tests/conftest.py`
- `docs/EMS-sampledata/ems-unified-schema-table.html`
- `AppDeploy/agent-team/docs/02-system-architecture.md`
- `AppDeploy/agent-team/docs/03-api-and-run-state-contract.md`
- `AppDeploy/agent-team/docs/05-mcp-tool-contracts-and-fixtures.md`
- `AppDeploy/agent-team/docs/09-security-threat-model-and-controls.md`
- `AppDeploy/agent-team/docs/10-api-test-plan-and-contract-matrix.md`
- `AppDeploy/agent-team/docs/13-local-development-and-operations-runbook.md`

---

### Task 1: Establish the EMS module boundary and database test fixture

**Files:**
- Create: `services/ems-api/src/ems/__init__.py`
- Create: `services/ems-api/src/ems/models.py`
- Create: `services/ems-api/src/ems/schemas.py`
- Create: `services/ems-api/src/ems/repositories.py`
- Create: `services/ems-api/src/ems/service.py`
- Modify: `services/ems-api/migrations/env.py`
- Modify: `services/ems-api/tests/conftest.py`
- Test: `services/ems-api/tests/test_ems_migrations.py`

**Interfaces:**
- `ems.models.Base` contributes EMS metadata without changing AgentCrew model ownership.
- `EmsRepository(session_factory)` exposes async methods `get_site(site_code)`, `list_assets(site_code, ...)`, `query_observations(site_code, ...)`, `query_derived_metrics(site_code, ...)`, and `quality_summary(site_code, ...)`.
- `EmsService(repository, authorization, calculation_service)` exposes `retrieve_site_snapshot(context)`, `query_timeseries(context, query)`, and `get_generation_reports(context, query)`.

- [ ] **Step 1: Write the failing metadata-isolation test.** Assert that the EMS metadata contains no AgentCrew table and that the Alembic target metadata includes both metadata collections.

```python
def test_ems_metadata_is_separate_from_agentcrew_metadata():
    from agentcrew.db.models import Base as AgentCrewBase
    from ems.models import Base as EmsBase

    assert set(EmsBase.metadata.tables) == set()
    assert "chat_sessions" in AgentCrewBase.metadata.tables
```

- [ ] **Step 2: Run the focused test and verify it fails because `ems` is absent.**

Run: `cd services/ems-api && uv run pytest -q tests/test_ems_migrations.py::test_ems_metadata_is_separate_from_agentcrew_metadata`

Expected: FAIL with `ModuleNotFoundError: No module named 'ems'`.

- [ ] **Step 3: Add the empty module, async repository protocol, and explicit EMS session fixture.** Keep database access native async; do not reuse `DurableRepository._execute()`.

- [ ] **Step 4: Run the focused test.**

Run: `cd services/ems-api && uv run pytest -q tests/test_ems_migrations.py::test_ems_metadata_is_separate_from_agentcrew_metadata`

Expected: PASS.

- [ ] **Step 5: Commit the module boundary.**

```bash
git add services/ems-api/src/ems services/ems-api/migrations/env.py services/ems-api/tests/conftest.py services/ems-api/tests/test_ems_migrations.py
git commit -m "feat: establish EMS persistence boundary"
```

### Task 2: Add dimensions, lineage, ingestion, and metric dictionary migrations

**Files:**
- Create: `services/ems-api/migrations/versions/0002_ems_data_foundation.py`
- Modify: `services/ems-api/src/ems/models.py`
- Test: `services/ems-api/tests/test_ems_migrations.py`

**Interfaces:**
- Tables: `sites`, `assets`, `asset_channels`, `source_files`, `ingestion_runs`, `raw_file_rows`, `rejected_rows`, `column_dictionary`, `metric_dictionary`.
- Site lookup uses unique `external_site_code`; internal `site_pk` is never sent as the external site contract.
- Every source row references `source_file_id` and `ingestion_run_id`.

- [ ] **Step 1: Write PostgreSQL integration tests for all tables and constraints.** Assert unique site codes, site-owned asset/channel composite integrity, file hash/path idempotency, source status checks, metric aggregation checks, and effective-date validity.

- [ ] **Step 2: Run against an empty PostgreSQL database to capture the failing migration state.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run alembic upgrade head`

Expected: FAIL because revision `0002` does not exist.

- [ ] **Step 3: Implement the migration and SQLAlchemy models.** Add `source_system`, `parser_version`, `schema_fingerprint`, load status, row counts, and error fields. Do not use `BIGSERIAL observation_id` as the only idempotency key.

- [ ] **Step 4: Run upgrade, inspect constraints, and downgrade/re-upgrade.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run alembic upgrade head && uv run alembic downgrade -1 && uv run alembic upgrade head`

Expected: PASS with all foundation tables recreated and no orphaned constraints.

- [ ] **Step 5: Commit the foundation migration.**

```bash
git add services/ems-api/migrations/versions/0002_ems_data_foundation.py services/ems-api/src/ems/models.py services/ems-api/tests/test_ems_migrations.py
git commit -m "feat: add EMS dimensions and ingestion lineage"
```

### Task 3: Add canonical observations, quality events, and derived metric storage

**Files:**
- Create: `services/ems-api/migrations/versions/0003_ems_observations_and_derived_metrics.py`
- Modify: `services/ems-api/src/ems/models.py`
- Test: `services/ems-api/tests/test_ems_migrations.py`

**Interfaces:**
- `canonical_observations`: site, optional asset/channel, `event_time`, metric, typed value, unit, quality, source file, ingestion run, record hash, and ingestion timestamp.
- `quality_events`: rule code, severity, affected row/observation, observed value, threshold, and resolution state.
- `derived_metric_values`: site, optional asset, period, metric, value, unit, quality, formula version, calculation timestamp, dependency hash, and source-window hash.

- [ ] **Step 1: Write failing constraint tests.** Cover typed-value XOR, channel implies asset, asset/channel site mismatch, controlled quality states, non-negative physical values, and unique derived metric identity `(site, asset, metric, period_start, period_end, formula_version)`.

- [ ] **Step 2: Implement the partition-safe migration.** Partition `canonical_observations` by `event_time`; include the partition key in unique constraints. Add B-tree indexes for `(site_id, event_time)`, `(site_id, asset_id, event_time)`, `(metric_code, event_time)`, lineage IDs, and BRIN on append-heavy time columns.

- [ ] **Step 3: Run PostgreSQL constraint tests.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run pytest -q tests/test_ems_migrations.py`

Expected: PASS with invalid inserts rejected by PostgreSQL rather than only application validation.

- [ ] **Step 4: Commit canonical and derived storage.**

```bash
git add services/ems-api/migrations/versions/0003_ems_observations_and_derived_metrics.py services/ems-api/src/ems/models.py services/ems-api/tests/test_ems_migrations.py
git commit -m "feat: add canonical observations and derived metrics"
```

### Task 4: Implement deterministic fake seed and idempotent ingestion

**Files:**
- Create: `services/ems-api/src/ems/seed.py`
- Create: `services/ems-api/src/ems/ingestion.py`
- Modify: `services/ems-api/src/agentcrew/__main__.py`
- Test: `services/ems-api/tests/test_ems_seed.py`
- Test: `services/ems-api/tests/test_ems_ingestion.py`

**Interfaces:**
- `seed_ems(session_factory, seed_version: int = 1) -> SeedManifest`.
- `SeedManifest` includes `seed_version`, logical row counts, fixed time range, and `manifest_hash`.
- `ingest_source_file(session, source, parser_version) -> IngestionRunResult` uses file hash/path and row hash conflict handling.
- Seeded examples include at least two sites, inverter/weather/site-energy assets, valid rows, stale rows, duplicate timestamps, outliers, unit mismatch, and quarantined rows.

- [ ] **Step 1: Write repeatability and duplicate-ingestion tests.** Run the same seed on two empty databases and twice on one database; compare logical row hashes and assert no duplicate source files or canonical facts.

- [ ] **Step 2: Implement fixed-time synthetic generation.** Use stable external IDs and UTC-normalized timestamps; never read raw CSV cell contents and never use wall-clock or random values in the seed.

- [ ] **Step 3: Implement Bronze-to-Silver ingestion.** Preserve raw payloads, classify rejects, normalize units/timezones, resolve site/asset/channel mappings, and upsert canonical facts by deterministic record hash/natural key.

- [ ] **Step 4: Run the focused tests.**

Run: `cd services/ems-api && uv run pytest -q tests/test_ems_seed.py tests/test_ems_ingestion.py`

Expected: PASS with identical logical seed manifests and safe concurrent duplicate handling.

- [ ] **Step 5: Commit the seed/ingestion slice.**

```bash
git add services/ems-api/src/ems/seed.py services/ems-api/src/ems/ingestion.py services/ems-api/src/agentcrew/__main__.py services/ems-api/tests/test_ems_seed.py services/ems-api/tests/test_ems_ingestion.py
git commit -m "feat: add deterministic EMS seed and ingestion"
```

### Task 5: Implement approved calculations and serving views

**Files:**
- Create: `services/ems-api/src/ems/calculations.py`
- Create: `services/ems-api/migrations/versions/0004_ems_serving_views_and_security.py`
- Modify: `services/ems-api/src/ems/seed.py`
- Test: `services/ems-api/tests/test_ems_calculations.py`

**Interfaces:**
- `calculate_affected_window(session, site_code, start, end) -> CalculationBatchResult`.
- `FORMULA_REGISTRY` maps approved metric codes to fixed calculation functions and metadata; database formula text is descriptive metadata, never executable model input.
- Views/materialized views: `site_daily_energy`, `inverter_summary`, `weather_summary`, `generation_report_summary`.

- [ ] **Step 1: Write golden tests with hand-worked expected results.** Include interval energy summation, cumulative-counter non-summation, PR, efficiency, achievement rate, CO₂ reduction, missing inputs, zero denominator, degraded quality, and stale-source behavior.

- [ ] **Step 2: Implement formula registry and affected-window upserts.** Each upsert stores formula version, dependency metric codes, quality state, source-window hash, and calculation timestamp.

- [ ] **Step 3: Add materialized view definitions and refresh function.** Refresh only after a successful calculation batch; expose a freshness timestamp and return stale state when refresh age exceeds the metric contract.

- [ ] **Step 4: Run the calculation tests and inspect results.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run pytest -q tests/test_ems_calculations.py`

Expected: PASS with exact golden values and explicit insufficiency for missing/invalid inputs.

- [ ] **Step 5: Commit the calculation/serving slice.**

```bash
git add services/ems-api/src/ems/calculations.py services/ems-api/migrations/versions/0004_ems_serving_views_and_security.py services/ems-api/src/ems/seed.py services/ems-api/tests/test_ems_calculations.py
git commit -m "feat: persist EMS derived metrics and serving views"
```

### Task 6: Add async EMS repositories, FastAPI routes, and typed response contracts

**Files:**
- Modify: `services/ems-api/src/ems/schemas.py`
- Modify: `services/ems-api/src/ems/repositories.py`
- Modify: `services/ems-api/src/ems/service.py`
- Create: `services/ems-api/src/ems/router.py`
- Modify: `services/ems-api/src/agentcrew/app.py`
- Modify: `services/ems-api/src/agentcrew/config.py`
- Test: `services/ems-api/tests/test_ems_api.py`

**Interfaces:**
- `SiteScopedQuery(site_id, from_, to, asset_id, channel_id, metric_codes, interval, include_degraded, limit, cursor)`.
- `RetrievalResult(run_id, session_id, site_id, tool_key, outcome, records, page, quality, freshness, sources, query_metadata, error)`.
- Routes: `GET /api/v1/sites/{site_code}`, `/assets`, `/observations`, `/weather`, `/energy`, `/reports`, `/metrics`.

- [ ] **Step 1: Write route contract tests.** Assert half-open time ranges, authorization, ordering, cursor binding, max limits, units, quality, freshness, lineage, and typed errors for empty/malformed/unknown queries.

- [ ] **Step 2: Implement Pydantic validation and async repositories.** Derive authorized site from server context; use fixed SQLAlchemy query builders with mandatory site predicates before serialization.

- [ ] **Step 3: Add bounded query settings.** Enforce maximum range, page size, response bytes, asset/metric counts, and PostgreSQL statement timeout.

- [ ] **Step 4: Run API contract tests.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run pytest -q tests/test_ems_api.py`

Expected: PASS for two authorized sites and negative cross-site cases with no existence leaks.

- [ ] **Step 5: Commit the EMS API slice.**

```bash
git add services/ems-api/src/ems services/ems-api/src/agentcrew/app.py services/ems-api/src/agentcrew/config.py services/ems-api/tests/test_ems_api.py
git commit -m "feat: expose site-scoped EMS retrieval APIs"
```

### Task 7: Replace fixture-only MCP reads with bounded typed EMS tools

**Files:**
- Modify: `services/ems-api/src/agentcrew/mcp.py`
- Modify: `services/ems-api/src/agentcrew/mcp_server.py`
- Modify: `services/ems-api/src/agentcrew/runtime.py`
- Modify: `services/ems-api/src/agentcrew/contracts.py`
- Create: `services/ems-api/src/ems/mcp_adapter.py`
- Test: `services/ems-api/tests/test_ems_mcp.py`

**Interfaces:**
- Named tools: `get_site_snapshot`, `list_site_assets`, `query_energy_timeseries`, `query_weather_observations`, `get_device_health_and_alerts`, `get_generation_reports`, `get_metric_catalog`, `get_data_quality_summary`, `get_source_lineage`.
- `ToolResult` gains `page`, `quality`, `freshness`, `query_metadata`, and structured lineage while retaining compatibility aliases for existing fixture keys.
- `report_inputs` composes bounded calls and no longer performs an unbounded energy read.

- [ ] **Step 1: Write MCP contract tests.** Assert strict schemas, named-tool allowlist, bounded query rejection, no arbitrary SQL fields, typed no-data/insufficient/unavailable outcomes, and lineage/formula metadata.

- [ ] **Step 2: Fix authoritative site argument handling.** Remove or reject caller-supplied `site_id` in tool arguments; do not allow the current `{"site_id": site_id, **arguments}` merge to override server context.

- [ ] **Step 3: Implement the EMS adapter behind the current gateway.** Keep `FixtureRepository` and `PostgresRepository` behind the same normalized result interface; switch by explicit server configuration, never by model input.

- [ ] **Step 4: Run MCP tests.**

Run: `cd services/ems-api && uv run pytest -q tests/test_ems_mcp.py tests/test_mcp_server.py`

Expected: PASS with existing fixture compatibility and PostgreSQL-backed tool responses.

- [ ] **Step 5: Commit the typed MCP slice.**

```bash
git add services/ems-api/src/agentcrew/mcp.py services/ems-api/src/agentcrew/mcp_server.py services/ems-api/src/agentcrew/runtime.py services/ems-api/src/agentcrew/contracts.py services/ems-api/src/ems/mcp_adapter.py services/ems-api/tests/test_ems_mcp.py
git commit -m "feat: add bounded EMS MCP retrieval tools"
```

### Task 8: Bind MCP identity, approvals, replay protection, and fail-closed persistence

**Files:**
- Modify: `services/ems-api/src/agentcrew/service.py`
- Modify: `services/ems-api/src/agentcrew/persistence.py`
- Modify: `services/ems-api/src/agentcrew/app.py`
- Modify: `services/ems-api/src/agentcrew/mcp_server.py`
- Modify: `services/ems-api/src/agentcrew/db/models.py`
- Create: `services/ems-api/migrations/versions/0005_ems_mcp_capabilities_and_attempts.py`
- Test: `services/ems-api/tests/test_ems_security.py`

**Interfaces:**
- Capability fields: `subject_user_id`, `site_id`, `run_id`, `session_id`, `allowed_tool_keys`, `approval_id`, `policy_version`, `expires_at`, `nonce`.
- Attempt idempotency key: `(run_id, tool_key, normalized_args_hash, nonce)`.
- Approval fields: user, site, session, run, tool, mode, policy version, expiry, consumed/revoked state.

- [ ] **Step 1: Write security tests first.** Cover forged body identity, site/run/session mismatch, expired/revoked capability, approval carryover, nonce replay, attempts out of order, oversized payload, cross-site asset/channel, prompt injection strings, nested secret redaction, and database outage.

- [ ] **Step 2: Implement signed short-lived capability validation.** FastAPI resolves identity from server-side run state; FastMCP submits the capability and cannot redefine the user/site/run context.

- [ ] **Step 3: Persist scoped expiring approvals and attempt ledger.** Return the prior result on duplicate nonce/normalized arguments without a second repository read. Make production persistence errors fail the request instead of disabling the repository.

- [ ] **Step 4: Run security tests.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run pytest -q tests/test_ems_security.py`

Expected: PASS with every forbidden case failing before EMS data access and every accepted call producing ordered audit evidence.

- [ ] **Step 5: Commit the MCP security slice.**

```bash
git add services/ems-api/src/agentcrew services/ems-api/migrations/versions/0005_ems_mcp_capabilities_and_attempts.py services/ems-api/tests/test_ems_security.py
git commit -m "feat: bind EMS MCP access to scoped capabilities"
```

### Task 9: Integrate AgentCrew report workflow and frontend data path

**Files:**
- Modify: `services/ems-api/src/agentcrew/service.py`
- Modify: `services/ems-api/src/agentcrew/fixtures.py`
- Modify: `apps/site-integration-app/src/agentcrew/api.js`
- Modify: `apps/site-integration-app/src/agentcrew/contracts.ts`
- Modify: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`
- Test: `services/ems-api/tests/test_fastapi_app.py`
- Test: `apps/site-integration-app/tests/agentcrew-api.test.js`

**Interfaces:**
- Report chain consumes `get_site_snapshot`, `get_device_health_and_alerts`, `query_energy_timeseries`, `get_data_quality_summary`, and optional `get_source_lineage`.
- Browser remains REST-only and renders quality/freshness/empty/degraded states without calling MCP or PostgreSQL.

- [ ] **Step 1: Write end-to-end contract tests for persisted derived metric retrieval.** Assert report input sources are a subset of observed MCP lineage and that the report shows formula/freshness metadata where calculations are used.

- [ ] **Step 2: Replace fixture gateway reads behind the adapter.** Keep deterministic compatibility aliases until PostgreSQL mode has parity evidence; do not expose both data sources to the LLM during shadow comparison.

- [ ] **Step 3: Update frontend contracts and states.** Add typed quality, freshness, lineage, cursor, and calculated-metric metadata; keep current site tabs and report preview behavior intact.

- [ ] **Step 4: Run backend and frontend tests.**

Run: `cd services/ems-api && uv run pytest -q tests/test_fastapi_app.py`; `cd apps/site-integration-app && npm test -- --run`

Expected: PASS with the existing four-hat workflow plus database-backed retrieval evidence.

- [ ] **Step 5: Commit the integration slice.**

```bash
git add services/ems-api/src/agentcrew services/ems-api/tests/test_fastapi_app.py apps/site-integration-app/src/agentcrew apps/site-integration-app/tests/agentcrew-api.test.js
git commit -m "feat: connect AgentCrew reports to EMS retrieval"
```

### Task 10: Add performance, restart, and in-app evidence gates

**Files:**
- Create: `services/ems-api/tests/test_ems_performance.py`
- Modify: `AppDeploy/agent-team/docs/12-integration-readiness-checklist.md`
- Modify: `AppDeploy/agent-team/docs/13-local-development-and-operations-runbook.md`
- Test/evidence: in-app browser journeys in `AppDeploy/agent-team/docs/11-visual-e2e-evidence-matrix.md`

**Interfaces:**
- Performance evidence records dataset size, query, plan, p50/p95/p99 latency, error rate, and resource assumptions.
- Readiness record links migration, seed, calculation, MCP security, restart, and browser evidence.

- [ ] **Step 1: Write performance and restart tests.** Seed 10× the baseline volume, query site/time and derived metrics, verify index/partition plans, restart FastAPI, and retrieve the same persisted logical result.

- [ ] **Step 2: Run database-backed performance tests.**

Run: `cd services/ems-api && DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems uv run pytest -q tests/test_ems_performance.py`

Expected: bounded queries use the documented indexes; no unbounded result or sequential scan is accepted without an explicit evidence note.

- [ ] **Step 3: Run the full backend/frontend validation.**

Run: `cd services/ems-api && uv run pytest -q`; `cd apps/site-integration-app && npm run build && npm test -- --run`

Expected: PASS, or an explicit environment-blocked record for missing PostgreSQL/asyncpg rather than a claim of completion.

- [ ] **Step 4: Capture in-app browser evidence.** Verify active-site identity, fast calculated metric retrieval, stale/insufficient states, report lineage, and no cross-site data leak.

- [ ] **Step 5: Update readiness documents and commit evidence.**

```bash
git add services/ems-api/tests/test_ems_performance.py AppDeploy/agent-team/docs/12-integration-readiness-checklist.md AppDeploy/agent-team/docs/13-local-development-and-operations-runbook.md
git commit -m "test: verify EMS database and MCP readiness"
```

---

## Self-review checklist

- [ ] All design requirements in `AppDeploy/agent-team/docs/16-ems-database-and-mcp-design.md` map to Tasks 1–10.
- [ ] No task treats `observation_id` alone as idempotency for a partitioned fact table.
- [ ] No task exposes arbitrary SQL or trusts caller-supplied site identity.
- [ ] Persisted calculations include freshness, formula version, dependencies, quality, and source-window lineage.
- [ ] Fake data is deterministic and explicitly labeled.
- [ ] Every task has exact files, interfaces, tests, commands, expected results, and a commit boundary.
- [ ] The existing fixture-backed demo remains available only through explicit configuration during migration.
- [ ] The final acceptance path is seed → PostgreSQL → FastAPI → MCP → AgentCrew → frontend, including restart and security evidence.

