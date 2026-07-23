# Construction-Site Agentic System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the construction-site AgentCrew loop where stable role prompts select optional workflow skills, retrieve site-scoped chat memory and persona preferences, use validated FastMCP tools, and present trustworthy results in the React drawer.

**Architecture:** FastAPI remains the sole authority for PostgreSQL-backed chat, memory, persona, runs, approvals, reports, and audit. OpenAI Responses returns typed routing and specialist output; FastAPI validates model tool intent and delegates typed operations to the separate FastMCP process. The browser remains REST-only.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, official MCP Python SDK/FastMCP, OpenAI Python SDK Responses API with `gpt-5-mini`, PostgreSQL 15+, SQLAlchemy 2 async, asyncpg, Alembic, pytest, React, Vite, TypeScript contracts, and Operational Cartography CSS tokens.

## Global Constraints

- All first-version conversations, messages, memories, preferences, runs, tool calls, and audit events require `user_id` and `site_id`.
- Roles are stable system-prompt hats; skills are optional workflows; persona is confirmed site-specific personalization; memory is bounded site-scoped recall.
- Routing outcomes are `role_only`, `role_with_skill`, or `clarification_required`.
- A role-only answer must not call MCP. A skill may call only its typed, allowlisted tools.
- Read-only tools may run automatically after policy checks; state-changing tools require `approve_step` or `approve_all_session`.
- FastAPI owns state. FastMCP is a stateless typed gateway and never owns memory, approvals, runs, or audit.
- `OPENAI_API_KEY` is server-side; `OPENAI_MODEL` defaults to `gpt-5-mini`; Responses requests use `store=False`.
- Inferred memories/preferences remain `candidate` until confirmation and never affect routing while pending.
- Do not persist hidden reasoning, credentials, raw provider traces, raw authorization headers, or unredacted MCP payloads.
- Reuse the existing Operational Cartography system: Inter/SF Pro Text/Segoe UI, operational green, 8px radius, 1px lines, restrained shadows, text-plus-color statuses.
- Frontend failures show retryable errors; they must not silently fabricate completed local runs.

---

## File and module map

| Unit | Responsibility | Files |
|---|---|---|
| Persistence | SQLAlchemy engine, models, migrations, repositories | `services/ems-api/src/agentcrew/db/`, `services/ems-api/migrations/` |
| Roles | Construction-site system prompts, schemas, validators | `services/ems-api/roles/` |
| Workflow skills | Optional workflows, required steps, tool hints, evidence rules | `services/ems-api/skills/workflows/` |
| Memory/persona | Retrieval, redaction, candidates, confirmation, versioning, deletion | `services/ems-api/src/agentcrew/memory/`, `persona.py` |
| Orchestration | Chat, routing, provider, tool policy, run integration | `services/ems-api/src/agentcrew/chat.py`, `router.py`, `provider.py`, `tool_policy.py`, `service.py` |
| REST contracts | Pydantic models and site/user authorization | `services/ems-api/src/agentcrew/api_models.py`, `app.py` |
| Browser | Adapter, drawer panels, state matrix, accessibility | `apps/site-integration-app/src/agentcrew/`, `styles.css` |
| Evidence | Tests, browser evidence, readiness/runbook docs | `services/ems-api/tests/`, `apps/site-integration-app/tests/`, `AppDeploy/agent-team/docs/` |

## Task 1: Lock persistence framework and create PostgreSQL foundation

**Files:**

- Modify: `services/ems-api/pyproject.toml`, `services/ems-api/uv.lock`, `services/ems-api/src/agentcrew/config.py`
- Create: `services/ems-api/src/agentcrew/db/__init__.py`, `engine.py`, `session.py`, `models.py`
- Create: `services/ems-api/alembic.ini`, `services/ems-api/migrations/env.py`, `services/ems-api/migrations/script.py.mako`
- Create: `services/ems-api/migrations/versions/0001_agentcrew_memory_foundation.py`
- Modify: `AppDeploy/agent-team/docs/00-framework-decisions.md`
- Test: `services/ems-api/tests/test_db_models.py`

**Interfaces:** `async_session_factory() -> async_sessionmaker[AsyncSession]`; `get_db_session() -> AsyncIterator[AsyncSession]`; SQLAlchemy tables for chat sessions/messages, memory items, preferences, runs, approvals, handoffs, MCP attempts, reports, and audit events.

- [ ] **Step 1: Write the failing model test.**

```python
def test_models_are_site_scoped_and_preferences_are_unique():
    assert "site_id" in ChatSession.__table__.c
    assert "site_id" in ChatMessage.__table__.c
    assert "site_id" in MemoryItem.__table__.c
    assert any(c.name == "uq_active_site_preference" for c in UserPreference.__table__.constraints)
```

- [ ] **Step 2: Run it and verify failure.** Run `cd services/ems-api && .venv/bin/pytest tests/test_db_models.py -q`. Expected: FAIL because the DB module does not exist.

- [ ] **Step 3: Record the framework decision.** Add SQLAlchemy 2 async ORM + asyncpg + Alembic as the accepted PostgreSQL stack in `00-framework-decisions.md`; record alternatives SQLModel, psycopg-only SQL, and Django ORM.

- [ ] **Step 4: Add dependencies and configuration.** Add `sqlalchemy>=2.0,<3.0`, `asyncpg>=0.29,<1.0`, and `alembic>=1.13,<2.0`; add `DATABASE_URL` and `EMS_DB_POOL_SIZE`; create `alembic.ini` and `migrations/env.py` wired to `Base.metadata` and `settings.database_url`; run `uv lock && uv sync`.

- [ ] **Step 5: Implement models and migration.** Add UTC timestamps, append-only messages, redacted content, JSON safe metadata, foreign keys, and indexes on `(user_id, site_id, updated_at)`, `(session_id, created_at)`, `(user_id, site_id, status, expires_at)`, and `(user_id, site_id, occurred_at)`. Add a partial unique index on active `(user_id, site_id, preference_key)`.

- [ ] **Step 6: Verify migration and tests.** Run `cd services/ems-api && .venv/bin/alembic upgrade head && .venv/bin/pytest tests/test_db_models.py -q`. Expected: migration succeeds and tests pass.

- [ ] **Step 7: Commit.** Run `git add services/ems-api/pyproject.toml services/ems-api/uv.lock services/ems-api/src/agentcrew/db services/ems-api/migrations services/ems-api/src/agentcrew/config.py AppDeploy/agent-team/docs/00-framework-decisions.md services/ems-api/tests/test_db_models.py && git commit -m "feat: add PostgreSQL persistence foundation"`.

## Task 2: Separate runtime Roles from workflow Skills

**Files:**

- Create: `services/ems-api/roles/site-security-manager/{manifest.json,prompt.md,output.schema.json,validation.py}`
- Create: `services/ems-api/roles/device-monitoring-expert/{manifest.json,prompt.md,output.schema.json,validation.py}`
- Create: `services/ems-api/roles/data-analysis-specialist/{manifest.json,prompt.md,output.schema.json,validation.py}`
- Create: `services/ems-api/roles/report-generation-specialist/{manifest.json,prompt.md,output.schema.json,validation.py}`
- Create: `services/ems-api/skills/workflows/{inspect-jobsite-access,diagnose-generator-or-hvac-alert,analyze-temporary-power-trend,generate-construction-site-report,compare-construction-phases,verify-jobsite-data-quality}/manifest.json` and `prompt.md`
- Create: `services/ems-api/src/agentcrew/role_runtime.py`, `workflow_runtime.py`
- Modify: `services/ems-api/src/agentcrew/skill_runtime.py`, `router.py`
- Test: `services/ems-api/tests/test_role_workflow_runtime.py`

**Interfaces:** `load_role(hat: AgentHat) -> RolePackage`; `list_matching_skills(hat: AgentHat, message: str) -> list[WorkflowSkill]`; `route(message: str) -> RoutingDecision`.

```python
@dataclass(frozen=True)
class RolePackage:
    role_id: AgentHat
    system_prompt: str
    allowed_skill_ids: tuple[str, ...]
    output_schema: dict[str, Any]
    validator: OutputValidator

@dataclass(frozen=True)
class WorkflowSkill:
    skill_id: str
    role_allowlist: tuple[AgentHat, ...]
    required_steps: tuple[str, ...]
    tool_hints: tuple[str, ...]
    trigger_terms: tuple[str, ...]
```

- [ ] **Step 1: Write failing tests.** Prove a role loads without a skill, “What does peak demand mean?” returns `role_only`, and “Analyze generator and temporary-power demand at this jobsite” returns `role_with_skill` with `analyze-temporary-power-trend`.

- [ ] **Step 2: Run `cd services/ems-api && .venv/bin/pytest tests/test_role_workflow_runtime.py -q` and verify failure.**

- [ ] **Step 3: Create four construction-site role prompts.** Adapt the assigned agency-agent sources; preserve schemas/validators; exclude general agency memory, project permissions, implementation instructions, and unrelated examples from runtime prompts.

- [ ] **Step 4: Create workflow manifests.** Declare `required_steps`, `tool_hints`, `required_inputs`, `expected_evidence`, `failure_and_insufficiency_rules`, role allowlist, and trigger terms for the six named construction workflows.

- [ ] **Step 5: Implement loaders and typed routing.** Deterministic matching is the offline fallback; the OpenAI provider may later return the same typed routing decision. No role selection alone can cause MCP use.

- [ ] **Step 6: Verify and commit.** Run `cd services/ems-api && .venv/bin/pytest tests/test_role_workflow_runtime.py tests/test_skill_packages.py -q`; then commit with `git commit -m "feat: separate agent roles from workflow skills"`.

## Task 3: Implement site-scoped Chat Sessions and Memory Manager

**Files:**

- Create: `services/ems-api/src/agentcrew/memory/{__init__.py,contracts.py,redaction.py,repository.py,manager.py}`
- Create: `services/ems-api/src/agentcrew/chat.py`, `services/ems-api/src/agentcrew/repositories/chat_repository.py`
- Modify: `services/ems-api/src/agentcrew/runtime.py`
- Test: `services/ems-api/tests/test_memory_manager.py`, `test_chat_sessions.py`

**Interfaces:** `ChatSessionService.create`, `.append_message`, `.list`, `.messages`; `MemoryManager.retrieve(context, session_id, request, budget=12) -> MemoryContext`; `MemoryManager.propose_from_turn(...) -> list[MemoryCandidate]`.

- [ ] **Step 1: Write tests for same-user/same-site retrieval, cross-site exclusion, secret redaction, bounded `omitted_count`, and candidate-not-active behavior.**

```python
async def test_candidate_does_not_enter_active_preferences(db):
    candidates = await manager.propose_from_turn(context, "session-1", "Use concise weekly reports", "summary", "run-1")
    assert candidates[0].status == "candidate"
    result = await manager.retrieve(context, "session-1", "report")
    assert result.active_preferences == ()
```

- [ ] **Step 2: Run `cd services/ems-api && .venv/bin/pytest tests/test_memory_manager.py tests/test_chat_sessions.py -q`; verify failure.**

- [ ] **Step 3: Implement redaction.** Remove API keys, bearer tokens, cookies, passwords, service tokens, authorization headers, and raw MCP payload fields before persistence; store only redacted content and a content hash.

- [ ] **Step 4: Implement deterministic retrieval.** Order current-session messages, same-site active preferences, same-site confirmed memories, lexical relevance, confidence, and recency. Retrieval failure returns empty bounded context plus an audit event and does not fail a safe run.

- [ ] **Step 5: Implement site-owned chat operations.** Require `ActiveSiteContext`; reject user/site mismatch; append messages without overwrite; preserve run links.

- [ ] **Step 6: Verify and commit.** Run `cd services/ems-api && .venv/bin/pytest tests/test_memory_manager.py tests/test_chat_sessions.py -q`; commit `feat: add site-scoped chat and memory manager`.

## Task 4: Implement Persona Manager and REST contracts

**Files:**

- Create: `services/ems-api/src/agentcrew/persona.py`, `services/ems-api/src/agentcrew/repositories/preference_repository.py`, `api_models.py`
- Modify: `services/ems-api/src/agentcrew/app.py`, `errors.py`
- Modify: `apps/site-integration-app/src/agentcrew/api.js`, `contracts.ts`
- Test: `services/ems-api/tests/test_persona_api.py`, `test_fastapi_app.py`

**Interfaces and routes:** `PersonaManager.list`, `.confirm`, `.reject`, `.update`, `.revoke`, `.delete_all`; `POST /sessions`, `GET /sessions`, `GET /sessions/{id}/messages`, `POST /sessions/{id}/messages`, `GET /persona`, `POST /persona/candidates/{id}/confirm`, `POST /persona/candidates/{id}/reject`, `PATCH /persona/preferences/{id}`, `DELETE /persona/preferences/{id}`, `DELETE /memory`.

- [ ] **Step 1: Write failing tests for wrong-site rejection, candidate confirmation, versioning, revocation, deletion, and allowed preference keys.**

- [ ] **Step 2: Run `cd services/ems-api && .venv/bin/pytest tests/test_persona_api.py -q`; verify failure.**

- [ ] **Step 3: Implement only these initial keys:** `energy_unit`, `language`, `report_format`, `detail_level`, `writing_style`, `response_structure`, `alert_severity`, `notification_style`, `recurring_workflow`, and `working_hours`. Reject permission, scope, approval, and tool-policy keys.

- [ ] **Step 4: Add typed FastAPI responses.** Every response includes `site_id`, status, source, version, timestamps, and safe audit metadata. Apply existing site validation before repository access.

- [ ] **Step 5: Add browser types and adapter methods.** Add `ChatSession`, `ChatMessage`, `PersonaSnapshot`, `MemoryRecord`, `PersonaCandidate`, and `ApiError`. Remove `localResult` success fallback; throw typed errors for non-2xx responses.

- [ ] **Step 6: Verify and commit.** Run `cd services/ems-api && .venv/bin/pytest tests/test_persona_api.py tests/test_fastapi_app.py -q`; commit `feat: expose site-scoped persona and chat APIs`.

## Task 5: Integrate memory/persona context with the hybrid AgentCrew loop

**Files:**

- Create: `services/ems-api/src/agentcrew/provider.py`, `tool_policy.py`
- Modify: `services/ems-api/src/agentcrew/openai_provider.py`, `service.py`, `router.py`, `contracts.py`, `app.py`
- Test: `services/ems-api/tests/test_hybrid_agent_loop.py`, `test_tool_policy.py`

**Interfaces:** `AgentProvider.route(...) -> RoutingDecision`; `AgentProvider.answer(...) -> dict[str, Any]`; `ToolPolicyGateway.validate_intent(...) -> PolicyDecision`; `ToolPolicyGateway.execute(...) -> ToolResult`.

```python
class RoutingDecision(TypedDict):
    mode: Literal["role_only", "role_with_skill", "clarification_required"]
    role_id: AgentHat
    skill_id: str | None
    tool_intent: str | None
    clarification: str | None
```

- [ ] **Step 1: Write tests.** Prove role-only calls no gateway, state-changing intent returns `approval_required`, read-only intent executes, and model cannot request a tool outside the selected skill.

- [ ] **Step 2: Run `cd services/ems-api && .venv/bin/pytest tests/test_hybrid_agent_loop.py tests/test_tool_policy.py -q`; verify failure.**

- [ ] **Step 3: Implement typed OpenAI routing.** Send active role, matching skill entries, site context, bounded memory, and request through strict JSON schema; use `store=False`; never send secrets or raw transcripts.

- [ ] **Step 4: Implement the policy gateway.** Validate role, skill, required step order, typed arguments, active site, session ownership, retries, payload size, and approval. Auto-execute read-only tools; return `approval_required` for state-changing tools.

- [ ] **Step 5: Integrate the service loop.** Persist user message, retrieve memory, route, run required skill steps, call specialist with validated evidence, persist safe assistant summary, create candidates, and audit. On provider failure, set run status to `failed` before returning the typed error.

- [ ] **Step 6: Prove all roles and report chain.** Test four role prompts, role-only answer, each workflow, `Report Generation → Data Analysis → Report Generation`, candidate creation, active persona injection, schema validation, sanitized HTML, and safe audit.

- [ ] **Step 7: Verify and commit.** Run `cd services/ems-api && EMS_PROVIDER_MODE=deterministic-fixtures .venv/bin/pytest tests/test_hybrid_agent_loop.py tests/test_tool_policy.py tests/test_openai_provider.py tests/test_runtime.py -q`; commit `feat: integrate memory persona and hybrid tool routing`.

## Task 6: Add session, persona, inspector, and audit adapter contracts

**Files:**

- Modify: `apps/site-integration-app/src/agentcrew/api.js`, `contracts.ts`
- Create: `apps/site-integration-app/src/agentcrew/state.js`
- Create: `apps/site-integration-app/vitest.config.ts`, `apps/site-integration-app/src/test/setup.ts`
- Modify: `apps/site-integration-app/package.json`, `apps/site-integration-app/package-lock.json`, `AppDeploy/agent-team/docs/00-framework-decisions.md`
- Test: `apps/site-integration-app/src/agentcrew/api.test.ts`, `state.test.ts`

**Interfaces:** `listAgentCrewSessions(siteContext)`, `getAgentCrewMessages(siteContext, sessionId)`, `createAgentCrewSession(siteContext, title?)`, `getAgentCrewPersona(siteContext)`, `confirmPersonaCandidate(siteContext, candidateId)`, `rejectPersonaCandidate(siteContext, candidateId)`, and `revokePersonaPreference(siteContext, preferenceId)`.

- [ ] **Step 1: Write the failing adapter test.**

```ts
it("throws ApiError instead of fabricating a completed local run", async () => {
  mockFetch({ status: 503, body: { code: "provider_unavailable", message: "Unavailable" } });
  await expect(createAgentCrewRun(siteContext, "Check the generator")).rejects.toMatchObject({ code: "provider_unavailable" });
});
```

- [ ] **Step 2: Add and document the frontend test runner.** Record Vitest + Testing Library + jsdom as the accepted frontend test stack in `00-framework-decisions.md`. Add `vitest`, `jsdom`, `@testing-library/react`, and `@testing-library/jest-dom` as dev dependencies; add the `test` script with value `vitest` to `package.json`; configure `vitest.config.ts` with `environment: "jsdom"` and `src/test/setup.ts` importing `@testing-library/jest-dom`. Run `cd apps/site-integration-app && npm test -- --run src/agentcrew/api.test.ts`; verify the current local fallback fails the test.

- [ ] **Step 3: Implement typed adapter methods.** Keep `VITE_AGENTCREW_API_URL` pointed at FastAPI; never add an MCP browser client; include site/user/session/route on every request.

- [ ] **Step 4: Implement state helpers.** Represent loading, empty, error, success, and partial for every panel; preserve typed input on submit failure; keep candidates inactive.

- [ ] **Step 5: Verify and commit.** Run `cd apps/site-integration-app && npm test -- --run src/agentcrew/api.test.ts src/agentcrew/state.test.ts`; commit `feat: add typed agentcrew session and persona adapter`.

## Task 7: Build the drawer-first UI and accessibility contract

**Files:**

- Modify: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`, `styles.css`
- Create: `apps/site-integration-app/src/agentcrew/AgentCrewPanel.jsx`, `RoleSkillPanel.jsx`, `PersonaMemoryPanel.jsx`, `RunInspectorPanel.jsx`, `StateNotice.jsx`
- Test: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.test.jsx`

**Interfaces:** `AgentCrewDrawer({ siteContext, onClose })`, `RoleSkillPanel({ run, role, skill, routingMode })`, `PersonaMemoryPanel({ snapshot, onConfirm, onReject, onRevoke })`, `RunInspectorPanel({ events, status })`, `StateNotice({ state, title, actionLabel, onAction })`.

- [ ] **Step 1: Write the drawer IA test.** Assert the site scope header appears before content and tabs for Conversation, Role + Skill, Persona & Memory, and Run Inspector exist.

- [ ] **Step 2: Run `cd apps/site-integration-app && npm test -- --run src/agentcrew/AgentCrewDrawer.test.jsx`; verify failure.**

- [ ] **Step 3: Implement Conversation as primary.** Keep site scope, approval strip, construction prompts, transcript, composer, approvals, safe answer, and draft preview. Show `General answer` for `role_only` and `Skill: <name>` for workflows.

- [ ] **Step 4: Implement secondary panels.** Role + Skill explains role/workflow without hidden reasoning. Persona & Memory separates active records/candidates and exposes source, site, version, confirm/reject/revoke. Run Inspector remains read-only.

- [ ] **Step 5: Implement state copy from the design matrix.** Distinguish `candidate` vs `active`, `unavailable` vs `empty`, `role-only` vs `skill execution`, and partial omissions. Never render a blank panel or fake success.

- [ ] **Step 6: Apply responsive and visual rules.** Desktop uses right drawer; tablet makes secondary panels full width; mobile becomes full screen with disclosures; narrow mobile stacks approval actions. Use existing tokens, 14px minimum body, 44px minimum targets.

- [ ] **Step 7: Implement accessibility.** Use labeled dialog, focus open/restore close, visible labels, polite live regions, assertive critical announcements, visible focus rings, text-plus-color statuses, and reduced-motion handling.

- [ ] **Step 8: Verify and commit.** Run `cd apps/site-integration-app && npm test -- --run src/agentcrew/AgentCrewDrawer.test.jsx && npm run build`; commit `feat: build drawer-first agentcrew panels`.

## Task 8: Integrate reports, audit, evidence, and readiness gates

**Files:**

- Modify: `AppDeploy/agent-team/docs/07-agentcrew-ux-and-ui-spec.md`, `08-frontend-implementation-handoff.md`, `10-api-test-plan-and-contract-matrix.md`, `11-visual-e2e-evidence-matrix.md`, `12-integration-readiness-checklist.md`, `13-local-development-and-operations-runbook.md`
- Test: `services/ems-api/tests/test_agentcrew_acceptance.py`, `apps/site-integration-app/tests/tests.txt`

**Acceptance journeys:**

```text
A. Open jobsite → ask generator question → role-only/device skill → validated answer.
B. Ask temporary-power analysis → Data Analysis Specialist → read-only MCP → evidence-backed output.
C. Request superintendent report → Report Generation → Data Analysis → Report Generation → sanitized draft.
D. Confirm report-format preference → repeat report → visible persona applied.
E. Attempt another site’s session/memory/tool → FastAPI rejects and audits.
F. Request state-changing tool → approval card → approve step/session → audited execution.
```

- [ ] **Step 1: Write the report-chain acceptance test.**

```python
def test_superintendent_report_chain_persists_sanitized_draft(client):
    run = start_run(client, "Write a weekly superintendent energy report")
    run = approve_all(client, run)
    assert run["result"]["handoffSequence"] == ["report_generation_specialist", "data_analysis_specialist", "report_generation_specialist"]
    assert "<script" not in run["result"]["draft"]["html"].lower()
```

- [ ] **Step 2: Run backend/frontend tests.** Run `cd services/ems-api && EMS_PROVIDER_MODE=deterministic-fixtures .venv/bin/pytest -q`; then `cd apps/site-integration-app && npm test -- --run && npm run build`. Expected: all tests/build pass.

- [ ] **Step 3: Update docs.** Add the six journeys, role-only behavior, candidates, site isolation, no-browser-MCP assertion, PostgreSQL/Alembic startup, and FastAPI/FastMCP/Vite commands to the linked team docs.

- [ ] **Step 4: Run services and capture evidence.** Run `cd services/ems-api && uv run --env-file ../../.env alembic upgrade head`; start FastAPI on `8002`, FastMCP on `8003`, and Vite on `5175`. Use the required in-app browser to capture desktop/tablet/mobile states for A–F.

- [ ] **Step 5: Run final gate and commit.** Run `git diff --check && cd services/ems-api && EMS_PROVIDER_MODE=deterministic-fixtures .venv/bin/pytest -q && cd ../../apps/site-integration-app && npm run build`; commit `test: certify construction-site agentcrew journeys`.

## Final verification checklist

- [ ] `alembic upgrade head` succeeds on a clean PostgreSQL database.
- [ ] Backend pytest suite passes in deterministic fixture mode.
- [ ] Frontend tests and build pass.
- [ ] Role-only answers produce no MCP attempt.
- [ ] Skill workflows use only typed, allowlisted MCP tools.
- [ ] State-changing tools pause for approval.
- [ ] Chat, memory, and preferences reject cross-site access.
- [ ] Candidates remain inactive until confirmation.
- [ ] Confirmed persona affects later role/skill output.
- [ ] Report chain and sanitized draft persistence pass.
- [ ] Browser evidence proves desktop/tablet/mobile states and no browser request targets port `8003`.
- [ ] Reality Checker certifies the six construction-site journeys.
