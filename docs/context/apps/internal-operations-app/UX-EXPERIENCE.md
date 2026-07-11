# UX Experience

## Experience statement

The Internal Operations App should feel like a controlled document desk: direct, quiet, and accountable. The user should always know what they are preparing, which source facts were used, whether the output is only a draft, and what action is safe next.

## Core user jobs

1. Find the right document job quickly.
2. Enter or verify the minimum source facts required for that job.
3. Generate a structured draft without losing the source context.
4. Review the output and its limitations before sharing it.
5. Copy or export the result without implying approval or persistence.
6. Later, retrieve saved documents and trace their generation and approval history.

## Current journey

```text
/overview
  -> /documents/new
  -> /documents/:documentType
  -> validate required inputs
  -> browser-local generation state
  -> structured draft preview
  -> copy or .txt export
```

## Experience principles

### 1. Task before technology

Use names such as Tender Generation or Financial Report Generation. Do not make the user choose a model, prompt, or system configuration to start a routine job.

### 2. Source facts before prose

The input panel must establish the source record before generation. Required-field validation is a trust feature, not a formality.

### 3. Draft status must stay visible

Every generated result must expose at least:

- execution status
- review status
- storage or delivery status
- created time
- source inputs

### 4. Review is a workflow state

Copy and export are available as draft actions. They are not approval actions. Future approval must be explicit and permission-aware.

### 5. Explain boundaries where the user needs them

The current Context, Library, and Runs pages are not filler. They explain what is and is not connected, stored, or traceable.

### 6. Keep the next action obvious

Each state should have one primary action: choose a generator, complete missing fields, review the draft, or return to the generator catalog.

## State model

| State | User sees | Allowed next action |
| --- | --- | --- |
| Empty | No draft assembled; source context is incomplete. | Complete required fields. |
| Invalid | Field-level errors and focused first missing field. | Correct inputs and retry. |
| Generating | Clear progress state and no duplicate submission. | Wait; do not submit again. |
| Ready | Draft sections, source register, status labels, timestamp. | Review, copy, export, or regenerate after edits. |
| Copied | Confirmation message. | Continue review or return to catalog. |
| Exported | Browser download action; no approval claim. | Continue review or start another document. |
| Planned persistence | Future only; record id and history will be visible. | Save, revise, approve, or hand off according to policy. |

## Failure and edge behavior

- Unknown generator route redirects to `/documents/new`.
- Empty search returns a plain-language empty state and clear-search action.
- Missing required input returns localized field errors and focuses the first missing field.
- Clipboard failure provides a manual-copy fallback message.
- Language changes clear the current draft so content is not shown under the wrong locale.
- Leaving the route can recover the current draft within the same browser session when storage is available; session end, blocked storage, or explicit discard still removes it.
- Model, server, persistence, or approval errors must be introduced as explicit states when those integrations exist.

## Accessibility and responsive expectations

- Every input has a visible label and an error relationship.
- Generation progress is announced through `aria-live` and `aria-busy`.
- Icon-only controls retain accessible labels.
- Keyboard focus remains visible in both themes.
- On narrow screens, source and preview panels stack in reading order.
- The document preview remains readable without horizontal scrolling.

## Success signals

For the prototype:

- A first-time user can find a generator without reading documentation.
- A user cannot generate with missing required facts.
- A reviewer can distinguish draft, review, and storage status in one glance.
- A user can recover from search, validation, clipboard, and unknown-route states.

For the next application layer:

- Every saved output can answer who generated it, from which sources, with which template/model version, and what approval state it has.
