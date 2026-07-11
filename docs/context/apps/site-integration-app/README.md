# Site Integration App Context

Path: `apps/site-integration-app`

## Purpose

The Site Integration App is the working frontend demo for EMS-Demo. It provides the map-first entry into site monitoring, then narrows into a site-specific workspace for operations managers.

## Current Surface

- Portfolio map with country-level drill-in and site markers
- Site detail workspace with tabs for overview, devices, EMS, reports, alerts, and site information
- Bilingual UI through `src/i18nConfig.js`
- Light/dark theme support
- Mock EMS, device, report, alert, and site data under `src/mock-data/ems/`

## Current Implementation

- Vite + React
- Main app shell: `apps/site-integration-app/src/App.jsx`
- Site workspace data builder: `apps/site-integration-app/src/siteWorkspaceContent.js`
- Styles: `apps/site-integration-app/src/styles.css`

## Design Direction

Use the platform product and design context:

- `docs/context/platform/PRODUCT.md`
- `docs/context/platform/DESIGN.md`
- `docs/context/platform/REQUEST.md`

The app should stay calm, operational, and site-first. Avoid SCADA-style density, generic SaaS decoration, and duplicate portfolio-level information inside site detail tabs.
