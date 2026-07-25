# Task 1 Report: GPT-5-mini AgentCrew Copilot backend supervisor and SSE contract

## Status

DONE_WITH_CONCERNS

## Implementation

- Added `agentcrew.supervisor.GPTSupervisor` with a typed, ordered public SSE envelope. Event types cover run start/completion/failure, specialist delegation, assistant deltas, tool calls, and OpenAI web-search start/completion.
- Added `POST /api/v1/agentcrew/runs/stream` as `text/event-stream`; the existing synchronous run endpoint remains unchanged as the compatibility path.
- Added `GET /api/v1/agentcrew/provider` with a safe provider mode/model/readiness status.
- Extended `OpenAIProvider` with a Responses API streaming method that uses the configured `gpt-5-mini` model, `store=False`, hashed safety identifier, hosted `web_search`, and source inclusion.
- Reused the established specialist roles, site-context validation, preference-policy compiler, and redaction boundary. Recalled preferences are injected only as bounded presentation policy.
- Preserved deterministic fixtures as an explicit stream mode, labelled in both start and terminal events.
- Added focused tests for ordered deltas/tool/web-search events, provider terminal errors, deterministic mode, SSE serialization, selected model and web-search request configuration, provider status, and the FastAPI stream response.

## TDD evidence

1. Added `tests/test_gpt_supervisor.py` before implementing `agentcrew.supervisor`.
2. Ran `.venv/bin/python -m pytest -q tests/test_gpt_supervisor.py`; it failed during collection with the expected `ModuleNotFoundError: No module named 'agentcrew.supervisor'`.
3. Implemented the typed supervisor and reran the focused supervisor suite: `4 passed in 0.01s`.
4. Added provider and FastAPI stream tests before adding `OpenAIProvider.stream`, the provider-status route, and the SSE route.
5. Ran `.venv/bin/python -m pytest -q tests/test_openai_provider.py tests/test_fastapi_app.py`; it failed as expected because `OpenAIProvider` had no `stream` method and `agentcrew.app` had no `supervisor`.
6. Implemented the minimal provider and endpoint integration. The first green run exposed one overly-specific terminal JSON assertion in the new test; corrected that assertion to validate the envelope type rather than its JSON field order.

## Exact verification

Commands were run from `apps/site-integration-app/services/ems-api`.

```text
.venv/bin/python -m pytest -q tests/test_gpt_supervisor.py tests/test_openai_provider.py tests/test_fastapi_app.py
................                                                         [100%]
16 passed, 1 warning in 0.15s
```

```text
.venv/bin/python -m pytest -q
.ss..............s.sss...............................................    [100%]
63 passed, 6 skipped, 1 warning in 0.44s
```

```text
.venv/bin/python -m compileall -q src tests
exit 0
```

The only test warning is a pre-existing FastAPI/Starlette `TestClient` deprecation warning concerning its `httpx` dependency.

## Commits

- Implementation commit: `79baa7b` (`feat(agentcrew): add GPT streaming supervisor`).
- Initial report commit: `d50d2cb` (`docs(agentcrew): record GPT supervisor task report`).

## Concerns

- The designated backend directory was already entirely untracked in the shared worktree. To avoid claiming or staging unrelated backend work, the implementation commit stages only the six Task 1 source/test paths. It therefore relies on the existing untracked AgentCrew foundation remaining present until the owning integration changes are committed.
- Task 2 remains responsible for replacing the fixture-backed stream tool indication with the authoritative database-backed EMS MCP execution and durable persistence of streamed artifacts.
