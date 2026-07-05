# EMS-Demo

EMS-Demo is a multi-app product workspace for an operational energy platform.

The repository is organized around three coordinated apps:

1. `site-integration-app`
2. `internal-operations-app`
3. `energy-operations-app`

Together, they cover site monitoring, internal operations, and EMS decision support.

## Repository Structure

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   └── context/
│       ├── platform/
│       │   ├── PRODUCT.md
│       │   ├── DESIGN.md
│       │   └── REQUEST.md
│       └── apps/
│           ├── site-integration-app/
│           ├── internal-operations-app/
│           └── energy-operations-app/
└── apps/
    ├── site-integration-app/
    ├── internal-operations-app/
    └── energy-operations-app/
```

## Platform Overview

The platform is intended to support:

- Map-first site monitoring for operations managers
- HVAC and site-readiness visibility without SCADA-style overload
- EMS workflows such as generation forecasting, consumption forecasting, sell-power management, bidirectional charging, and energy-resource inventory management
- Internal operations workflows such as work management, ERP-facing data preparation, and report or document generation

## Planned Apps

### 1. Site Integration App

Path: `apps/site-integration-app`

Purpose:
- Provide the map-first operational entry into the platform
- Let users move from portfolio context to site-specific status and action
- Surface HVAC readiness, EMS posture, and site reports in a calm SaaS interface

Current implementation:
- Vite + React app scaffold is in place
- Interactive world map and country drill-in views are implemented
- Site workspace is implemented with `Overview`, `EMS`, `Reports`, and `Dev` sections
- i18n and light/dark theme support are implemented

Planned next work:
- Deeper site detail refinement and UX hardening
- Stronger report detail and document workflows
- Better production chunking and code-splitting around map assets
- Additional screens and connected data behaviors beyond demo mode

### 2. Internal Operations App

Path: `apps/internal-operations-app`

Purpose:
- Support internal work management and task coordination
- Handle ERP-adjacent data preparation and exchange
- Support report, form, and document generation

Current implementation:
- Product scope is defined in `docs/context/apps/internal-operations-app/PRODUCT.md`
- No frontend application scaffold has been created yet

Planned next work:
- Define screen architecture
- Create the frontend app scaffold
- Build task intake, data preparation, and document automation flows

### 3. Energy Operations App

Path: `apps/energy-operations-app`

Purpose:
- Support EMS forecasting and operational decision workflows
- Help users manage generation, consumption, sell-power, and bidirectional charging logic
- Track energy-resource commercialization and inventory

Current implementation:
- Product scope is defined in `docs/context/apps/energy-operations-app/PRODUCT.md`
- No frontend application scaffold has been created yet

Planned next work:
- Define screen architecture
- Create the frontend app scaffold
- Build EMS-specific forecasting, dispatch, and inventory workflows

## Status

| App | Purpose | Current Status | Notes |
|---|---|---|---|
| `site-integration-app` | Site monitoring and site entry | In progress / demo implemented | The only app with a working frontend today |
| `internal-operations-app` | Internal ops and ERP-adjacent workflows | Planned | Scope documented, app not built yet |
| `energy-operations-app` | EMS forecasting and energy operations | Planned | Scope documented, app not built yet |

## Done vs Not Done

### Done

- Repo-level product and design direction are documented
- `site-integration-app` has a working Vite React implementation
- Site map interaction, country drill-down, site workspace, i18n, and theming are present
- Product definition docs exist for the internal operations and energy operations apps

### Not Done Yet

- `internal-operations-app` frontend implementation
- `energy-operations-app` frontend implementation
- Shared cross-app design system extraction
- Production backend/data connections
- Final documentation for setup, scripts, and local development workflow across all apps

## Source of Scope

Primary planning inputs live in:

- `docs/context/README.md`
- `docs/context/platform/PRODUCT.md`
- `docs/context/platform/DESIGN.md`
- `docs/context/platform/REQUEST.md`
- `docs/context/apps/site-integration-app/README.md`
- `docs/context/apps/internal-operations-app/PRODUCT.md`
- `docs/context/apps/energy-operations-app/PRODUCT.md`

Root-level `PRODUCT.md`, `DESIGN.md`, and `REQUEST.md` are compatibility pointers to the canonical files under `docs/context/`.

## Local Development

At the moment, only `site-integration-app` is runnable as a frontend app.

Typical workflow:

```bash
cd apps/site-integration-app
npm install
npm run dev
```
