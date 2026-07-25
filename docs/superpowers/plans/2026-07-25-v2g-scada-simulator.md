# V2G SCADA Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local full-stack, simulator-only V2G SCADA that provides live operations, fleet control, dispatch approvals, alarms, historian, and auditable simulated commands.

**Architecture:** A React/Vite frontend consumes a FastAPI supervisor service over REST and server-sent events. The supervisor persists a V2G-specific relational model in PostgreSQL, produces deterministic OCPP-shaped simulation events, evaluates dispatch constraints, and records every command state transition in the audit ledger. Docker Compose runs the frontend, API, and database locally.

**Tech Stack:** React 18, Vite, Vitest, FastAPI, SQLAlchemy async, Alembic, PostgreSQL 16, Docker Compose.

## Global Constraints

- Simulator-only: no real OCPP socket, charger, vehicle, utility, or grid command path.
- New application boundary: all runtime code, Docker services, database migrations,
  tests, and environment files live under `apps/v2g-integration-app/`; do not
  import or depend on `apps/site-integration-app/` at runtime.
- Every simulated command requires authorization, validation, expiry, idempotency, correlation ID, and an immutable audit event.
- Model OCPP-shaped device, transaction, availability, smart-charging, and security events without claiming protocol certification.
- API is the sole database writer; UI never computes safety or dispatch policy.
- Default demo data must contain one site, five EVSEs, active and disconnected sessions, telemetry history, recommendation scenarios, and alarm scenarios.
- Use UTC timestamps at rest; present localized time in the UI.

---

## File structure

```text
apps/v2g-integration-app/
  docker-compose.yml                 # local three-service stack
  Dockerfile                          # production frontend build
  package.json                        # Vite/React scripts
  src/
    main.jsx                          # React entry point
    App.jsx                           # route-free SCADA shell
    api/client.js                     # REST + SSE client
    features/operations/OperationsPage.jsx
    features/fleet/FleetPage.jsx
    features/dispatch/DispatchPage.jsx
    features/alarms/AlarmPage.jsx
    features/historian/HistorianPage.jsx
    components/MetricStrip.jsx
    components/TimeSeriesChart.jsx
    components/CommandApprovalDialog.jsx
    styles.css
  tests/                              # Vitest UI/API-client tests
  services/v2g-api/
    pyproject.toml
    Dockerfile
    alembic.ini
    migrations/versions/0001_v2g_scada_foundation.py
    src/v2g/
      app.py                          # FastAPI composition root
      contracts.py                    # Pydantic API contracts
      models.py                       # SQLAlchemy tables
      repository.py                   # persistence boundary
      simulator.py                    # deterministic simulated fleet
      dispatch.py                     # recommendation and constraint engine
      commands.py                     # validation/approval/execution state machine
      alarms.py                       # alarm lifecycle
      seed.py                         # demo data and history
      stream.py                        # SSE event fan-out
    tests/
```

## Task 1: Scaffold the isolated V2G application

**Owner:** Frontend Developer + Backend Architect  
**Files:**
- Create: `apps/v2g-integration-app/package.json`
- Create: `apps/v2g-integration-app/src/main.jsx`
- Create: `apps/v2g-integration-app/src/App.jsx`
- Create: `apps/v2g-integration-app/vite.config.js`
- Create: `apps/v2g-integration-app/services/v2g-api/pyproject.toml`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/__init__.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/app.py`
- Test: `apps/v2g-integration-app/tests/app.test.jsx`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_health.py`

**Interfaces:**
- Produces `GET /healthz -> {"status":"ok"}`.
- Produces `App` rendering `<main aria-label="V2G SCADA">`.

- [ ] **Step 1: Write the failing frontend and backend smoke tests.**

```jsx
// tests/app.test.jsx
import { render, screen } from '@testing-library/react';
import App from '../src/App.jsx';
test('renders the V2G SCADA shell', () => {
  render(<App />);
  expect(screen.getByRole('main', { name: 'V2G SCADA' })).toBeInTheDocument();
});
```

```python
# services/v2g-api/tests/test_health.py
from fastapi.testclient import TestClient
from v2g.app import app
def test_healthz():
    assert TestClient(app).get('/healthz').json() == {'status': 'ok'}
```

- [ ] **Step 2: Run the tests and verify failure.**

Run: `npm test -- --run tests/app.test.jsx` and `pytest services/v2g-api/tests/test_health.py -q`  
Expected: module/import failures because the application files do not exist.

- [ ] **Step 3: Implement the minimal runnable shells.**

```jsx
// src/App.jsx
export default function App() {
  return <main aria-label="V2G SCADA"><h1>V2G SCADA</h1></main>;
}
```

```python
# src/v2g/app.py
from fastapi import FastAPI
app = FastAPI(title='V2G SCADA Simulator')
@app.get('/healthz')
async def healthz() -> dict[str, str]:
    return {'status': 'ok'}
```

- [ ] **Step 4: Run both tests and build.**

Run: `npm test -- --run tests/app.test.jsx && npm run build && pytest services/v2g-api/tests/test_health.py -q`  
Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app
git commit -m "feat(v2g): scaffold local scada application"
```

## Task 2: Create the V2G historian and audit schema

**Owner:** Database Optimizer + Data Engineer  
**Files:**
- Create: `apps/v2g-integration-app/services/v2g-api/migrations/versions/0001_v2g_scada_foundation.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/models.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/repository.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_repository.py`

**Interfaces:**
- Produces `TelemetryPoint`, `Evse`, `ChargingSession`, `Alarm`, `DispatchRecommendation`, `SimulatedCommand`, and `AuditRecord` models.
- Produces `V2GRepository.append_audit(command_id, event_type, payload) -> AuditRecord`.

- [ ] **Step 1: Write a failing audit immutability test.**

```python
async def test_command_audit_is_append_only(repository):
    event = await repository.append_audit('cmd-1', 'command.requested', {'actor': 'operator'})
    assert event.sequence == 1
    assert await repository.audit_events('cmd-1') == [event]
```

- [ ] **Step 2: Run the test and verify failure.**

Run: `pytest services/v2g-api/tests/test_repository.py::test_command_audit_is_append_only -q`  
Expected: FAIL because `V2GRepository` is not defined.

- [ ] **Step 3: Implement the schema and repository boundary.**

```python
class AuditRecord(Base):
    __tablename__ = 'audit_records'
    audit_id: Mapped[int] = mapped_column(primary_key=True)
    command_id: Mapped[str] = mapped_column(index=True)
    sequence: Mapped[int]
    event_type: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
```

Implement a unique `(command_id, sequence)` constraint; allocate the next sequence inside the database transaction. Add indexes for `(asset_id, occurred_at)`, `(site_id, occurred_at)`, alarm state/severity, and command state/expiry.

- [ ] **Step 4: Run migration and repository tests.**

Run: `alembic upgrade head && pytest services/v2g-api/tests/test_repository.py -q`  
Expected: migration succeeds; audit test passes.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app/services/v2g-api
git commit -m "feat(v2g): add historian and command audit schema"
```

## Task 3: Implement deterministic fleet, telemetry, and alarm simulation

**Owner:** Embedded Firmware Engineer + IoT Fleet Engineer  
**Files:**
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/simulator.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/alarms.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/seed.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_simulator.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_alarms.py`

**Interfaces:**
- Produces `FleetSimulator.tick(at: datetime) -> list[SimulatorEvent]`.
- Produces `AlarmService.raise_or_clear(event: SimulatorEvent) -> list[Alarm]`.

- [ ] **Step 1: Write failing deterministic-state tests.**

```python
def test_tick_is_repeatable_for_same_seed():
    left = FleetSimulator(seed=7).tick(datetime(2026, 7, 25, tzinfo=UTC))
    right = FleetSimulator(seed=7).tick(datetime(2026, 7, 25, tzinfo=UTC))
    assert left == right

def test_disconnected_evse_creates_communications_alarm():
    alarms = AlarmService().raise_or_clear(SimulatorEvent.evse_disconnected('evse-03'))
    assert alarms[0].code == 'evse.communication_lost'
```

- [ ] **Step 2: Run tests and verify failure.**

Run: `pytest services/v2g-api/tests/test_simulator.py services/v2g-api/tests/test_alarms.py -q`  
Expected: import failures.

- [ ] **Step 3: Implement OCPP-shaped simulated events.**

```python
@dataclass(frozen=True)
class SimulatorEvent:
    kind: Literal['status_notification', 'transaction_event', 'meter_values', 'smart_charging_result']
    asset_id: str
    occurred_at: datetime
    payload: dict[str, Any]
```

Seed a single `demo-v2g-site`, five EVSEs, three active sessions, one unplugged session, 30 days of 15-minute site/EVSE telemetry, and at least two current alarms. Persist events before publishing them.

- [ ] **Step 4: Run simulation tests.**

Run: `pytest services/v2g-api/tests/test_simulator.py services/v2g-api/tests/test_alarms.py -q`  
Expected: all pass; repeated ticks produce equal event payloads.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app/services/v2g-api
git commit -m "feat(v2g): simulate fleet telemetry and alarm states"
```

## Task 4: Add recommendation, approval, and command state machine

**Owner:** Backend Architect + Security Architect + Model QA Specialist  
**Files:**
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/dispatch.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/commands.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_dispatch.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_commands.py`

**Interfaces:**
- Produces `build_recommendation(site_state) -> DispatchRecommendation`.
- Produces `CommandService.request`, `approve`, `reject`, `execute_simulated`.
- Command states: `requested -> validated -> awaiting_approval -> approved -> simulated`; terminal alternatives are `rejected`, `failed`, `expired`, and `cancelled`.

- [ ] **Step 1: Write failing policy tests.**

```python
async def test_expired_command_cannot_be_approved(service):
    command = await service.request(valid_request(expires_at=utcnow() - timedelta(minutes=1)))
    with pytest.raises(CommandPolicyError, match='expired'):
        await service.approve(command.command_id, actor='operator-01')

async def test_same_idempotency_key_returns_same_command(service):
    first = await service.request(valid_request(idempotency_key='key-1'))
    second = await service.request(valid_request(idempotency_key='key-1'))
    assert second.command_id == first.command_id
```

- [ ] **Step 2: Run tests and verify failure.**

Run: `pytest services/v2g-api/tests/test_dispatch.py services/v2g-api/tests/test_commands.py -q`  
Expected: import failures.

- [ ] **Step 3: Implement constraint evaluation and the auditable state machine.**

```python
def validate_request(request: CommandRequest, state: SiteState) -> None:
    if request.expires_at <= utcnow(): raise CommandPolicyError('expired')
    if request.power_kw > state.available_flexible_kw: raise CommandPolicyError('insufficient flexible capacity')
    if request.power_kw < 0 and state.minimum_ev_soc > request.projected_soc: raise CommandPolicyError('departure SOC violation')
```

`request` writes `command.requested`, `command.validated`, and `command.awaiting_approval`; `approve` writes `command.approved`; only `execute_simulated` writes `command.simulated`. Require a non-empty operator reason for reject/cancel. Never expose an endpoint that calls a charger or external socket.

- [ ] **Step 4: Run policy tests.**

Run: `pytest services/v2g-api/tests/test_dispatch.py services/v2g-api/tests/test_commands.py -q`  
Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app/services/v2g-api
git commit -m "feat(v2g): add guarded simulated dispatch commands"
```

## Task 5: Expose REST and SSE supervisor contracts

**Owner:** API Platform Engineer + MCP Builder  
**Files:**
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/contracts.py`
- Create: `apps/v2g-integration-app/services/v2g-api/src/v2g/stream.py`
- Modify: `apps/v2g-integration-app/services/v2g-api/src/v2g/app.py`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_api.py`

**Interfaces:**
- `GET /api/v1/sites/demo-v2g-site/overview`
- `GET /api/v1/sites/demo-v2g-site/fleet`
- `GET /api/v1/sites/demo-v2g-site/historian?from=&to=&metric=`
- `GET /api/v1/sites/demo-v2g-site/alarms`
- `GET /api/v1/sites/demo-v2g-site/recommendations`
- `POST /api/v1/commands`, `POST /api/v1/commands/{id}/approve`, `POST /api/v1/commands/{id}/reject`
- `GET /api/v1/events` as `text/event-stream`.

- [ ] **Step 1: Write failing API-contract tests.**

```python
def test_overview_has_data_quality_and_flexible_capacity(client):
    response = client.get('/api/v1/sites/demo-v2g-site/overview')
    assert response.status_code == 200
    assert {'site_power_kw', 'available_flexible_kw', 'data_freshness'} <= response.json().keys()

def test_approve_requires_operator_identity(client):
    response = client.post('/api/v1/commands/cmd-1/approve', json={})
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests and verify failure.**

Run: `pytest services/v2g-api/tests/test_api.py -q`  
Expected: 404 responses.

- [ ] **Step 3: Implement typed contracts and event publishing.**

```python
class ApprovalRequest(BaseModel):
    actor: Annotated[str, Field(min_length=1)]
    reason: Annotated[str, Field(min_length=1)]
```

Publish only normalized `{type, occurred_at, correlation_id, payload}` events. The event stream is read-only and reconnect-safe via a `last_event_id` query parameter.

- [ ] **Step 4: Run contract tests.**

Run: `pytest services/v2g-api/tests/test_api.py -q`  
Expected: all pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app/services/v2g-api
git commit -m "feat(v2g): expose supervisor api and event stream"
```

## Task 6: Build the SCADA operator interface

**Owner:** UX Architect + UI Designer + Frontend Developer  
**Files:**
- Create: `apps/v2g-integration-app/src/api/client.js`
- Create: `apps/v2g-integration-app/src/features/operations/OperationsPage.jsx`
- Create: `apps/v2g-integration-app/src/features/fleet/FleetPage.jsx`
- Create: `apps/v2g-integration-app/src/features/dispatch/DispatchPage.jsx`
- Create: `apps/v2g-integration-app/src/features/alarms/AlarmPage.jsx`
- Create: `apps/v2g-integration-app/src/features/historian/HistorianPage.jsx`
- Create: `apps/v2g-integration-app/src/components/CommandApprovalDialog.jsx`
- Modify: `apps/v2g-integration-app/src/App.jsx`
- Modify: `apps/v2g-integration-app/src/styles.css`
- Test: `apps/v2g-integration-app/tests/operations.test.jsx`
- Test: `apps/v2g-integration-app/tests/command-approval.test.jsx`

**Interfaces:**
- Consumes the Task 5 HTTP contracts.
- Produces accessible nav tabs for Operations, Fleet, Dispatch, Alarms, and Historian.

- [ ] **Step 1: Write failing UI behavior tests.**

```jsx
test('opens approval dialog only for a pending recommendation', async () => {
  render(<DispatchPage recommendation={pendingRecommendation} />);
  await userEvent.click(screen.getByRole('button', { name: 'Approve simulated command' }));
  expect(screen.getByRole('dialog', { name: 'Approve simulated command' })).toBeVisible();
});
```

- [ ] **Step 2: Run tests and verify failure.**

Run: `npm test -- --run tests/operations.test.jsx tests/command-approval.test.jsx`  
Expected: missing component failures.

- [ ] **Step 3: Implement the UI with explicit operational states.**

```jsx
<button disabled={recommendation.status !== 'awaiting_approval'}>
  Approve simulated command
</button>
```

Display telemetry freshness and quality next to all real-time values. Label the action `Approve simulated command`; show expiry, constraint summary, projected SOC, and expected site impact inside the confirmation dialog. Use compact panels without nested card stacks; support loading, empty, error, and stale-data states.

- [ ] **Step 4: Run UI tests, build, and browser smoke test.**

Run: `npm test -- --run && npm run build`  
Expected: all pass. Start with `npm run dev` and inspect the five tabs using the in-app browser.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app/src apps/v2g-integration-app/tests
git commit -m "feat(v2g): add scada operator interface"
```

## Task 7: Containerize, seed, and verify the full stack

**Owner:** SRE Site Reliability Engineer + Test Automation Engineer  
**Files:**
- Create: `apps/v2g-integration-app/docker-compose.yml`
- Create: `apps/v2g-integration-app/Dockerfile`
- Create: `apps/v2g-integration-app/services/v2g-api/Dockerfile`
- Create: `apps/v2g-integration-app/scripts/smoke_test_v2g_stack.sh`
- Modify: `apps/v2g-integration-app/README.md`
- Test: `apps/v2g-integration-app/services/v2g-api/tests/test_seed.py`

**Interfaces:**
- Produces `http://localhost:5181` for UI and `http://localhost:8005/healthz` for API.
- Produces reproducible demo data after `docker compose up --build`.

- [ ] **Step 1: Write a failing seed and stack smoke test.**

```python
async def test_seed_contains_five_evses(seed_repository):
    assert await seed_repository.count_evses('demo-v2g-site') == 5
```

```bash
curl --fail http://localhost:8005/healthz
curl --fail http://localhost:8005/api/v1/sites/demo-v2g-site/overview
```

- [ ] **Step 2: Run the seed test and verify failure.**

Run: `pytest services/v2g-api/tests/test_seed.py -q`  
Expected: failure until the seed service exists.

- [ ] **Step 3: Add Compose services and deterministic bootstrap.**

```yaml
services:
  postgres:
    image: postgres:16-alpine
  api:
    build: ./services/v2g-api
    depends_on: [postgres]
  v2g-scada:
    build: .
    ports: ['5181:80']
    depends_on: [api]
```

Run Alembic migration and seed logic before the API accepts requests. Include health checks for all three containers; avoid mounting source code or relying on host-only dependencies.

- [ ] **Step 4: Run verification.**

Run: `docker compose up --build -d && ./scripts/smoke_test_v2g_stack.sh && docker compose down`  
Expected: all containers healthy, overview endpoint returns demo data, UI returns HTTP 200.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app
git commit -m "feat(v2g): ship local scada simulator stack"
```

## Task 8: Audit prototype readiness and handoff

**Owner:** Product Manager + Application Security Engineer + Technical Writer  
**Files:**
- Modify: `apps/v2g-integration-app/README.md`
- Create: `apps/v2g-integration-app/docs/simulator-safety-boundary.md`
- Create: `apps/v2g-integration-app/docs/operator-walkthrough.md`
- Test: `apps/v2g-integration-app/scripts/smoke_test_v2g_stack.sh`

- [ ] **Step 1: Write the safety-boundary acceptance checklist.**

```markdown
- [ ] No endpoint connects to an external OCPP, EVSE, vehicle, or utility host.
- [ ] Every approved command has an audit sequence from request through simulated result.
- [ ] UI visibly labels all controllable actions as simulated.
```

- [ ] **Step 2: Verify it against code and running stack.**

Run: `rg -n 'websocket|ocpp|socket\.connect|requests\.(post|put)' apps/v2g-integration-app/services/v2g-api/src`  
Expected: no external-control client implementation; OCPP may appear only in documentation or simulated event labels.

- [ ] **Step 3: Document local operations and user walkthrough.**

Describe stack startup, reset, data ranges, simulator scenarios, the approval flow, alarm acknowledgement, and the difference between recommendation and simulated command execution.

- [ ] **Step 4: Run complete quality checks.**

Run: `npm test -- --run && npm run build && pytest services/v2g-api/tests -q && docker compose up --build -d && ./scripts/smoke_test_v2g_stack.sh && docker compose down`  
Expected: all commands succeed.

- [ ] **Step 5: Commit.**

```bash
git add apps/v2g-integration-app
git commit -m "docs(v2g): add simulator operations handoff"
```

## Role handoff matrix

| Workstream | Primary role | Review role |
|---|---|---|
| Product boundaries and acceptance | Product Manager | Workflow Architect |
| State machine and supervisor API | Backend Architect | Security Architect |
| Fleet/event simulation | Embedded Firmware Engineer | IoT Fleet Engineer |
| Historian and seed data | Data Engineer | Database Optimizer |
| Dispatch constraints | AI Engineer | Model QA Specialist |
| UI and operator workflow | UX Architect | UI Designer |
| Docker, reliability, smoke tests | SRE Site Reliability Engineer | Test Automation Engineer |
| API contracts/LLM-readiness | API Platform Engineer | MCP Builder |
| Audit and safety docs | Application Security Engineer | Technical Writer |

## Plan self-review

- **Spec coverage:** Tasks 2–7 cover historian, simulator, alarms, dispatch, approval, audit, API/SSE, UI, local Compose, and testable seeded scenarios. Task 8 confirms the simulator-only boundary and operating documentation.
- **Completeness:** Every task includes concrete file paths, interfaces, an executable test or verification command, and a commit step.
- **Consistency:** `demo-v2g-site`, command state names, `/api/v1` API base, API port `8005`, UI port `5181`, and simulated-only command behavior are shared consistently across tasks.
