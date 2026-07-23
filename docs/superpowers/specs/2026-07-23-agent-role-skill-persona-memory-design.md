# EMS Agent Role, Skill, Persona, and Memory Reconstruction

**Status:** Design approved in conversation; implementation not started  
**Date:** 2026-07-23  
**Scope:** Reconstruct the LLM behavior for construction-site energy and operations management around the existing FastAPI, FastMCP, OpenAI provider, and four runtime specialist packages.

## 1. Problem and goals

The construction-site EMS AgentCrew needs to behave like an intelligent assistant while preserving explicit operational boundaries. It must:

- use stable specialist roles as system-prompt hats;
- use skills as optional workflows that guide MCP/tool usage;
- answer general questions without requiring a matching skill;
- remember site-specific chat history, memories, and user expectations;
- evolve a site-specific user persona from explicit and model-suggested preferences;
- require confirmation before inferred memories or preferences affect future behavior;
- invoke read-only tools autonomously after policy checks;
- require approval for state-changing tools;
- keep FastAPI as the authoritative owner of state and FastMCP as a typed tool gateway.

The design is construction-site-specific for the first version. A site represents a construction project or jobsite, including temporary power, generators, site trailers, HVAC, equipment, access control, and safety-related operational signals. Every conversation, message, memory, preference, run, and tool call is bound to `user_id` and `site_id`.

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
| Site Security Manager | Jobsite access posture, worker/subcontractor access signals, security findings, authorization interpretation, and safe next checks |
| Device Monitoring Expert | Generator, temporary-power, trailer-HVAC, equipment, sensor, and alarm health; operational checks |
| Data Analysis Specialist | Construction-site energy trends, generator/facility comparisons, anomalies, data quality, and evidence-backed conclusions |
| Report Generation Specialist | Construction operations reports, audience-specific summaries, recommendations, sources, and sanitized output |

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

### 3.1.1 Agency-agent assignments

The initial runtime role prompts are based on the most suitable agency-agent instructions already copied under `AppDeploy/agent-team/skills/`. The agency-agent is the prompt-design owner and competency source; the runtime role remains an EMS-specific application role with its own schema, validator, site-scope rules, and tool policy.

| Runtime role | Primary agency-agent source | Supporting agency-agent sources | Adaptation boundary |
|---|---|---|---|
| Site Security Manager | `Security Engineer` — `AppDeploy/agent-team/skills/security/engineering-security-engineer.md` | `Backend Architect` for authorization and service boundaries; `MCP Builder` for tool exposure controls | Adapt security analysis to construction-site access, worker/subcontractor records, temporary facilities, audit events, and safe checks. Never grant permissions or approve its own tools. |
| Device Monitoring Expert | `Data Engineer` — `AppDeploy/agent-team/skills/engineering/engineering-data-engineer.md` | `MCP Builder` for device/alert tool contracts; `AI Engineer` for uncertainty and structured output | Adapt data-quality, freshness, anomaly, and lineage discipline to generators, temporary power, trailers, HVAC, equipment, alarms, and jobsite sensors. |
| Data Analysis Specialist | `Data Engineer` — `AppDeploy/agent-team/skills/engineering/engineering-data-engineer.md` | `AI Engineer` for model/provider integration; `Backend Architect` for query and aggregation boundaries | Apply trusted-data, aggregation, quality-rule, and evidence practices to construction energy consumption, generator runtime, temporary loads, and phase/period comparisons. |
| Report Generation Specialist | `Technical Writer` — `AppDeploy/agent-team/skills/documentation/engineering-technical-writer.md` | `AI Engineer` for typed generation; `UX Architect` for information hierarchy and accessible presentation | Adapt reader-focused structure and source attribution to superintendent, project-manager, facilities, safety, and subcontractor audiences while producing sanitized construction-site report drafts. |

The following agency-agents support the role/skill system without becoming runtime specialist hats:

- `AI Engineer` owns provider integration, prompt assembly, structured output, repair limits, and persona/memory extraction behavior.
- `MCP Builder` owns typed FastMCP tools, tool descriptions, workflow hints, and protocol tests.
- `Backend Architect` owns PostgreSQL persistence, API boundaries, transactions, and authorization enforcement.
- `Software Architect` owns the Role–Skill–Persona–Memory boundaries and evolution decisions.
- `UX Architect` owns chat history, memory review, persona confirmation, and tool approval interaction design.
- `Product Manager` owns preference categories, user expectations, and confirmation semantics.
- `API Tester`, `Evidence Collector`, and `Reality Checker` own contract, visual, and integration verification.

Agency-agent rules are never copied into a runtime prompt without domain adaptation. In particular, general agency memory, broad project permissions, implementation instructions, and unrelated examples must be excluded from the runtime specialist prompt.

### 3.2 Skills: optional workflows

Skills are workflow playbooks that give a role hints about what to inspect, which typed MCP tools may be useful, what evidence is required, and how to complete or degrade safely.

Initial construction-site skill examples:

- `inspect-jobsite-access`
- `diagnose-generator-or-hvac-alert`
- `analyze-temporary-power-trend`
- `generate-construction-site-report`
- `compare-construction-phases`
- `verify-jobsite-data-quality`

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

## 4.1 User-facing information architecture

The existing site workspace remains the primary frame. AgentCrew is available only inside an authorized construction-site route.

```text
Construction site workspace
└── AgentCrew drawer
    ├── Conversation                primary task surface
    ├── Run Inspector                current execution and evidence
    ├── Role + Skill                 selected hat, matched workflow, tool hints
    └── Persona & Memory             current site preferences, memories, candidates
        └── Site-scoped settings view
            ├── Confirm/reject proposals
            ├── Correct or revoke active preferences
            ├── Review memory sources
            └── Restore versions or reset persona to base
```

The drawer keeps the operator’s active task in view:

1. **Conversation** is the default panel and contains the site-scoped transcript, composer, suggested construction-site prompts, safe assistant answer, and pending approval cards.
2. **Run Inspector** is a read-only panel for route, role, skill, handoff, MCP, validation, and report events.
3. **Role + Skill** explains the active role, the selected skill when one matches, and why a role-only answer was used when no skill applies. It never exposes hidden reasoning.
4. **Persona & Memory** shows the active site persona, confirmed memories, and candidate proposals. Candidates are visibly separate from active records.

The dedicated site-scoped settings view is for reviewing and changing durable personalization. It is not a second chat and does not change the active site or approval state. Every preference change shows its source, before/after value, affected role or skill, version, and rollback action.

The first three visible priorities in the drawer are:

```text
1. What the agent is answering now
2. What site data or approval it needs
3. What role/skill/memory context shaped the answer
```

Chat history, memories, and persona values must never be presented as one undifferentiated transcript. The UI labels them as conversation, active memory, active preference, or candidate proposal.

### 4.1.3 Visual direction

The AgentCrew surface follows the existing `Operational Cartography` design system. It is a calm construction-operations utility, not a personality-forward chatbot.

- Use the existing Inter / SF Pro Text / Segoe UI typography hierarchy and the existing green operational palette.
- Use the existing 8px control/panel radius, 1px structural lines, restrained panel/overlay shadows, and 36px minimum button controls.
- Keep Operational Green rare: primary actions, active panel state, current-site selection, and healthy status only.
- Pair every status color with a text label such as `Normal`, `Warning`, `Critical`, or `Offline`.
- Prefer evidence rows, timeline sections, compact status strips, and clear panel boundaries over nested card stacks.
- Do not use purple gradients, neon effects, glassmorphism, decorative assistant artwork, ornamental AI icons, or “thinking” animations that imply work without evidence.
- Keep the drawer’s first visual anchor on the active site context and current answer. Role, skill, memory, and persona details are secondary utility information.
- Use plain construction-operations language: `Generator alert`, `Temporary power trend`, `Approval needed`, `Candidate preference`, and `Draft report`.

The visual design should feel like the existing site workspace continues into a focused assistant tool. The agent’s personality comes from clear language, useful memory, and construction-site awareness rather than decoration.

### 4.1.4 Component and token mapping

| Agentic surface | Existing design-system mapping |
|---|---|
| AgentCrew drawer | `surface` background, `line-strong` border, `overlay shadow`, `md` radius, `headline` title |
| Site-scope header | `ink` for site identity, `muted` for metadata, `primary-soft` for scope strip, `label` typography |
| Conversation transcript | `surface` message rows, `primary-soft` for the user’s own message, `body` typography, `lg` spacing |
| Role + Skill panel | `surface-strong` selected state, `primary` active role/skill marker, `line` separators, `title` headings |
| Persona & Memory panel | `surface` active records, `watch` candidate status, `offline` unavailable status, explicit text labels |
| Approval card | `watch` foreground/background pair, `utility` and `primary` button treatments, visible scope and consequence copy |
| Error and scope warning | `critical` foreground/background pair with text label and recovery action; never color-only |
| Run timeline | `line` vertical/separator treatment, `healthy`/`watch`/`critical` status labels, `body` event copy |
| Report preview | `bg` document boundary, `line` frame, `sm` inner radius, sandboxed iframe, `muted` draft footer |
| Mobile drawer | Full-screen workspace treatment already used by `.agentcrew-drawer` at narrow widths; preserve 44px touch targets and visible close/back controls |

New components must reuse these tokens rather than introduce an agent-specific palette, radius system, font, or shadow vocabulary.

### 4.1.5 Responsive and accessibility contract

| Viewport | Layout behavior |
|---|---|
| Desktop, 1200px and above | Right-side drawer remains a focused overlay with a readable max width. Conversation stays primary; secondary panels open without hiding site identity or approval status. Run and evidence rows may show inline metadata. |
| Tablet, 768px–1199px | Drawer uses the available right-side workspace width. Role + Skill and Persona & Memory panels become full-width sections within the drawer. Approval actions remain visible without horizontal scrolling. |
| Mobile, below 768px | Drawer becomes a full-screen route-like surface. Header keeps site name, current-site scope, close/back, and approval state. Secondary panels use disclosure sections. Composer remains reachable after transcript scrolling. |
| Narrow mobile, below 390px | Stack approval buttons vertically, keep primary action first, collapse event metadata behind disclosure, and preserve readable 14px body text. No horizontal scrolling is permitted. |

Accessibility requirements:

- The drawer is a labeled dialog or route surface with a logical focus target on open and focus restoration on close.
- Keyboard order is header → panel navigation → conversation → approval actions → composer; no keyboard trap remains after closing a panel.
- Use visible text labels for every input and button. Placeholders are hints only, never the sole label.
- Use `aria-live="polite"` for new assistant messages, role/skill selection, loading progress, and non-destructive status changes. Use assertive announcements only for critical scope or approval failures.
- Candidate and active persona states must be announced with text, not color alone. `candidate`, `active`, `rejected`, `revoked`, and `unavailable` are visible labels.
- Approval controls state the site, action, consequence, and expiry in accessible text before the buttons.
- All interactive controls have at least a 44px touch target, including icon-only close, disclosure, and timeline controls.
- Text and controls meet at least 4.5:1 contrast for normal text and 3:1 for large text or essential graphical boundaries. Focus rings use the existing focus token and remain visible in both themes.
- Status icons are supplementary. Status meaning is always present as text.
- Sandboxed report previews have a meaningful accessible title and a text alternative describing draft status and source freshness outside the iframe.
- Reduced-motion preferences disable decorative transitions and any progress animation that is not required to communicate state.

### 4.1.2 Primary construction-site journey

The primary user is a superintendent or site operations lead who needs a fast, trustworthy answer while managing an active jobsite.

| Step | User does | User needs to feel | Design support |
|---|---|---|---|
| 1. Orient | Opens AgentCrew inside a construction-site workspace | “This is looking at the right jobsite.” | Header shows site name, site ID, `Current site only`, and session approval status before the user types. |
| 2. Ask | Asks what needs attention, checks a generator/HVAC alarm, or requests a report | “I can ask naturally and do not need to know the system vocabulary.” | Conversation accepts plain language; suggested prompts use construction-site terms; role-only answers work when no workflow matches. |
| 3. Understand | Sees the selected role, matched skill, data sources, freshness, and uncertainty | “I understand why this answer was produced.” | Role + Skill panel explains the hat and workflow in plain language without exposing hidden reasoning. |
| 4. Decide | Reviews an approval card or data-quality warning | “I am in control of anything consequential.” | Approval cards state purpose, data, site scope, consequence, and expiry; read-only checks can proceed after policy validation. |
| 5. Act | Uses the answer to inspect equipment, brief the crew, or review a draft report | “The result is useful for the next jobsite decision.” | Show concise next actions, sources, freshness, draft status, and preserved evidence for partial or failed runs. |
| 6. Teach | Confirms a preferred report format, writing style, units, or recurring workflow | “The agent is learning my expectations, not making assumptions about me.” | Persona & Memory separates active preferences from candidates, shows before/after changes, and requires confirmation before activation. |
| 7. Return | Comes back later to the same site conversation | “The assistant remembers the project context without mixing sites.” | Site-scoped chat history and confirmed persona values load first; stale, missing, or unavailable records are labeled rather than silently omitted. |

Time-horizon priorities:

- **First 5 seconds:** confirm site scope, show the primary ask path, and make current approval mode visible.
- **First 5 minutes:** help the superintendent answer one operational question, understand the evidence, and decide whether to approve a tool step.
- **Long-term relationship:** make confirmed site persona improvements visible, reversible, and useful in recurring reports and inspections.

### 4.1.1 Visible state matrix

| Feature | Loading | Empty | Error | Success | Partial |
|---|---|---|---|---|---|
| Conversation | Preserve the typed message; show `Preparing this site-scoped request…` and prevent duplicate sends | Explain that this is a new construction-site conversation; offer three relevant prompts | `This conversation could not be loaded.` Keep the composer available for retry; do not claim history was saved | Show user message, safe answer, active role, matched skill or `General answer`, sources, and next actions | Show saved messages and a banner that the latest response or history update is unavailable |
| Chat History | Show session list skeleton with current site label | `No conversations at this site yet.` Offer `Start a site conversation` | `Chat history is temporarily unavailable.` Offer retry without clearing the current session | Show site-scoped sessions sorted by recent activity with title, last message, and status | Show available sessions plus `Some older sessions could not be loaded.` |
| Role + Skill | Show `Choosing the best construction-site specialist…` | Show `No specialist details for this response.` for an unclassified clarification | `Role details are unavailable; the answer is still shown without internal diagnostics.` | Show role purpose, skill name/version if matched, or `No workflow skill was needed` | Show role but mark skill selection or tool explanation unavailable |
| Persona & Memory | Show separate loading sections for active preferences, confirmed memories, and candidates | Explain `Nothing is saved for this site yet.` with `Remember a preference` and `Add memory` actions | `Personalization could not be loaded.` Never silently apply stale values; offer retry | Separate active, confirmed, candidate, revoked, and expired records with source and timestamps | Show loaded records plus an explicit `Some records are unavailable; current answers use only what is visible.` banner |
| Candidate Proposal | Show proposal card skeleton with source and affected scope placeholders | No proposal region is rendered | `This suggestion could not be prepared.` No candidate is created | Show before/after value, source, site, affected role/skill, and `Approve` / `Reject` | Show the answer while clearly labeling the proposal as pending and inactive |
| Run Inspector | Show timeline skeleton with site and run identifiers | `No run activity yet.` Explain that role-only answers may not have tool events | `Run details are unavailable.` Return to conversation and preserve the run summary | Show route, role, skill, handoff, tool, approval, validation, and result events | Show completed events and a banner identifying the missing event range |
| Approval Queue | Show `Waiting for approval…` with the exact current-site scope | No approval card is rendered | `Approval status could not be refreshed.` Disable approval actions until refreshed | Show purpose, data type, site, consequence, expiry, and step/session actions | Preserve prior approvals and identify any unresolved step that still needs action |
| Audit | Show filters and round-list skeleton | `No AgentCrew rounds match these filters.` Offer `Clear filters` | `Audit is temporarily unavailable.` Keep the current-site filter visible and offer retry | Show view-only rounds, safe event summaries, redactions, and retention note | Show available rounds with a banner explaining omitted or expired records |

State copy must distinguish `candidate` from `active`, `unavailable` from `empty`, and `role-only` from `skill execution`. No state uses a blank panel as its explanation.

## 5. Routing and skill selection

The router has three valid outcomes:

1. `role_only`: select a role and provide a general answer without a workflow or MCP call.
2. `role_with_skill`: select a role and matching skill for an operational workflow.
3. `clarification_required`: request missing information before proceeding.

The agent must not invoke MCP merely because a role was selected. MCP use requires an operational need and a valid skill/tool policy.

### 5.1 Tool-selection execution contract

Use a hybrid control model:

1. The OpenAI model receives the active role, relevant skill catalog entries, site-scoped persona/memory context, and the current user request.
2. The model returns a typed routing decision: `role_only`, `role_with_skill`, or `clarification_required`.
3. For `role_with_skill`, the model may identify the next tool intent from the selected skill’s `tool_hints`.
4. FastAPI validates the role, skill, tool intent, arguments, site scope, and approval policy before any tool execution.
5. FastAPI invokes FastMCP through the typed gateway and returns only validated evidence to the role.
6. The model generates the user-visible response from the validated evidence and the active role/skill contract.

Skills may declare required ordered steps that the backend must run even when the model does not restate them. The model may not skip a required step, invent a new step, call a tool outside the selected skill, or call MCP directly. For `role_only`, no MCP request is made unless the user explicitly asks for live site evidence and the router upgrades the request to a matching skill workflow.

This is the authority order:

```text
site authorization and security policy
  > FastAPI Tool Policy Gateway
  > Skill required steps and allowlist
  > model tool intent
  > user-facing response
```

Examples:

| User request | Result |
|---|---|
| “What does peak demand mean?” | Data Analysis Specialist, role-only |
| “Analyze yesterday’s generator and temporary-power demand at this jobsite.” | Data Analysis Specialist + `analyze-temporary-power-trend` + energy tool |
| “Write a weekly superintendent energy report.” | Report Generation Specialist + `generate-construction-site-report` |
| “How should I interpret this trailer HVAC alarm?” | Device Monitoring Expert, role-only unless live data is needed |
| “Show me who accessed the equipment yard after hours.” | Site Security Manager + `inspect-jobsite-access` + approved access tool |

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

For the first implementation, all chat sessions, memories, and preferences are site-scoped. This supersedes the earlier design possibility of global preferences or cross-site conversations. A future global persona requires a new product and security decision; it is not inferred from the current schema.

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

- `RolePackage`: stable construction-site prompt, schema, validator, and handoff rules;
- `SkillPackage`: construction-site workflow, triggers, tool hints, steps, and failure rules;
- `MemoryManager`: retrieval, bounded context, candidate creation, and redaction;
- `PersonaManager`: candidate confirmation, versioning, precedence, correction, and revocation;
- `ChatSessionService`: conversations and append-only messages;
- `AgentRouter`: role-only, role-plus-skill, and clarification outcomes;
- `ToolPolicyGateway`: typed MCP allowlisting and approval decisions;
- `AgentCrewService`: run state and orchestration;
- PostgreSQL repositories: durable state and transaction boundaries;
- React adapter/UI: chat history, candidate confirmation, persona settings, and audit views.

No implementation should merge the role prompt, workflow skill, persona data, or memory text into an untyped unrestricted prompt blob. Each layer must remain independently testable and auditable.

## 12. NOT in scope for this design

- Global conversations or cross-site memory: deferred until site-scoped behavior is proven and a separate privacy decision is approved.
- Embedding/vector search: deferred; first retrieval uses indexed relational/full-text search.
- Autonomous state-changing MCP actions: excluded; approval remains mandatory.
- User-created roles or arbitrary user-created tools: excluded; users can tune bounded persona/preferences only.
- Exposing hidden reasoning or raw provider traces: excluded from prompts, persistence, audit, and UI.
- Replacing the existing FastAPI/FastMCP topology with an additional orchestration framework: excluded to preserve the current authority boundary.

## 13. What already exists

- `AppDeploy/agent-team/skills/` contains the agency-agent competency sources and role assignments documented above.
- `services/ems-api/skills/` contains four runtime role packages with prompts, schemas, and validators.
- `services/ems-api/src/agentcrew/openai_provider.py` provides the OpenAI Responses API boundary with `gpt-5-mini` defaulting.
- `services/ems-api/src/agentcrew/mcp_server.py` provides typed FastMCP tools that delegate to FastAPI.
- `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx` provides the current site-scoped conversation, approval, report preview, and audit entry point.
- `AppDeploy/agent-team/docs/07-agentcrew-ux-and-ui-spec.md` defines the drawer, run states, approvals, report preview, audit, and responsive foundations.
- `docs/context/platform/DESIGN.md` defines the Operational Cartography visual system reused by the agentic surfaces.

## 14. Implementation Tasks

Synthesized from the design review findings. Each task derives from a specific review gap.

- [ ] **T1 (P1, human: ~2 days / CC: ~30 min)** — Persistence — Implement site-scoped PostgreSQL repositories for chat sessions, messages, memories, preferences, runs, approvals, tool attempts, reports, and audit events.
  - Surfaced by: Pass 1 information architecture and the global/site scope contradiction.
  - Files: `services/ems-api/src/agentcrew/`, `services/ems-api/migrations/`, `AppDeploy/agent-team/docs/15-agent-memory-and-user-preferences-design.md`
  - Verify: repository integration tests prove same-user/same-site retrieval and cross-site rejection.
- [ ] **T2 (P1, human: ~2 days / CC: ~30 min)** — Agent orchestration — Implement hybrid role/skill/tool-intent routing with role-only, role-plus-skill, and clarification outcomes.
  - Surfaced by: Pass 7 tool-selection execution contract.
  - Files: `services/ems-api/src/agentcrew/router.py`, new role/skill runtime modules, `services/ems-api/src/agentcrew/service.py`
  - Verify: routing tests prove no-skill answers do not call MCP and skill workflows use only required allowlisted steps.
- [ ] **T3 (P1, human: ~2 days / CC: ~25 min)** — AgentCrew drawer — Add Conversation, Run Inspector, Role + Skill, and Persona & Memory panels without displacing the current-site header or approval status.
  - Surfaced by: Pass 1 information architecture.
  - Files: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`, `apps/site-integration-app/src/agentcrew/api.js`, `apps/site-integration-app/src/agentcrew/contracts.ts`
  - Verify: in-app browser shows the drawer-first IA and preserves site scope during panel navigation.
- [ ] **T4 (P1, human: ~2 days / CC: ~25 min)** — Persona and memory controls — Implement active/candidate/rejected/revoked states, before/after confirmation, correction, versioning, and site-scoped deletion.
  - Surfaced by: Pass 2 state coverage and Pass 3 long-term trust journey.
  - Files: `apps/site-integration-app/src/agentcrew/`, `services/ems-api/src/agentcrew/`
  - Verify: a confirmed construction-site report-format preference affects a later response; an unconfirmed candidate does not.
- [ ] **T5 (P1, human: ~1 day / CC: ~15 min)** — Visible state contract — Implement the loading, empty, error, success, and partial states in the state matrix for conversation, history, role/skill, persona/memory, proposals, inspector, approvals, and audit.
  - Surfaced by: Pass 2 interaction state coverage.
  - Files: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`, related styles and API adapters.
  - Verify: frontend tests and in-app browser evidence cover every matrix row’s user-visible copy and next action.
- [ ] **T6 (P2, human: ~1 day / CC: ~15 min)** — Operational visual system — Apply Operational Cartography tokens, evidence rows, status labels, restrained surfaces, and construction-site utility copy.
  - Surfaced by: Pass 4 AI slop risk and Pass 5 design-system alignment.
  - Files: `apps/site-integration-app/src/styles.css`, `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`
  - Verify: UI review finds no decorative AI gradients, color-only statuses, nested card mosaic, or unlabelled approval action.
- [ ] **T7 (P1, human: ~1 day / CC: ~15 min)** — Responsive and accessible interaction — Implement viewport rules, focus management, keyboard order, live announcements, 44px targets, contrast, reduced motion, and report iframe labels.
  - Surfaced by: Pass 6 responsive and accessibility review.
  - Files: `apps/site-integration-app/src/agentcrew/AgentCrewDrawer.jsx`, `apps/site-integration-app/src/styles.css`
  - Verify: keyboard-only walkthrough plus desktop/tablet/mobile in-app browser evidence.
- [ ] **T8 (P2, human: ~1 day / CC: ~15 min)** — Construction-site acceptance — Add end-to-end evidence for superintendent orientation, generator/HVAC question, role-only answer, approval, persona confirmation, recurring report, and cross-site rejection.
  - Surfaced by: Pass 3 primary construction-site journey.
  - Files: `services/ems-api/tests/`, `apps/site-integration-app/tests/`, `AppDeploy/agent-team/docs/11-visual-e2e-evidence-matrix.md`
  - Verify: backend suite, frontend build, and required in-app browser screenshots.

## GSTACK REVIEW REPORT

| Run | Status | Findings |
|---|---|---|
| Step 0 scope assessment | Complete | Initial design completeness 6/10; UI and backend scope confirmed. |
| Pass 1: Information Architecture | Complete | 7/10 → 10/10 after adding drawer-first IA and site-scoped Persona & Memory settings. |
| Pass 2: Interaction State Coverage | Complete | 6/10 → 10/10 after adding the cross-feature visible state matrix. |
| Pass 3: User Journey & Emotional Arc | Complete | 7/10 → 10/10 after naming the superintendent/site operations lead and adding the construction-site storyboard. |
| Pass 4: AI Slop Risk | Complete | 6/10 → 10/10 after choosing calm construction-operations utility direction. |
| Pass 5: Design System Alignment | Complete | 8/10 → 10/10 after mapping agentic surfaces to Operational Cartography tokens/components. |
| Pass 6: Responsive & Accessibility | Complete | 7/10 → 10/10 after adding viewport, keyboard, live-region, contrast, focus, touch, and reduced-motion requirements. |
| Pass 7: Unresolved Decisions | Complete | Hybrid model/tool authority selected; v1 site-only scope and deferred items documented. |
| Outside design voices | Unavailable | Visual designer unavailable; Codex critique blocked by local safety gate; primary review completed from repository evidence. |

**What already exists:** `DESIGN.md` compatibility pointer, Operational Cartography design system, site-scoped AgentCrew drawer, typed run states, approval UI, report preview, FastAPI/FastMCP boundary, four runtime role packages, and copied agency-agent competency sources.

**NOT in scope:** global/cross-site memory, embeddings/vector search, autonomous state-changing tools, user-created roles/tools, hidden reasoning exposure, and replacement of the FastAPI/FastMCP topology.

**VERDICT:** Design-complete for implementation planning at 9/10. The plan is ready for an implementation plan, with T1–T8 as the build contract.

NO UNRESOLVED DECISIONS
