# EMS Agent Role, Skill, Persona, and Memory Reconstruction

**Status:** Design approved in conversation; implementation not started  
**Date:** 2026-07-23  
**Scope:** Reconstruct the LLM behavior around the existing FastAPI, FastMCP, OpenAI provider, and four runtime specialist packages.

## 1. Problem and goals

The EMS AgentCrew needs to behave like an intelligent assistant while preserving explicit operational boundaries. It must:

- use stable specialist roles as system-prompt hats;
- use skills as optional workflows that guide MCP/tool usage;
- answer general questions without requiring a matching skill;
- remember site-specific chat history, memories, and user expectations;
- evolve a site-specific user persona from explicit and model-suggested preferences;
- require confirmation before inferred memories or preferences affect future behavior;
- invoke read-only tools autonomously after policy checks;
- require approval for state-changing tools;
- keep FastAPI as the authoritative owner of state and FastMCP as a typed tool gateway.

The design is site-specific for the first version. Every conversation, message, memory, preference, run, and tool call is bound to `user_id` and `site_id`.

## 2. Existing system context and dependencies

The design extends the current system rather than creating a second runtime:

- FastAPI owns the REST API and authoritative AgentCrew state.
- FastMCP exposes typed MCP tools on its separate process and delegates to FastAPI.
- The OpenAI Responses API adapter uses `gpt-5-mini` by default.
- Four checked-in runtime role packages already exist:
  - Site Security Manager
  - Device Monitoring Expert
  - Data Analysis Specialist
  - Report Generation Specialist
- Existing role packages contain prompts, output schemas, and validators.
- Existing report handoff remains `Report Generation → Data Analysis → Report Generation`.
- Existing site-scope, approval, audit, validation, and report-sanitization policies remain authoritative.

Related documents:

- `AppDeploy/agent-team/docs/00-framework-decisions.md`
- `AppDeploy/agent-team/docs/02-system-architecture.md`
- `AppDeploy/agent-team/docs/04-agent-routing-and-output-contracts.md`
- `AppDeploy/agent-team/docs/05-mcp-tool-contracts-and-fixtures.md`
- `AppDeploy/agent-team/docs/09-security-threat-model-and-controls.md`
- `AppDeploy/agent-team/docs/14-current-architecture-and-db-schema.md`
- `AppDeploy/agent-team/docs/15-agent-memory-and-user-preferences-design.md`

## 3. Core conceptual model

The runtime must keep four concepts separate:

```text
Role    = who the agent is
Skill   = how the agent performs a workflow
Persona = how the agent adapts to this user at this site
Memory  = what the agent may recall from prior conversations at this site
```

### 3.1 Roles: system-prompt hats

Roles are stable behavioral identities placed on the agent before answer generation:

| Role | Responsibility |
|---|---|
| Site Security Manager | Access posture, security findings, authorization interpretation, and safe next checks |
| Device Monitoring Expert | Device health, alerts, HVAC behavior, sensor reliability, and operational checks |
| Data Analysis Specialist | Trends, comparisons, anomalies, data quality, and evidence-backed conclusions |
| Report Generation Specialist | Audience, report structure, summaries, recommendations, sources, and sanitized output |

Each role package owns:

```text
role_id
system_prompt
responsibility_boundary
tone_and_reasoning_guidance
allowed_skill_ids
output_schema
output_validator
handoff_rules
```

Role prompts guide behavior but do not grant permissions, change site scope, approve tools, or activate memories.

### 3.2 Skills: optional workflows

Skills are workflow playbooks that give a role hints about what to inspect, which typed MCP tools may be useful, what evidence is required, and how to complete or degrade safely.

Initial skill examples:

- `inspect-site-security`
- `diagnose-device-alert`
- `analyze-energy-trend`
- `generate-site-report`
- `compare-periods`
- `verify-data-quality`

Each skill package owns:

```text
skill_id
workflow_description
trigger_conditions
role_allowlist
ordered_steps
tool_hints
required_inputs
expected_evidence
output_requirements
failure_and_insufficiency_rules
```

A skill may recommend a tool sequence, but the Tool Policy Gateway remains authoritative. A skill cannot create tools, widen permissions, bypass approval, or hand off to an unlisted role.

### 3.3 User persona: evolving site-specific expectations

The user persona is the active, inspectable set of confirmed expectations for this user at this site. It may include:

- energy units;
- language;
- report format;
- response detail level;
- writing style;
- response structure;
- alert severity preference;
- notification style;
- recurring workflows;
- working hours or operating cadence.

Persona values are injected as a bounded preference overlay:

```text
base role prompt
  + active site persona
  + selected skill workflow, if any
  + relevant site conversation memory
  + current tool evidence
```

Persona values cannot change authorization, MCP permissions, role boundaries, approval requirements, site scope, audit rules, or evidence truthfulness.

### 3.4 Memory: site-scoped recall

Memory contains useful information from prior conversations at the same site. It includes:

- recent conversation context;
- confirmed episodic memories;
- confirmed semantic memories;
- active confirmed preferences;
- bounded summaries of older relevant messages.

Memory never contains hidden reasoning, credentials, raw authorization headers, unredacted tool payloads, or unrelated personal data.

## 4. Runtime architecture and data flow

```text
Chat Session API
  → persist user message
  → Memory Manager retrieves bounded site context
  → Agent Router selects a role
  → Router checks for a matching skill
  → Role-only answer OR Role + Skill workflow
  → Tool Policy Gateway evaluates MCP request
  → FastMCP delegates typed operation to FastAPI
  → specialist provider generates typed output
  → schema and security validation
  → persist assistant message and run result
  → Persona Manager creates candidate updates
  → user confirms or rejects candidate updates
```

FastAPI owns chat sessions, messages, memory, persona preferences, runs, approvals, reports, and audits. FastMCP is stateless with respect to those concerns and delegates state-changing operations to FastAPI.

## 5. Routing and skill selection

The router has three valid outcomes:

1. `role_only`: select a role and provide a general answer without a workflow or MCP call.
2. `role_with_skill`: select a role and matching skill for an operational workflow.
3. `clarification_required`: request missing information before proceeding.

The agent must not invoke MCP merely because a role was selected. MCP use requires an operational need and a valid skill/tool policy.

Examples:

| User request | Result |
|---|---|
| “What does peak demand mean?” | Data Analysis Specialist, role-only |
| “Analyze yesterday’s peak demand at this site.” | Data Analysis Specialist + `analyze-energy-trend` + energy tool |
| “Write a formal energy report.” | Report Generation Specialist + `generate-site-report` |
| “How should I interpret this alert?” | Device Monitoring Expert, role-only unless live data is needed |

The existing report chain remains allowlisted and bounded:

```text
Router → Report Generation Specialist
       → Data Analysis Specialist
       → Report Generation Specialist
```

## 6. MCP invocation and approval policy

Every tool request must pass:

1. role allowlist validation;
2. skill allowlist validation;
3. typed argument validation;
4. active `site_id` equality;
5. user/session ownership validation;
6. approval policy evaluation;
7. rate, retry, and payload-size limits;
8. audit recording.

Read-only tools may execute automatically after these checks. State-changing tools return `approval_required` and execute only after `approve_step` or `approve_all_session`.

The model cannot create tools, discover arbitrary tools, call FastMCP from the browser, change its permissions, widen site scope, approve its own call, hand off to an unlisted role, or persist a memory directly.

## 7. PostgreSQL persistence model

### 7.1 Chat

`chat_sessions`:

```text
id, user_id, site_id, title, status,
created_at, updated_at, last_run_id
```

`chat_messages`:

```text
id, session_id, user_id, site_id, role,
content_redacted, content_hash, run_id,
created_at, retention_expires_at
```

Messages are append-only and redacted before storage.

### 7.2 Memory and persona

`memory_items`:

```text
id, user_id, site_id, session_id,
memory_type, content, source_message_id, source_run_id,
status, confidence, created_at, confirmed_at, expires_at
```

`user_preferences`:

```text
id, user_id, site_id, preference_key, value_json,
source, status, version, confidence,
created_at, confirmed_at, updated_at
```

Active preference uniqueness:

```text
(user_id, site_id, preference_key)
```

Updates create versions and preserve prior audit history.

### 7.3 Agent execution and audit

Existing durable entities include:

```text
agent_runs
approvals
handoffs
mcp_attempts
report_drafts
```

`audit_events` includes safe metadata only:

```text
id, user_id, site_id, session_id, run_id,
event_type, safe_metadata_json, occurred_at
```

Memory events include retrieval, candidate creation, confirmation, rejection, revocation, update, export, and deletion.

Recommended indexes:

```text
chat_sessions(user_id, site_id, updated_at)
chat_messages(session_id, created_at)
memory_items(user_id, site_id, status, expires_at)
user_preferences(user_id, site_id, status, preference_key)
audit_events(user_id, site_id, occurred_at)
```

## 8. Persona evolution lifecycle

```text
explicit user statement or model observation
  → candidate preference or memory
  → user confirmation or settings update
  → active site persona/memory
  → future retrieval and prompt overlay
  → correction, versioning, or revocation
```

Explicit “remember this” requests and model-suggested stable preferences both create candidates. Neither affects future behavior until confirmed.

## 9. Failure handling and safety

- Invalid role or skill output: reject through schema validation.
- Missing, stale, or contradictory EMS data: return uncertainty or insufficiency rather than inventing values.
- MCP timeout: bounded retry, then typed failure.
- OpenAI failure: safe provider-unavailable result with no secret exposure.
- Memory retrieval failure: continue with current message and active run context.
- Persona persistence failure: finish the run without applying the unpersisted update.
- Unsafe report HTML: reject or sanitize before persistence and display.
- Cross-site request or retrieval: fail closed and audit the event.

## 10. Acceptance and verification

Backend tests must cover:

- site-specific chat creation, retrieval, and redaction;
- memory ranking and bounded context;
- candidate/confirmed/revoked lifecycle;
- persona precedence and versioning;
- role-only routing;
- role-plus-skill routing;
- clarification routing;
- required skill tool sequences;
- automatic read-only MCP invocation;
- approval-gated state changes;
- cross-site rejection;
- invalid output and provider degradation;
- audit completeness;
- deletion and revocation.

End-to-end evidence must prove:

1. site-specific chat starts;
2. a role is selected;
3. a matching skill is selected for an operational request;
4. a role-only answer works when no skill matches;
5. a read-only MCP tool runs after policy checks;
6. a typed specialist response is validated;
7. a persona preference candidate is proposed;
8. the user confirms it;
9. a later response uses the confirmed preference;
10. cross-site retrieval is rejected;
11. a state-changing tool pauses for approval.

## 11. Implementation boundaries

The implementation plan must map work to these boundaries:

- `RolePackage`: stable prompt, schema, validator, and handoff rules;
- `SkillPackage`: workflow, triggers, tool hints, steps, and failure rules;
- `MemoryManager`: retrieval, bounded context, candidate creation, and redaction;
- `PersonaManager`: candidate confirmation, versioning, precedence, correction, and revocation;
- `ChatSessionService`: conversations and append-only messages;
- `AgentRouter`: role-only, role-plus-skill, and clarification outcomes;
- `ToolPolicyGateway`: typed MCP allowlisting and approval decisions;
- `AgentCrewService`: run state and orchestration;
- PostgreSQL repositories: durable state and transaction boundaries;
- React adapter/UI: chat history, candidate confirmation, persona settings, and audit views.

No implementation should merge the role prompt, workflow skill, persona data, or memory text into an untyped unrestricted prompt blob. Each layer must remain independently testable and auditable.
