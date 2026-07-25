# Task 4 — GPT-5-mini runtime configuration

## Delivered

- Compose now injects `OPENAI_API_KEY` from the host environment and defaults `OPENAI_MODEL` to `gpt-5-mini`; the key is not baked into the image or printed.
- Compose defaults the API provider to `openai`; deterministic fixtures remain an explicit `EMS_PROVIDER_MODE=deterministic-fixtures` opt-in.
- Runtime defaults are fail-closed toward OpenAI, database MCP, and PostgreSQL persistence rather than silently selecting fixtures or memory.
- `/healthz` exposes the configured provider mode and model name without exposing credentials.
- Added runtime configuration regression coverage for production defaults and explicit fixture opt-in.

## Verification

- Frontend AgentCrew/API focused suite: 23 passed.
- Frontend production build: passed.
- Backend test execution was attempted but the checked-in `.venv` has a stale interpreter path and the system Python has no pytest; no backend pass is claimed from this environment.

## Files

- `apps/site-integration-app/docker-compose.yml`
- `apps/site-integration-app/services/ems-api/src/agentcrew/config.py`
- `apps/site-integration-app/services/ems-api/src/agentcrew/app.py`
- `apps/site-integration-app/services/ems-api/tests/test_runtime_configuration.py`
