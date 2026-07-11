# Library Decisions

## Current dependencies

| Dependency | Use | Decision |
| --- | --- | --- |
| React 18 | UI composition and state | Keep. The current app is already structured around small route and view components. |
| React Router 7 | Route-level screen composition | Keep. Routes map directly to the screen architecture. |
| i18next + react-i18next | English and Traditional Chinese localization | Keep. Preserve translation keys as the content contract. |
| Lucide React | Icon family | Keep. Avoid adding a second icon system. |
| Vite | Local development and production build | Keep. `npm run build` is the current verification command. |

## Not yet selected

The following decisions must wait for backend requirements and security review:

- LLM provider and model SDK.
- Authentication and authorization client.
- Server/data API client and generated types.
- Server-state/cache library.
- Document rendering/export libraries for DOCX, PDF, XLSX, and PPTX.
- Persistence layer and audit-event transport.

## Selection criteria for the next layer

1. Must support explicit request and response schemas.
2. Must expose loading, stale, permission, retry, and failure states.
3. Must not hide audit-relevant events behind opaque client caching.
4. Must support English and Traditional Chinese error and status copy.
5. Must keep data source references and freshness visible.
6. Must be compatible with the repo's existing Vite build and browser verification process.

## Avoid

- Adding a UI component library only to produce generic cards or dashboards.
- Adding a chat abstraction before source context and generation records are defined.
- Adding client persistence that looks like durable storage without a retention contract.
- Adding icon packs, animation libraries, or visual dependencies without a concrete interaction need.

## Decision process

For each new dependency, record the problem, rejected simpler option, data/security implication, bundle impact, and validation command in the implementation handoff or an ADR before installation.
