# V2G SCADA Simulator — Design

## Decision

Build a local, full-stack V2G SCADA simulator as a modular monolith. It must
model real operational state transitions but must never send commands to real
chargers, vehicles, or grid equipment.

## Purpose and users

The prototype supports EMS operators, dispatch planners, analysts, and
commercial operators. It lets them observe simulated fleet and site state,
evaluate dispatch recommendations, approve or reject simulated commands, and
trace every decision through an audit history.

## Scope

Included:

- Simulated EVSE, EV, site meter, PV, and load telemetry.
- OCPP-shaped charger, transaction, availability, device, and smart-charging
  events.
- Site/fleet monitoring, alarm lifecycle, time-series historian, and operator
  command workflow.
- Dispatch recommendations constrained by site import/export limits, EV state
  of charge, connector availability, and configurable departure requirements.
- Approval-gated simulated charge/discharge commands with evented execution
  and audit records.

Excluded:

- Live OCPP, ISO 15118, OpenADR, IEEE 2030.5, EVSE, or utility integrations.
- Physical control, production market participation, and autonomous dispatch.
- Grid-code, tariff, or market-rule claims beyond explicitly configured demo
  rules.

## Architecture

```text
React operator UI
        | REST + server-sent events
Supervisor API
  |-- fleet/site simulator
  |-- telemetry & historian service
  |-- alarm service
  |-- dispatch recommendation engine
  |-- command/approval service
  `-- audit ledger
        |
PostgreSQL
```

The application runs locally through Docker Compose. The API is the only
writer to the database. The simulator produces events through the same
application contracts that later protocol adapters will use.

## Core model

- **Assets:** site, EVSE, connector, EV session, meter, PV, and simulated
  controllable resource.
- **Telemetry:** timestamped measurements with quality, source, and unit.
- **Events:** status changes, transaction lifecycle, device communication,
  alarms, and command transitions.
- **Recommendations:** proposed schedule, assumptions, constraints, expected
  energy/cost impact, confidence, and expiry.
- **Commands:** requested, validated, awaiting approval, approved/rejected,
  simulated, failed, expired, or cancelled.
- **Audit records:** actor, policy outcome, before/after state, correlation ID,
  timestamp, and reason.

## Operator surfaces

1. **Operations overview** — site power, import/export, active connectors,
   flexible capacity, data freshness, and unacknowledged alarms.
2. **Fleet control** — charger/connector status, EV SOC, availability,
   simulated capability, and communication health.
3. **Dispatch board** — recommendations, constraints, trade-offs, expiry,
   approver action, and simulated result.
4. **Alarm console** — severity, source, state, acknowledgement, notes, and
   recovery history.
5. **Historian and audit** — adjustable time-range telemetry, events,
   setpoints, operator decisions, and command outcomes.

## Safety and security contract

- All actuator paths terminate in the command simulator; no real network
  adapter is included in the prototype.
- Every command has scoped authorization, validation, expiry, a correlation
  ID, idempotency key, and immutable audit event.
- Dispatch is advisory until a named operator approves it. Low-confidence or
  constraint-violating recommendations cannot be approved.
- Data quality and simulator connectivity are visible to operators and can
  raise alarms.
- UI labels explicitly distinguish telemetry, recommendation, pending approval,
  and simulated execution.

## Standards alignment

The design intentionally models the OCPP 2.0.1 functional areas most relevant
to a supervisory system: device management, transactions, remote control,
smart charging, and security. It leaves protocol implementation for a later
adapter phase. ISO 15118, OpenADR, and IEEE 2030.5 are also future integration
boundaries, not prototype dependencies.

NIST OT guidance informs the safety-first posture: availability, reliability,
and physical consequences take precedence over convenience.

## Acceptance criteria

- A fresh local stack seeds at least one site, multiple EVSEs, active sessions,
  time-series telemetry, dispatch recommendations, and alarm scenarios.
- Operators can change the displayed time range and see coherent telemetry,
  events, and derived metrics.
- A simulated command cannot reach execution without a valid approval and all
  policy checks passing.
- Every command outcome is traceable from UI to audit record.
- Test coverage includes simulator state transitions, command idempotency,
  approval/expiry rules, alarm acknowledgement, and API/UI integration.

## Delivery roles

Existing roles lead product, workflow, UX/UI, frontend, backend, data,
database, fleet, AI, MCP, AppSec, SRE, QA, and documentation work. Add:

- Network Engineer — local OT/IT segmentation and future adapter topology.
- Security Architect — command trust zones, authorization, and audit design.
- Embedded Firmware Engineer — credible EVSE/EV simulator behavior.
- Model QA Specialist — dispatch/recommendation quality and guardrail tests.

## Sources

- [NIST SP 800-82 Rev. 3: Guide to Operational Technology Security](https://csrc.nist.gov/pubs/sp/800/82/r3/final)
- [Open Charge Alliance: OCPP protocol overview](https://openchargealliance.org/protocols/open-charge-point-protocol/)
- [U.S. DOE: Vehicle Grid Integration Assessment Report](https://www.energy.gov/sites/default/files/2025-01/Vehicle_Grid_Integration_Asseessment_Report_01162025.pdf)
