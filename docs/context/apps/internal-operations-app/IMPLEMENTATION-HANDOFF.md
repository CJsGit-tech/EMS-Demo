# Implementation Handoff

## Current implementation contract

The current app is a frontend-only prototype. The implementation must preserve these truths:

- Generation is simulated in the browser with local React state.
- No prompt, input, or output is sent to a model or server.
- No durable document or run is persisted. Temporary per-generator recovery uses browser session storage when available.
- Drafts require manual review.
- Copy and `.txt` export are local draft actions.
- English and Traditional Chinese are supported.
- Light and dark theme preference is locally persisted.

## Recommended implementation sequence

### Phase 1: stabilize the document desk

1. Keep the current route map and feature catalog.
2. Extract the draft status, review status, and storage status into a shared status contract.
3. Add explicit tests for required-field validation, unknown routes, locale changes, theme persistence, copy fallback, and export naming.
4. Replace hard-coded activity examples with a clearly named `plannedActivity` fixture or remove them until run data exists.

### Phase 2: add source context

1. Define `SourceContext` and `SourceContextRef` types.
2. Add a source-context review step before generation.
3. Display owner, verification state, freshness, and source references.
4. Keep manual input as a supported source type for prototype and fallback use.

### Phase 3: add generation runs

1. Define `GenerationRun` and output revision records.
2. Add request status, retry, cancellation, and failure states.
3. Record actor, template/prompt version, model metadata, timestamps, and source ids.
4. Make `/runs` show persisted run data only; do not mix fixtures with live history.

### Phase 4: add review and delivery

1. Add reviewer assignment and explicit review states.
2. Add revision comparison and source-reference checks.
3. Add safe export adapters for the required formats.
4. Gate downstream delivery on approval policy.

### Phase 5: add server/data optimization

1. Start with a read-only system and data register.
2. Add quality exceptions and access-review queues.
3. Add proposed cleanup plans with preview, rollback, and approval.
4. Feed verified findings into document generators as source context.

## API boundary proposal

```text
GET  /api/source-contexts
GET  /api/source-contexts/:id
POST /api/generation-runs
GET  /api/generation-runs/:id
POST /api/generation-runs/:id/retry
POST /api/document-revisions/:id/review
POST /api/document-revisions/:id/export
GET  /api/system-register
GET  /api/data-quality/issues
POST /api/cleanup-plans
```

These are boundary proposals, not a commitment to a specific backend framework.

## Frontend integration rules

- Keep route components thin; put feature schema in models and async behavior in controllers/services.
- Keep translation keys next to content contracts; do not concatenate locale-dependent copy in JSX.
- Preserve `aria-live` for generation and action status.
- Keep a visible distinction between local draft, server-saved record, approved output, and delivered artifact.
- Never infer approval from a successful API response or a downloaded file.

## Verification checklist

- `npm run build` passes.
- Every current route renders without console errors.
- English and Traditional Chinese have equivalent structure.
- Light and dark themes preserve contrast and focus visibility.
- Browser verification covers empty, invalid, generating, ready, copy, export, and unknown-route states.
- Hardening verification covers reload recovery, locale-change recovery, source-change invalidation, explicit discard, blocked storage, and page-exit saves.
- No source data is sent to an integration before the user sees the source and permission boundary.
