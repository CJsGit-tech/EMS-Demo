# Current Architecture and Logical DB Schema

**Status:** Current MVP reference  
**Owner:** Software Architect  
**Dependencies:** [Framework and Runtime Decisions](00-framework-decisions.md), [System Architecture](02-system-architecture.md), [Agent Memory and User Preferences Design](15-agent-memory-and-user-preferences-design.md), `services/ems-api/src/agentcrew/app.py`, `service.py`, and `mcp_server.py`  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)

The EMS database and MCP target design is defined in [16-ems-database-and-mcp-design.md](16-ems-database-and-mcp-design.md). This document describes the existing AgentCrew persistence baseline; the EMS telemetry schema is a separate bounded context and must not be folded into `DurableRepository`.

## Architecture

```mermaid
flowchart LR
  User["Operations manager"] --> UI["React/Vite site workspace"]
  UI -->|REST + site context| API["FastAPI + Uvicorn :8002"]
  API --> Service["AgentCrewService<br/>authoritative orchestration + repository adapter"]
  Service --> Router["Router + allowlisted handoffs"]
  Router --> Skills["Four runtime skills"]
  Service --> Provider["OpenAIProvider<br/>Responses API · gpt-5-mini"]
  Provider --> Model["OpenAI API<br/>server-side key"]
  Model --> Provider
  Provider --> Validate
  Skills --> MCP["FastMCP :8003<br/>streamable HTTP"]
  MCP -->|service token| Internal["FastAPI internal delegation"]
  Internal --> Gateway["FixtureGateway<br/>scope · approval · retry · audit"]
  Gateway --> EMS["Current-site deterministic fixtures"]
  Gateway --> Service
  Service --> Validate["Typed validation + HTML sanitization"]
  Validate --> Service
  Service --> UI
```

The frontend calls only FastAPI. FastMCP is a separate, stateless delegate; FastAPI owns runs, approvals, reports, audits, idempotency, and tool policy.

The designed memory extension adds a FastAPI-owned Memory Manager. It retrieves bounded, authorized chat history and active preferences for a run, while candidate memories remain inactive until user confirmation. The current runtime does not yet persist this design.

## Logical database schema

The local fixture profile uses process-local dictionaries and lists when no `DATABASE_URL` is supplied. When PostgreSQL is configured, the FastAPI-owned repository adapter persists the same site-scoped boundary described below; the migration is checked in under `services/ems-api/migrations/`:

```mermaid
erDiagram
  SITE_CONTEXT ||--o{ AGENT_RUN : scopes
  AGENT_RUN ||--o{ APPROVAL : requests
  AGENT_RUN ||--o{ HANDOFF : records
  AGENT_RUN ||--o{ MCP_ATTEMPT : invokes
  AGENT_RUN ||--o{ AUDIT_EVENT : emits
  AGENT_RUN ||--o| REPORT_DRAFT : produces
  REPORT_DRAFT ||--o{ REPORT_SOURCE : cites
  MCP_ATTEMPT ||--o{ AUDIT_EVENT : audits
  USER_PROFILE ||--o{ CONVERSATION : owns
  CONVERSATION ||--o{ CHAT_MESSAGE : contains
  CHAT_MESSAGE ||--o{ MEMORY_ITEM : sources
  USER_PROFILE ||--o{ USER_PREFERENCE : configures
  MEMORY_ITEM ||--o{ MEMORY_ACCESS_EVENT : audits
```

Logical entities are `SITE_CONTEXT`, `AGENT_RUN`, `APPROVAL`, `HANDOFF`, `MCP_ATTEMPT`, `AUDIT_EVENT`, `REPORT_DRAFT`, `REPORT_SOURCE`, `USER_PROFILE`, `CONVERSATION`, `CHAT_MESSAGE`, `MEMORY_ITEM`, `USER_PREFERENCE`, and `MEMORY_ACCESS_EVENT`. All records carry site identity where data isolation matters; audit payloads are redacted and report HTML is sanitized before persistence.

The full standalone artifact is [current-architecture-and-db-schema.html](../current-architecture-and-db-schema.html).

## EMS telemetry persistence target

The current migration contains AgentCrew operational tables only. The planned EMS context adds Bronze/Silver/Gold layers:

```text
Bronze: source_files → ingestion_runs → raw_file_rows / rejected_rows
Silver: sites → assets → asset_channels → canonical_observations
        column_dictionary + metric_dictionary + quality_events
Gold:   derived_metric_values + materialized serving views
```

`derived_metric_values` stores expensive, frequently requested, report-critical, or reproducibility-sensitive calculations. Materialized views serve common site, device, weather, energy, and generation summaries quickly. Each value carries quality, freshness, formula version, dependencies, calculation time, and source-window lineage.

AgentCrew continues to use its existing string `site_id` contract. EMS may use an internal numeric site key, but external API/MCP contracts expose the stable site code. A future key migration requires a separate expand-and-contract decision.

The authoritative retrieval path is `PostgreSQL → async EMS repository → FastAPI → FastMCP typed read tool → AgentCrew`. Fixture mode is explicitly selected for deterministic demos and cannot silently replace production database reads.
