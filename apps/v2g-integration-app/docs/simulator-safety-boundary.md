# Simulator safety boundary

This document defines the boundary for the V2G SCADA simulator in this
repository. It is a local prototype for exercising deterministic data,
contracts, and human-decision states. It is not safe or suitable for operating
an EVSE, vehicle, site, utility, or grid service.

## Explicit non-goals

The simulator does not:

- Open an OCPP, ISO 15118, OpenADR, IEEE 2030.5, MQTT, WebSocket, or other
  external protocol connection.
- Read from or write to a real EVSE, vehicle, utility, market, or grid system.
- Dispatch real power, alter charging schedules, or acknowledge a real alarm.
- Claim OCPP conformance or protocol certification.

`OCPP-shaped` means that local event names and payload fields resemble the
domain. `FleetSimulator.tick()` is a pure, deterministic event generator; it
has no transport or device state.

## Runtime boundary

The Compose stack contains PostgreSQL, a one-shot migrator, the API, and the
UI on local Docker networks. The `simulator` network is internal. The only
published ports are the UI at `127.0.0.1:5181` and API at `127.0.0.1:8005`;
the migrator and PostgreSQL have no published port. Nginx routes browser
`/api` requests to the internal `api:8000` Compose hostname.

These settings limit the stack to the local host, but they are not an
authorization system. The API has no authentication or role enforcement. A
non-empty `actor` in an approval or rejection is audit metadata, not verified
identity. Run this stack only in a trusted local development environment.

## Task 8 acceptance status

- [x] **No endpoint connects to an external OCPP, EVSE, vehicle, or utility
  host.** The Task 8 source scan returned no matches for
  `websocket|ocpp|socket.connect|requests.(post|put)` under
  `services/v2g-api/src`. A broader read-only scan found only the browser's
  same-origin `fetch`, local smoke-test `curl` commands, and OCPP-shaped
  simulator labels.
- [x] **The UI visibly labels controllable actions as simulated.** The header
  displays `SIMULATOR · NO EXTERNAL CONTROL`; Dispatch labels itself
  `Human-in-the-loop · simulator only`, calls its action `Approve simulated
  command`, and the dialog says it records a local simulator decision only.
- [ ] **A running operator can observe a complete approved-command sequence
  through simulated result and audit retrieval.** The in-memory command
  service and its tests cover `requested → validated → awaiting_approval →
  approved → simulated`, including immutable local audit events. The shipped
  HTTP API exposes request, approve, reject, and SSE state notifications, but
  it has no execute-simulated endpoint and no command-audit read endpoint. The
  PostgreSQL append-only audit repository is tested independently and is not
  wired into those HTTP command routes. Do not describe the running stack as
  providing durable or operator-retrievable command audit history.

## Command boundary

The command service is deliberately in-memory and process-local. A process
restart loses command state and its audit events. A request can move through
`requested`, `validated`, and `awaiting_approval`; an approved request may be
moved to `simulated` only by the service method used in tests. Rejection,
cancellation, expiry, and policy failures are terminal outcomes.

The deployed API can create a command and record `approved` or `rejected`.
It publishes one normalized SSE notification per observed command state in a
bounded, in-memory journal. It does not call a device after approval.

## Release gate for any real integration

Do not extend this prototype into a real controller by changing configuration
alone. A separate design and security review must first add, at minimum:

- authenticated and authorized operator identities;
- durable command and audit storage with an operator retrieval path;
- an explicit command executor, idempotency and recovery model, and end-to-end
  evidence for every state transition;
- protocol-specific trust, credential, certificate, and network controls; and
- site-owner approval, emergency stop behavior, monitoring, and incident
  procedures.

Until that work is complete and reviewed, the only permitted result of a
simulated command is a local simulator state transition.
