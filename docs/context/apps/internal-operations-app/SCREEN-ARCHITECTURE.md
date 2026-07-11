# Screen Architecture

## Current route map

| Route | Screen | Role | Status |
| --- | --- | --- | --- |
| `/` | Overview | Orient the user and expose the main document tasks. | Implemented |
| `/overview` | Overview | Same canonical overview surface. | Implemented |
| `/documents/new` | Generator catalog | Search and choose one of the configured document jobs. | Implemented |
| `/documents/tender` | Tender generator | Capture tender facts and preview a structured draft. | Implemented |
| `/documents/financial-report` | Financial report generator | Capture reporting facts and preview a structured draft. | Implemented |
| `/documents/pptx` | PPTX content generator | Capture deck facts and preview slide-ready content. | Implemented |
| `/documents/ops-memo` | Operations memo generator | Capture change facts and preview a handoff memo. | Implemented |
| `/documents` | Document library | Explain that saved records are not yet available and list configured routes. | Boundary / implemented |
| `/runs` | Runs and activity | Explain that generation is simulated and show the intended activity shape. | Boundary / implemented |
| `/context` | Application context | State execution, model, persistence, and review boundaries. | Implemented |
| `*` | Not found | Return users to the known document desk. | Implemented |

## Current navigation model

```text
Workspace
  Overview
  New document
Records
  Document library
  Runs / activity
System
  Context
```

This grouping is intentionally small. The app does not yet expose server administration or internal-data operations as routes because those capabilities are not implemented.

## Generator screen anatomy

```text
Page header
  eyebrow, document name, summary, browser-draft/manual-review boundary

Workbench
  left: Source context form
    required fields
    field-level validation
  right: Output document
    empty / generating / ready state
    status line
    structured sections
    source register
    copy and .txt export
```

## Planned information architecture

The next application layer should extend the shell without hiding the current document desk:

```text
Workspace
  Overview
  New document
Operations
  Server health
  Internal data quality
  Access and retention review
Records
  Document library
  Runs / activity
  Source context
System
  Context
  Templates and policies
```

Planned screens should only be added when the underlying source, permission, and persistence contracts are available.

## Screen contracts to preserve

- Overview remains the orientation surface, not a metrics wall.
- New document remains the task chooser and should not become a generic prompt playground.
- Generator pages keep source input and output review visible together on desktop.
- Library becomes the durable record surface only after save and retrieval semantics exist.
- Runs becomes a real trace surface only after run events are persisted.
- Context remains the boundary and policy explanation surface.
