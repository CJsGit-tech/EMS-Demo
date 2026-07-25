# AGENTS.md

## Agency role routing

For every delegated task, first identify the best matching role installed in
`agency/agents/`, read that role's prompt, and delegate the work using its
guidance. If the task genuinely spans disciplines, select the smallest set of
roles needed and assign each a clear scoped responsibility. Do not delegate
under a generic role when a better specialist is installed, and do not invoke
unrelated roles merely because they are available. The managed roster below is
the source of truth for available project roles.

<!-- BUILD_AGENCY_AGENTS_START -->

## Managed agency roles

- **Ai Engineer** (`ai-engineer`): use for generation and consumption forecasting, anomaly detection, and optimization decision support.
- **Api Platform Engineer** (`api-platform-engineer`): use for charger, market, partner, and internal API contracts with versioning and policy.
- **Application Security Engineer** (`application-security-engineer`): use for control-command authorization, auditability, security design, and threat modelling.
- **Backend Architect** (`backend-architect`): use for V2G domain services, dispatch APIs, authorization, and integration architecture.
- **Data Engineer** (`data-engineer`): use for forecast inputs, telemetry quality, optimization data pipelines, and data lineage.
- **Database Optimizer** (`database-optimizer`): use for PostgreSQL time-series, forecast, dispatch, and commercialization query performance.
- **Embedded Firmware Engineer** (`embedded-firmware-engineer`): use for V2G SCADA simulator prototype.
- **Frontend Developer** (`frontend-developer`): use for React user interfaces, visualization interactions, accessibility, and frontend tests.
- **Iot Fleet Engineer** (`iot-fleet-engineer`): use for charger telemetry, availability, command state, and fleet connectivity.
- **Mcp Builder** (`mcp-builder`): use for V2G and energy-resource MCP tools, resources, and scoped AI retrieval contracts.
- **Model Qa Specialist** (`model-qa-specialist`): use for V2G SCADA simulator prototype.
- **Network Engineer** (`network-engineer`): use for V2G SCADA simulator prototype.
- **Product Manager** (`product-manager`): use for V2G product strategy, commercial outcomes, roadmap, and acceptance criteria.
- **Security Architect** (`security-architect`): use for V2G SCADA simulator prototype.
- **Sre Site Reliability Engineer** (`sre-site-reliability-engineer`): use for dispatch-service reliability, observability, SLOs, and incident readiness.
- **Technical Writer** (`technical-writer`): use for V2G API contracts, operating runbooks, decision-policy documentation, and integration guides.
- **Test Automation Engineer** (`test-automation-engineer`): use for forecast, dispatch, authorization, API, and end-to-end regression coverage.
- **Ui Designer** (`ui-designer`): use for forecasting, dispatch, inventory, and operational dashboard design.
- **Ux Architect** (`ux-architect`): use for energy-operations information architecture, decision flows, and responsive task guidance.
- **Workflow Architect** (`workflow-architect`): use for dispatch approvals, charging and discharging workflows, exception handling, and recovery paths.

<!-- BUILD_AGENCY_AGENTS_END -->
