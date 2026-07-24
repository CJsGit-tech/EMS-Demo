# Verde EMS AgentCrew MVP — Local Development and Operations Runbook

**Status:** Implemented local MVP runbook  
**Owner:** Technical Writer  
**Dependencies:** all implementation documents, repository manifests, test/evidence results  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)

## Startup

Install and lock the backend dependencies with `cd services/ems-api && uv sync`. Start the authoritative REST service in one terminal:

```bash
cd services/ems-api
PYTHONPATH=src uv run --env-file ../../.env uvicorn agentcrew.app:app --host 127.0.0.1 --port 8002
```

Start the separate FastMCP process in a second terminal:

```bash
cd services/ems-api
PYTHONPATH=src uv run --env-file ../../.env python -m agentcrew mcp
```

FastAPI is available at `http://127.0.0.1:8002`; FastMCP streamable HTTP is available at `http://127.0.0.1:8003/mcp`. With `OPENAI_API_KEY` present, the backend defaults to the OpenAI provider and `OPENAI_MODEL` defaults to `gpt-5-mini`. Set `EMS_PROVIDER_MODE=deterministic-fixtures` when running offline tests. Configure `EMS_SERVICE_TOKEN` identically in both processes when changing the local default. The frontend runs with `cd apps/site-integration-app && npm install && npm run dev` and calls only the FastAPI REST base URL.

## Verification

Run `cd services/ems-api && uv run pytest -q`, `cd apps/site-integration-app && npm run build`, and the in-app browser evidence journeys in `11-visual-e2e-evidence-matrix.md`. Verify `curl http://127.0.0.1:8002/healthz`, `curl http://127.0.0.1:8002/readyz`, the REST run/approval flow, and an official MCP client handshake against `http://127.0.0.1:8003/mcp`. Use deterministic fixture names so failures are reproducible. Record commands, environment assumptions, and screenshot paths in the readiness record.

## Operations rules

Keep the local store disposable and never use production credentials. Inspect site/session/run IDs when debugging. Preserve audit records for failing tests, redact payloads before sharing, and never export or replay audit data. If a run is interrupted, resume only through the API’s explicit checkpoint flow.

FastMCP must not be started without FastAPI because it delegates all state and tool policy to the internal FastAPI endpoints. A `401` from `/internal/agentcrew/*` normally means the service token differs between processes. A `409` or `waiting_for_tool_approval` response is expected until the browser resolves the run approval.

## Documentation ownership

Role owners update their assigned document when an interface or behavior changes. Technical Writer updates this runbook and links the change to the owning document. `AppDeploy/AGENTS.md` remains the global operating contract; this runbook must not redefine its safety rules.
For the durable persistence path, start the local database with:

```bash
docker run --name verde-ems-postgres -e POSTGRES_USER=ems -e POSTGRES_PASSWORD=ems -e POSTGRES_DB=ems -p 5432:5432 -v verde-ems-postgres-data:/var/lib/postgresql/data -d postgres:16-alpine
```

Then run `docker exec verde-ems-postgres pg_isready -U ems -d ems` and, from `services/ems-api`, run `DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems EMS_PERSISTENCE_MODE=postgres uv run alembic upgrade head`. Start FastAPI with the same two environment variables plus `uv run --env-file ../../.env uvicorn agentcrew.app:app --host 127.0.0.1 --port 8002`. Without `DATABASE_URL`, deterministic fixture mode intentionally uses the local compatibility repository for the browser demo. The migration can be syntax-checked offline with `uv run alembic upgrade head --sql`.

## EMS fake-data database profile

The database-backed development profile uses deterministic synthetic data only. It must be explicitly enabled and must never be mistaken for live device data:

```bash
cd services/ems-api
DATABASE_URL=postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems \
EMS_PERSISTENCE_MODE=postgres \
EMS_DATA_PROFILE=deterministic-fake \
uv run alembic upgrade head
uv run python -m agentcrew seed-ems --seed-version 1
```

The seed creates synthetic sites, assets, channels, source files, ingestion runs, canonical observations, quality cases, and derived metrics. It records a manifest hash and fixed timestamps. Running the same seed twice must not create duplicate source files or canonical facts.

## EMS calculation and serving operations

After an ingestion batch, the calculation worker recalculates only the affected site/asset/time windows and upserts `derived_metric_values`. Refresh materialized serving views after successful calculation. Every result exposes `calculated_at`, `formula_version`, `quality_state`, and freshness. A formula-version change requires an explicit backfill command; it must not silently overwrite historical values.

The first release uses application-managed jobs and PostgreSQL materialized views. A queue, Redis, TimescaleDB, or external scheduler requires a separate framework decision before introduction.

## MCP retrieval verification

Start FastAPI before FastMCP. Verify the named retrieval tools with bounded inputs and confirm that the response contains site identity, page metadata, quality/freshness, source lineage, and formula metadata. Test a second site, a forged site assertion, an expired capability, an oversized time window, an invalid cursor, and a replayed nonce. Production database or audit failure must return a typed unavailable result and must not fall back to fixtures.
