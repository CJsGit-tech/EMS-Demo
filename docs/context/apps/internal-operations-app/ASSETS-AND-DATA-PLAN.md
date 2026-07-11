# Assets And Data Plan

## Purpose

Keep the prototype visually and structurally credible without inventing production data. Use realistic, bounded examples for interaction design and label all simulated records as examples or local drafts.

## Current asset inventory

| Asset | Current source | Decision |
| --- | --- | --- |
| Brand mark | Text `EMS` in the app shell | Keep as a typographic mark until an approved brand asset exists. |
| Icons | `lucide-react` | Keep one icon family; map icons to task meaning, not decoration. |
| Generator examples | `src/mockData.js` and `src/i18n.js` | Keep examples plausible but clearly synthetic. |
| Activity examples | `src/mockData.js` and localized translations | Keep them as planned activity examples; never present them as persisted history. |
| Background imagery | None | Do not add stock imagery to this operational tool. |
| Illustrations | None | Use empty states, rules, labels, and typography instead of generic AI illustrations. |

## Current data model

```text
Feature
  id, name, category, summary, turnaround, outputs[], fields[], previewTitle, previewTemplate

Form state
  feature id, field values, field errors

Draft state
  status: idle | generating | ready
  document: title, summary, sections[], sourceInputs[], createdAt, status labels
```

The current draft is held in React state and mirrored as a versioned, per-generator record in `sessionStorage` when available. This is recovery aid, not durable document storage: it ends with the browser session, can be unavailable due to storage policy, and is removed by explicit discard.

## Source context model for the next layer

```text
SourceContext
  id
  title
  sourceType: manual | erp | server-register | attachment | imported-record
  sourceRef
  owner
  sensitivity
  verifiedAt
  freshnessExpiresAt
  fields[]
  attachments[]
  verificationStatus
```

## Generation record model for the next layer

```text
GenerationRun
  id
  documentType
  sourceContextIds[]
  actorId
  templateVersion
  modelProvider
  modelName
  promptVersion
  startedAt
  completedAt
  status: queued | running | ready | failed | cancelled
  outputRevisionId
  reviewState: draft | in-review | approved | rejected
  deliveryState: not-delivered | exported | handed-off
  errorCode
```

Sensitive source data, prompts, and outputs must not be logged by default. Audit records should point to controlled references rather than duplicate raw content.

## Server/data optimization records

The future operational lane needs explicit records for:

- `SystemRegister`: system, owner, environment, criticality, source of truth, health, last check.
- `DataQualityIssue`: dataset, issue type, sample evidence, severity, owner, due date, status.
- `AccessReview`: subject, role, system, reviewer, evidence, decision, expiry.
- `CleanupPlan`: proposed mutation, affected records, rollback plan, approval, execution result.
- `SyncEvent`: source, destination, started, completed, counts, rejects, retry state.

## Data quality rules

- Show freshness and verification time beside operational data.
- Never allow a generated document to appear source-backed when its context is stale or unverified.
- Preserve raw source values alongside normalized display values when normalization is applied.
- Record exceptions rather than silently dropping malformed records.
- Require preview and approval before destructive cleanup or access changes.
- Use stable ids, not display names, for cross-system joins.

## Asset and content acceptance

- No generated image is required for the current app.
- Every icon has an accessible label or is marked decorative.
- Mock values use the same shape and length as expected production values.
- Empty, loading, stale, permission-denied, and failure states have content before backend wiring.
