⚠️ DEGRADED: single-context (spawn_agent and browser automation unavailable in this session)

# Critic Report

## Target

- Target: `apps/internal-operations-app`
- Primary route reviewed: `/overview`
- Related routes reviewed from source: `/documents/new`, generator routes, `/documents`, `/runs`, `/context`
- Review date: 2026-07-11
- Product context: [PRODUCT.md](./PRODUCT.md), [UX-EXPERIENCE.md](./UX-EXPERIENCE.md), [DESIGN-DIRECTION.md](./DESIGN-DIRECTION.md), [GATE-REPORT.md](./GATE-REPORT.md)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Generator states are clear, but example activity can resemble live history. |
| 2 | Match System / Real World | 3/4 | The document-desk metaphor fits; `Runs / activity` overpromises until its examples are unmistakably labeled. |
| 3 | User Control and Freedom | 2/4 | Draft state is lost on route changes and locale changes with no recovery or leave warning. |
| 4 | Consistency and Standards | 3/4 | Shared shell, tokens, labels, and icon family are consistent; library table semantics are incomplete. |
| 5 | Error Prevention | 3/4 | Required-field validation and first-error focus work; there is no dirty-state protection or generation cancellation. |
| 6 | Recognition Rather Than Recall | 3/4 | Task names and source register help recognition; placeholders disappear and no reusable source context exists. |
| 7 | Flexibility and Efficiency | 2/4 | No saved drafts, recent inputs, keyboard path, or repeat-generation shortcut. |
| 8 | Aesthetic and Minimalist Design | 3/4 | The restrained register is coherent, but repeated eyebrows, numbering, and legacy CSS add visual and maintenance noise. |
| 9 | Error Recovery | 2/4 | Clipboard fallback exists; generation failure, stale context, and unsaved-draft recovery are absent. |
| 10 | Help and Documentation | 2/4 | The Context page explains boundaries, but generator-specific guidance is limited to placeholders. |
| **Total** |  | **26/40** | **Solid prototype; trust and recovery need work before durable operations use.** |

## Cognitive Load

**Moderate: 3 checklist failures.**

- **Single focus:** Overview presents four status facts, three task rows, and four generator routes before the user reaches the primary job.
- **One thing at a time:** The overview mixes orientation, status, navigation, and generator indexing rather than giving one decisive start path.
- **Progressive disclosure:** Generator details are kept behind routes, but the page does not show enough input/output examples before the user commits to a generator.

The generator route itself is within a manageable choice set: four document types, one source form, and one output action. The main load problem is not the number of generators; it is the ambiguity around what is live, saved, or safe to leave.

## Emotional Journey

- **Entry:** Calm and credible. The ruled layout and document language establish an operational workspace instead of a generic AI chat.
- **Decision:** Slightly flat. The overview treats `New document`, `Document library`, and `Runs` as similar task rows even though only the first currently performs work.
- **Generation:** Reassuring when validation fires and when the preview exposes status labels.
- **High-stakes moment:** The user can invest in a draft and lose it by changing language or navigating away, without a warning or recovery path.
- **End state:** Export is explicit, but the activity feed can create false confidence that the result has entered a durable workflow.

## Anti-Patterns Verdict

### LLM assessment

This does **not** look immediately AI-generated. The document-desk register, ruled rows, restrained green, and lack of glass, gradients, oversized hero metrics, and repeated card grids give it a specific operational character.

It still has a recognizable generated-design cadence in places: every page uses a small uppercase eyebrow, several surfaces use default `01 / 02 / 03` or `01 / 02 / 03 / 04` numbering, and the overview repeats three navigation rows plus a generator index. Those patterns are not fatal, but they make the interface feel systematized by convention rather than shaped by the actual document workflow.

### Deterministic scan

- Detector command: `node /Users/chuang/.codex/skills/impeccable/scripts/detect.mjs --json apps/internal-operations-app/src`
- Result: clean, `0` findings.
- No detector findings for gradients, glassmorphism, gradient text, over-rounded surfaces, decorative grid backgrounds, or oversized shadow-card combinations.
- False positives: none.

The deterministic result supports the manual conclusion that the main anti-AI opportunity is cadence and content truth, not a palette or CSS anti-pattern.

## What's Working

1. **Task-first information architecture.** The overview routes users through document jobs rather than asking them to understand models, prompts, or system configuration.
2. **Trust-oriented draft status.** `Generated in browser`, `Manual review required`, and `Not stored or sent` are unusually honest and appropriately visible in the workbench.
3. **Coherent visual language.** The dark-ink, paper, rule, serif-document, and single-green-accent system is consistent across the shell, catalog, form, and preview without relying on decorative effects.

## Priority Issues

### [P1] Example activity reads too much like real history

**Evidence:** `RunsPage.jsx` renders three activity rows from `activityFeed`; the page also says no persisted runs exist. The content itself uses completed-action language such as “draft refreshed” and “exported.”

**Why it matters:** Operations users may treat the feed as an audit trail and infer that documents were sent, queued, or retained when nothing was persisted.

**Fix:** Either remove the feed until real run records exist, or label the whole section `Example activity shape` and prefix each row with a non-live treatment. Keep live history and fixture examples in different components and data types.

**Suggested command:** `$product-design-plus clarify apps/internal-operations-app`

### [P1] Draft loss is a trust failure, not just a missing feature

**Evidence:** `useDocumentGenerator` keeps form values and draft output in component state; a locale change clears the draft, and route changes unmount the generator. There is no unsaved-state warning or recovery mechanism.

**Why it matters:** A user can complete a document and lose work while switching language, checking Context, or returning to the catalog. That is especially risky for tender and financial-report work.

**Fix:** Preserve raw inputs and the last generated revision in a scoped session store, regenerate localized presentation from the same source values, and add a clear “discard local draft” action. If persistence is intentionally deferred, add a leave warning and a visible “local draft will be lost” message before navigation.

**Suggested command:** `$product-design-plus harden apps/internal-operations-app`

### [P2] Editorial markers are becoming a template instead of carrying meaning

**Evidence:** Page eyebrows appear on every route, generator indexes use `01` through `04`, the Context architecture uses `01` through `03`, and Runs begins with a `01` marker. The same device appears in both navigation and actual ordered content.

**Why it matters:** Repetition weakens hierarchy and matches the “AI-looking” numbered-eyebrow cadence the design direction is explicitly trying to avoid.

**Fix:** Reserve numbering for true ordered flows and use plain labels or icons for catalogs and navigation. Keep one intentional sequence on the Context page if it explains an actual three-stage architecture; remove numbering from overview indexes and the Runs boundary note.

**Suggested command:** `$product-design-plus quieter apps/internal-operations-app`

### [P2] Generator choice lacks enough preview before commitment

**Evidence:** `/documents/new` shows name, category, and only the first two outputs. Input contracts and review risks are hidden until the generator route is opened; placeholders are the only field guidance.

**Why it matters:** First-time users must open a route, scan the form, and potentially return to choose another generator. That increases decision cost and makes the four generators feel more alike than they are.

**Fix:** Add a compact “Best for / You provide / You get” line to each catalog row or a lightweight details disclosure. Use real, localized examples for the highest-risk fields without turning the catalog into a card grid.

**Suggested command:** `$product-design-plus clarify apps/internal-operations-app`

### [P2] The Library surface uses table language without complete table semantics

**Evidence:** `DocumentLibraryPage.jsx` uses `role="table"` and `role="row"`, but its child spans do not expose `role="cell"` or `role="columnheader"`; rows are also links with mixed cell content.

**Why it matters:** Assistive technology may not announce the record, output, and route relationships as a table, and users cannot rely on the page as a real record surface while persistence is absent.

**Fix:** Use a native table when this becomes a real library, or remove table roles and present a semantic list while it is only a route index. Do not imply sortable or durable records until the data contract exists.

**Suggested command:** `$product-design-plus audit apps/internal-operations-app`

## Persona Red Flags

### Alex, Power User

- Must re-enter the same four fields for recurring documents; there is no saved source context, recent input, or repeat-generation action.
- No keyboard shortcut moves focus to the first source field or submits a valid form.
- Opening Context or the catalog can destroy the current local draft.

### Jordan, First-Timer

- `Source context`, `record facts`, and `manual review` are understandable only after reading the supporting copy; there is no inline explanation of what qualifies as a verified fact.
- Generator rows expose output names but not the minimum evidence or intended audience, so the first choice is partly guesswork.
- Placeholder examples disappear when typing and are not available as a reusable example state.

### Priya, Compliance Reviewer

- The status line is honest, but the Runs page does not provide a real actor, revision, source reference, or approval trail.
- The example activity feed can look like a completed audit record even though the Context page says nothing is retained.
- `.txt` export has no visible version id, source checksum, or approval state beyond draft labels.

## Minor Observations

- The app stylesheet contains an older, unused `.desk-*` visual system before the routed app shell. Removing or isolating it would reduce token drift and make future critique more reliable.
- The form attaches both `onChange` and `onInput` to each field; this is redundant for React-controlled inputs and adds noise to the interaction contract.
- The `aria-live` region wraps the full output paper. Once outputs become larger or streamed, announce status in a small dedicated region instead of re-announcing the entire document.
- Focus visibility is defined globally, but the active mobile navigation uses a bottom border while the desktop navigation uses a left border; verify both against the dark theme.
- The fixed notification is a good pattern, but it should not be the only place users learn that a copied or exported draft is not persisted.

## Questions to Consider

1. Should the overview optimize for one confident action, `New document`, or intentionally remain a document-desk index?
2. Is preserving a draft across locale changes a requirement, or is language switching expected only before work begins?
3. Should the Runs page remain in the first release if it cannot show real traceability, or should it move into a planned system-context area?

## Run Notes

- Target slug: `apps-internal-operations-app`
- Ignore list: none found at `.impeccable/critique/ignore.md`.
- Assessment independence: degraded; no `spawn_agent` tool was exposed, so no isolated A/B agents were possible.
- Assessment A: completed as a single-context source/design review.
- Assessment B CLI detector: completed; `0` findings.
- Browser visibility: unavailable; no browser automation tool was exposed in this session.
- Overlay injection: skipped because browser automation was unavailable.
- Live server: attempted on ports `4174`, `4175`, and `4176`; the command reported Vite ready, but cross-command HTTP probes could not connect in this sandbox. No reliable browser rendering evidence is claimed.
- Temp-file cleanup: completed after snapshot persistence.
- Snapshot write: completed under `.impeccable/critique/`.
- Trend read: completed; first run for this target.
