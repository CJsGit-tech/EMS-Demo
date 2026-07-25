### Task 4: Runtime configuration and integration verification

Own only `apps/site-integration-app/docker-compose.yml`, the app/API runtime configuration needed to expose provider status safely, and integration test/docs additions directly related to the GPT-5-mini copilot. Do not edit frontend AgentCrew components or unrelated V2G files.

Ensure Compose injects `OPENAI_API_KEY` and `OPENAI_MODEL` from the host environment without baking or printing secrets, sets `EMS_PROVIDER_MODE=openai`, and keeps fixtures available only through explicit opt-in. Verify health/provider status behavior, persistence wiring, API/frontend build, and regression tests. If the live key is unavailable, report that without exposing it. Write `.superpowers/sdd/task-4-copilot-report.md` with exact files, tests, and assumptions. Commit only owned changes.
