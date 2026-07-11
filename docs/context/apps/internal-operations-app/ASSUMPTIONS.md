# Assumptions

## Status

- Product: `product-internal-operations`
- Evidence baseline: current React + Vite implementation in `apps/internal-operations-app/`.
- Current release shape: browser-only document drafting prototype.
- Current primary lane: `報表、單據、文件產生自動化`.
- Next product lane: `Server 管理及內部資料優化`.

## Confirmed assumptions

| Area | Assumption | Evidence or constraint |
| --- | --- | --- |
| User | Primary users are internal operations managers, office administrators, ERP coordinators, and support staff. | `PRODUCT.md` |
| Entry point | Users should choose a document job by task, not by technical model or department. | `/documents/new`, generator catalog |
| Interaction | A user supplies verified source facts, creates a structured draft, reviews it, then copies or exports it. | `DocumentWorkbench`, generator controller |
| Trust | Generated content is a draft, not an approved record. Human review is mandatory. | UI status labels and context page |
| Privacy | The current prototype must not send input or output to a model or server. | Browser-only context contract |
| Localization | English and Traditional Chinese are first-class languages. | `i18n.js`, `i18nConfig.js` |
| Theme | Light and dark themes are supported and persisted locally. | `ThemeContext`, `themeConfig.js` |
| Persistence | No durable document, run, or activity record is persisted. Generator inputs and completed drafts have best-effort browser-session recovery only. | Generator controller, session storage boundary, Library and Runs pages |
| Layout | Desktop is the primary work environment; narrow screens must remain usable rather than expose every desktop column. | Product user profile and responsive CSS |

## Working assumptions for the next application layer

These are design assumptions, not implemented capabilities:

1. Source context will become a first-class record before it is sent to a model.
2. Each generation will have a traceable run id, prompt/template version, actor, timestamp, and status.
3. Outputs will retain source references and revision history.
4. Approval and handoff will be explicit states, not implied by export.
5. Server and internal-data records will be read through controlled adapters with permissions and freshness indicators.
6. A generated document may be exported to a supported downstream destination only after the required review state is satisfied.

## Open questions

- Which identity provider and roles govern source-record access?
- Which server/data sources are authoritative, and what is the freshness SLA for each?
- Which document formats are required after the text prototype: DOCX, PDF, XLSX, PPTX, or all four?
- Which approval roles and delegation rules apply to tenders, financial reports, and operational memos?
- Should generated content be retained by default, or only after an explicit save action?
- Which LLM provider, model policy, prompt versioning policy, and redaction rules will be used?

## Decision rule

Do not present an unimplemented backend capability as live UI. When a future workflow is described, label it `planned`, define its ownership boundary, and name the evidence needed before implementation.
