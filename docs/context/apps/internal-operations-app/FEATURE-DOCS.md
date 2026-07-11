# Feature Documents

## Feature inventory

| Feature | User outcome | Current status | Primary route |
| --- | --- | --- | --- |
| Tender Generation | Produce a structured tender draft from project, client, deadline, and scope facts. | Browser-local draft | `/documents/tender` |
| Financial Report Generation | Produce a management-report narrative from period, unit, variance, and supporting notes. | Browser-local draft | `/documents/financial-report` |
| PPTX Content Generation | Produce a slide storyline, headlines, notes, and closing ask. | Browser-local draft | `/documents/pptx` |
| Ops Memo Generation | Produce an internal change memo with context, impact, action, and owner handoff. | Browser-local draft | `/documents/ops-memo` |
| Generator catalog search | Find a generator by localized name, category, or summary. | Implemented | `/documents/new` |
| Draft review and export | Review structured output, copy the complete record, or export `.txt`. | Implemented | Generator routes |
| Language and theme preferences | Switch between English and Traditional Chinese and light/dark mode. | Implemented, locally persisted | App shell |
| Document persistence | Save and retrieve generated documents. | Not implemented | `/documents` boundary |
| Run traceability | Persist generation, review, and handoff events. | Not implemented | `/runs` boundary |
| Server/data optimization | Inspect and improve internal records, access, capacity, sync, and backup hygiene. | Planned next lane | Future operations routes |

## Generator contract

Each generator must provide:

- a stable feature id
- a localized name, category, and summary
- an icon from the existing Lucide family
- an ordered list of output sections
- a field schema with required input ids and types
- a deterministic draft builder for prototype mode
- a route key

The current catalog is defined in `src/mockData.js` and normalized by `src/models/documentModels.js`.

## Per-feature specifications

### Tender Generation

- Inputs: project name, client, submission deadline, scope notes.
- Outputs: cover letter, scope summary, commercial exclusions, submission checklist.
- Review risk: scope omissions, commercial assumptions, deadline accuracy.
- Future source adapters: project record, client master, tender attachment set.

### Financial Report Generation

- Inputs: reporting period, business unit, primary variance, supporting notes.
- Outputs: executive summary, variance notes, cash posture, follow-up actions.
- Review risk: numerical accuracy, period alignment, unsupported explanations.
- Future source adapters: ERP ledger snapshot, budget baseline, approved commentary.

### PPTX Content Generation

- Inputs: deck topic, audience, target slide count, required takeaway.
- Outputs: storyline, slide headlines, speaker notes, closing ask.
- Review risk: unsupported claims, audience mismatch, missing decision ask.
- Future source adapters: approved report, KPI snapshot, presentation template.

### Ops Memo Generation

- Inputs: memo topic, owner, effective date, change summary.
- Outputs: context, impact, required action, owner handoff.
- Review risk: unclear accountability, incomplete dependency list, unsafe effective date.
- Future source adapters: change ticket, asset/data inventory, approval policy.

## Shared acceptance criteria

1. Required inputs are defined and validated before generation.
2. Output sections are ordered and labeled.
3. Source inputs remain visible in the result.
4. Draft, review, and storage statuses are explicit.
5. Copy/export actions do not imply approval or persistence.
6. English and Traditional Chinese content stays structurally equivalent.
7. The feature remains usable in light and dark themes.

## Future server and data optimization feature family

This is the next feature family, not current functionality. The first slice should be narrow:

1. Server/data register: authoritative source, owner, last refresh, health, and sensitivity.
2. Quality queue: duplicate, stale, incomplete, naming, and sync exceptions.
3. Access review: privileged access, evidence, reviewer, due date, and decision.
4. Cleanup plan: proposed change, impact, rollback, owner, and approval state.
5. Document handoff: use verified data-quality or server-review findings as source context for the existing generators.

The document desk should consume verified context; it should not silently mutate server or internal records.
