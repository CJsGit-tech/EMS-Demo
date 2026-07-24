# EMS Database and MCP Retrieval Design

**Status:** Proposed implementation baseline
**Owner:** Software Architect
**Reviewers:** Backend Architect, Data Engineer, MCP Builder, Security Engineer, API Tester
**Scope:** Database-backed fake EMS data with production-shaped PostgreSQL contracts
**Source contract:** [Unified EMS schema](../../../docs/EMS-sampledata/ems-unified-schema-table.html)

## Goal

Provide a real PostgreSQL schema and fast, governed retrieval path for EMS site information, device telemetry, quality data, and calculated metrics while using deterministic fake values for local development.

## Architectural decision

Add an `ems` bounded context beside the existing AgentCrew persistence. Do not merge telemetry tables into `DurableRepository`, and do not let the LLM query PostgreSQL directly. FastAPI remains the authority for identity, site authorization, repositories, calculation state, audit, and MCP policy. FastMCP remains a stateless delegate.

The data path is:

```text
fake/device source
  → bronze ingestion and lineage
  → silver canonical observations
  → calculation worker
  → persisted derived metrics/materialized serving views
  → typed FastAPI retrieval service
  → bounded MCP tools
  → AgentCrew specialist / LLM
```

## Storage layers

### Bronze: replayable source data

Required tables:

- `source_files`: source identity, content hash, source system, datatype, load status, parser version, and timestamps.
- `ingestion_runs`: batch identity, schema fingerprint, parser version, status, counts, and error summary.
- `raw_file_rows`: source row number, raw JSON payload, row hash, and ingestion run lineage.
- `rejected_rows`: raw payload, rejection code, parser version, and retry/quarantine state.

Bronze is immutable for a given source/run. Fake seeds must populate synthetic source files and ingestion runs so lineage tests do not bypass the ingestion contract.

### Silver: canonical EMS data

Required tables:

- `sites`: internal key plus unique external site code, timezone, capacity history, and lifecycle metadata.
- `assets`: site-owned devices with stable external identity and effective dates.
- `asset_channels`: metric/channel vocabulary for an asset.
- `column_dictionary`: source column to canonical metric mapping, unit, semantic role, and parser version.
- `metric_dictionary`: controlled metric code, class, canonical unit, aggregation rule, formula version, dependencies, and effective dates.
- `canonical_observations`: one normalized observation with site, optional asset/channel, event time, metric, typed value, unit, quality, and source lineage.
- `quality_events`: non-destructive quality findings linked to observations or ingestion rows.

Canonical rows must enforce:

- exactly one of `value_numeric` and `value_text`, unless the metric contract explicitly supports a null value;
- valid metric/unit compatibility;
- `channel_id` implies `asset_id`;
- asset and channel belong to the observation site;
- controlled quality states such as `valid`, `degraded`, `insufficient`, and `rejected`;
- deterministic natural-key or record-hash idempotency.

Keep the AgentCrew-facing string `site_id` as the external/business identifier initially. EMS tables may use an internal numeric `site_pk`, but every API and MCP response must expose the stable external site code. Do not change existing AgentCrew string columns to numeric keys in the first migration.

### Gold: fast serving and calculated values

Persist calculations when they are expensive, frequently requested, needed for reports, or required to be reproducible. Add `derived_metric_values` with:

```text
site_id, asset_id, metric_code, period_start, period_end,
value_numeric, unit_code, quality_state, formula_version,
calculated_at, source_window_hash
```

Use materialized views for common dashboard/LLM summaries, including site daily energy, inverter summaries, weather summaries, and generation reports. Use regular views for inexpensive calculations that must always reflect the newest canonical rows.

Never sum cumulative counters as interval energy. Every derived value must preserve its aggregation rule, input dependencies, coverage, quality, formula version, and calculation time.

The calculation worker recalculates only affected time windows after ingestion. A formula-version change invalidates or backfills the affected derived rows. Freshness is queryable and returned to the LLM; stale values are not silently presented as current.

## MCP retrieval contract

Expose small, named, read-only tools. There is no generic SQL, table, join, URL, or repository-selector tool.

| Tool | Data source | Default policy |
|---|---|---|
| `get_site_snapshot` | site and serving summaries | authorized read |
| `list_site_assets` | assets and channels | authorized read |
| `query_energy_timeseries` | typed energy/inverter serving views | authorized read |
| `query_weather_observations` | weather serving view | authorized read |
| `get_device_health_and_alerts` | device/alert serving view | authorized read; sensitive fields restricted |
| `get_generation_reports` | persisted derived metrics | authorized read |
| `get_metric_catalog` | metric dictionary | authorized read |
| `get_data_quality_summary` | quality events and coverage summaries | authorized read |
| `get_source_lineage` | source files and column dictionary | approval-gated or restricted |

`report_inputs` is an application composition step that calls bounded retrieval tools; it is not a general database tool.

Every MCP request uses a strict Pydantic input model. Time-series queries require an inclusive `start` and exclusive `end`, a bounded maximum range, a maximum of 1,000 rows per page, opaque keyset cursors, approved metric codes, and bounded response bytes. The model cannot choose its effective site: FastAPI derives site/user/session/run identity from authoritative server state and treats any supplied site as an assertion to validate.

Every response includes site identity, records, page metadata, quality summary/notices, freshness, source lineage, and a typed outcome (`success`, `no_data`, `insufficient_data`, `validation_error`, `unauthorized`, `missing_source`, or `unavailable`). Derived metrics also include formula version, dependencies, aggregation rule, and calculated-at time.

## Security and audit controls

- FastMCP is an untrusted client of FastAPI even when it presents the internal service token.
- FastAPI issues a short-lived run capability bound to subject user, site, run, session, allowed tools, policy version, expiry, and nonce.
- Approvals are scoped to user + site + session + run + tool + policy version and expire; `approve_all_session` cannot authorize future writes or another site.
- Server-owned retry sequencing and a persisted request nonce prevent replay and duplicate reads.
- All repository queries apply the authorized site predicate before returning data; response filtering is defense in depth, not the primary isolation control.
- Imported EMS strings are untrusted evidence and are allowlisted before entering model context.
- Rejected/quarantined rows never reach the LLM.
- MCP audit records include normalized argument hash, capability/approval IDs, retry chain, response hash, quality snapshot, lineage, and formula version.
- Production database or audit failures fail closed; fixture fallback is available only when explicitly configured for demo mode.

## Fake data policy

Fake data is allowed for sites, assets, channels, source manifests, observations, quality cases, derived metrics, and MCP responses. Seeds must be deterministic, versioned, timezone-aware, and synthetic. They must never be described as live device data. Each seed row must retain realistic source lineage and quality metadata so the same database path is exercised in development and tests.

## Delivery gates

Implementation is not complete until evidence exists for:

1. Clean Alembic upgrade, downgrade, and re-upgrade.
2. Deterministic fake seed repeatability and manifest hash.
3. Duplicate-safe ingestion and rejected-row replay.
4. Cross-site authorization with two users and two sites.
5. Golden calculations for interval energy, cumulative counters, PR, efficiency, achievement rate, and CO₂ reduction.
6. Materialized-view refresh and stale-data behavior.
7. MCP schema, limits, pagination, typed errors, lineage, and prompt-injection tests.
8. Database → API → MCP → AgentCrew → frontend retrieval, including restart persistence and proof that fixture mode was not silently used.

