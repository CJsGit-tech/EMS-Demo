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

---

## Reviewer fix follow-up

### Implementation

- Translated the Responses API's real `response.web_search_call.in_progress`, `.searching`, and `.completed` events, including object-shaped SDK events. Search start is emitted once per stable item id across in-progress/searching lifecycle transitions.
- Normalized completed web-search payloads to `queries`, preferring the current plural field and safely converting the legacy singular `query` to a one-element list. Sources remain allowlisted to URL/title fields.
- Added stable `callId` to public tool-call envelopes and deduplicated the paired function-arguments/output-item lifecycle events by their stable item/call id.
- Recognized nested `response.failed.response.error.message` payloads so they yield the safe terminal `run.failed` envelope rather than an accidental successful completion.
- Added regression coverage for real event names, plural and legacy query forms, SDK object events, function-call deduplication, stable call id, and nested failure payloads.

### TDD evidence

1. Added the supervisor regression tests before changing the event translator.
2. Ran the focused supervisor suite and observed the expected failures: real Responses web-search lifecycle events produced no public events, and the legacy query test exposed the old singular `query` payload.
3. Implemented the minimal event normalization and lifecycle state, then reran the covering supervisor/provider/FastAPI tests successfully.

### Exact verification

Commands were run from `apps/site-integration-app/services/ems-api`.

```text
.venv/bin/python -m pytest -q tests/test_gpt_supervisor.py
..FF...                                                                  [100%]
2 failed, 5 passed in 0.05s
```

```text
.venv/bin/python -m pytest -q tests/test_gpt_supervisor.py tests/test_openai_provider.py tests/test_fastapi_app.py
...................                                                      [100%]
=============================== warnings summary ===============================
.venv/lib/python3.12/site-packages/fastapi/testclient.py:1
  /Users/chuang/Desktop/projects/EMS/EMS-Demo/apps/site-integration-app/services/ems-api/.venv/lib/python3.12/site-packages/fastapi/testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
    from starlette.testclient import TestClient as TestClient  # noqa

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
19 passed, 1 warning in 0.16s
```

### Cross-task dependency

The pre-existing untracked AgentCrew foundation modules imported by the app remain a known cross-task dependency owned by Task 2 integration. They were not staged, rewritten, or otherwise changed by this follow-up commit.
