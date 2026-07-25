"""Simulator-only HTTP surface for the V2G supervisor demo."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from v2g.commands import CommandPolicyError, CommandService
from v2g.contracts import (
    AlarmsResponse,
    ApprovalRequest,
    CommandCreateRequest,
    CommandResponse,
    DiagnosticsResponse,
    DemoReadModel,
    EventsResponse,
    FleetResponse,
    HistorianResponse,
    InvertersResponse,
    InverterTrendMetric,
    InverterTrendResponse,
    MetricName,
    OverviewResponse,
    RecommendationsResponse,
    RejectionRequest,
    WorkOrderTransitionRequest,
    WorkOrderResponse,
    WorkOrdersResponse,
    AnalyticsResponse,
    AlarmState,
)
from v2g.repository import V2GRepository
from v2g.simulator import DEMO_SITE_ID
from v2g.stream import EventJournal, event_stream_response
from v2g.workspace import WorkOrderService, WorkspaceNotFound, WorkspaceReadModel

app = FastAPI(title="V2G SCADA Simulator")

_read_model = DemoReadModel()
_command_service = CommandService(_read_model.site_state, now=lambda: datetime.now(UTC))
_event_journal = EventJournal()
_workspace_engine: AsyncEngine | None = None
_workspace_read_model: WorkspaceReadModel | None = None
_work_order_service: WorkOrderService | None = None


def get_read_model() -> DemoReadModel:
    """Dependency seam for deterministic read-model fixtures."""
    return _read_model


def get_command_service() -> CommandService:
    """Dependency seam for isolated in-memory command-service fixtures."""
    return _command_service


def get_event_journal() -> EventJournal:
    """Dependency seam for a bounded event journal fixture."""
    return _event_journal


def _workspace_services() -> tuple[WorkspaceReadModel, WorkOrderService]:
    """Connect only to the local simulator database configured for this API."""
    global _workspace_engine, _workspace_read_model, _work_order_service
    if _workspace_read_model is None or _work_order_service is None:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is required for operational workspace endpoints")
        _workspace_engine = create_async_engine(database_url)
        sessions = async_sessionmaker(_workspace_engine, expire_on_commit=False)
        repository = V2GRepository(_workspace_engine)
        _workspace_read_model = WorkspaceReadModel(sessions)
        _work_order_service = WorkOrderService(repository)
    return _workspace_read_model, _work_order_service


def get_workspace_read_model() -> WorkspaceReadModel:
    """Dependency seam for database-backed simulator workspace projections."""
    return _workspace_services()[0]


def get_work_order_service() -> WorkOrderService:
    """Dependency seam for the constrained simulator work-order transition."""
    return _workspace_services()[1]


def _require_demo_site(site_id: str) -> None:
    if site_id != DEMO_SITE_ID:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown simulator site")


def _command_error(error: CommandPolicyError) -> JSONResponse:
    message = str(error)
    if message == "unknown command":
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"code": "command_not_found", "message": message},
        )
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"code": "command_policy_rejected", "message": message},
    )


def _workspace_time_range(from_: datetime, to: datetime) -> tuple[datetime, datetime]:
    if from_.tzinfo is None or from_.utcoffset() is None or to.tzinfo is None or to.utcoffset() is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from and to must include timezones",
        )
    from_ = from_.astimezone(UTC)
    to = to.astimezone(UTC)
    if from_ > to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from must not be after to",
        )
    return from_, to


def _workspace_not_found(error: WorkspaceNotFound) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/v1/sites/{site_id}/overview",
    response_model=OverviewResponse,
)
async def overview(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    read_model: Annotated[DemoReadModel, Depends(get_read_model)],
) -> OverviewResponse:
    _require_demo_site(site_id)
    return read_model.overview()


@app.get(
    "/api/v1/sites/{site_id}/fleet",
    response_model=FleetResponse,
)
async def fleet(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    read_model: Annotated[DemoReadModel, Depends(get_read_model)],
) -> FleetResponse:
    _require_demo_site(site_id)
    return read_model.fleet()


@app.get(
    "/api/v1/sites/{site_id}/historian",
    response_model=HistorianResponse,
)
async def historian(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    from_: Annotated[datetime, Query(alias="from")],
    to: datetime,
    metric: MetricName,
    read_model: Annotated[DemoReadModel, Depends(get_read_model)],
) -> HistorianResponse | JSONResponse:
    _require_demo_site(site_id)
    if from_.tzinfo is None or from_.utcoffset() is None or to.tzinfo is None or to.utcoffset() is None:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"code": "invalid_time_range", "message": "from and to must include timezones"},
        )
    if from_ > to:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"code": "invalid_time_range", "message": "from must not be after to"},
        )
    return read_model.historian(from_.astimezone(UTC), to.astimezone(UTC), metric)


@app.get(
    "/api/v1/sites/{site_id}/alarms",
    response_model=AlarmsResponse,
)
async def alarms(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    read_model: Annotated[DemoReadModel, Depends(get_read_model)],
) -> AlarmsResponse:
    _require_demo_site(site_id)
    return read_model.alarms()


@app.get(
    "/api/v1/sites/{site_id}/recommendations",
    response_model=RecommendationsResponse,
)
async def recommendations(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    read_model: Annotated[DemoReadModel, Depends(get_read_model)],
) -> RecommendationsResponse:
    _require_demo_site(site_id)
    return read_model.recommendations()


@app.get(
    "/api/v1/sites/{site_id}/diagnostics",
    response_model=DiagnosticsResponse,
)
async def diagnostics(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    workspace: Annotated[WorkspaceReadModel, Depends(get_workspace_read_model)],
) -> DiagnosticsResponse:
    _require_demo_site(site_id)
    try:
        return await workspace.diagnostics(site_id)
    except WorkspaceNotFound as error:
        raise _workspace_not_found(error) from error


@app.get(
    "/api/v1/sites/{site_id}/inverters",
    response_model=InvertersResponse,
)
async def inverters(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    workspace: Annotated[WorkspaceReadModel, Depends(get_workspace_read_model)],
) -> InvertersResponse:
    _require_demo_site(site_id)
    return await workspace.inverters(site_id)


@app.get(
    "/api/v1/sites/{site_id}/inverters/{asset_id}/trend",
    response_model=InverterTrendResponse,
)
async def inverter_trend(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    asset_id: Annotated[str, Path(min_length=1, max_length=128)],
    from_: Annotated[datetime, Query(alias="from")],
    to: datetime,
    metric: InverterTrendMetric,
    workspace: Annotated[WorkspaceReadModel, Depends(get_workspace_read_model)],
) -> InverterTrendResponse:
    _require_demo_site(site_id)
    from_, to = _workspace_time_range(from_, to)
    try:
        return await workspace.inverter_trend(site_id, asset_id, metric, from_, to)
    except WorkspaceNotFound as error:
        raise _workspace_not_found(error) from error


@app.get(
    "/api/v1/sites/{site_id}/events",
    response_model=EventsResponse,
)
async def workspace_events(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    severity: Annotated[str | None, Query(max_length=32)] = None,
    asset_id: Annotated[str | None, Query(max_length=128)] = None,
    state: AlarmState | None = None,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    to: datetime | None = None,
    workspace: WorkspaceReadModel = Depends(get_workspace_read_model),
) -> EventsResponse:
    _require_demo_site(site_id)
    if (from_ is None) != (to is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from and to must be supplied together",
        )
    if from_ is not None and to is not None:
        from_, to = _workspace_time_range(from_, to)
    return await workspace.events(
        site_id,
        severity=severity,
        asset_id=asset_id,
        state=state,
        from_=from_,
        to=to,
    )


@app.get(
    "/api/v1/sites/{site_id}/work-orders",
    response_model=WorkOrdersResponse,
)
async def work_orders(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    workspace: Annotated[WorkspaceReadModel, Depends(get_workspace_read_model)],
) -> WorkOrdersResponse:
    _require_demo_site(site_id)
    return await workspace.work_orders(site_id)


@app.patch(
    "/api/v1/work-orders/{work_order_id}",
    response_model=WorkOrderResponse,
)
async def transition_work_order(
    work_order_id: Annotated[str, Path(min_length=1, max_length=128)],
    request: WorkOrderTransitionRequest,
    work_order_service: Annotated[WorkOrderService, Depends(get_work_order_service)],
) -> WorkOrderResponse:
    try:
        return await work_order_service.transition(
            work_order_id,
            request.state,
            actor=request.actor,
            reason=request.reason,
        )
    except WorkspaceNotFound as error:
        raise _workspace_not_found(error) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@app.get(
    "/api/v1/sites/{site_id}/analytics",
    response_model=AnalyticsResponse,
)
async def analytics(
    site_id: Annotated[str, Path(min_length=1, max_length=128)],
    from_: Annotated[datetime, Query(alias="from")],
    to: datetime,
    workspace: Annotated[WorkspaceReadModel, Depends(get_workspace_read_model)],
) -> AnalyticsResponse:
    _require_demo_site(site_id)
    from_, to = _workspace_time_range(from_, to)
    return await workspace.analytics(site_id, from_, to)


@app.post(
    "/api/v1/commands",
    response_model=CommandResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_command(
    request: CommandCreateRequest,
    commands: Annotated[CommandService, Depends(get_command_service)],
    journal: Annotated[EventJournal, Depends(get_event_journal)],
) -> CommandResponse | JSONResponse:
    _require_demo_site(request.site_id)
    try:
        command = await commands.request(request.to_command_request())
    except CommandPolicyError as error:
        return _command_error(error)
    event = journal.publish_command(command)
    response = CommandResponse.from_command(command)
    if event is None:
        return JSONResponse(status_code=status.HTTP_200_OK, content=response.model_dump(mode="json"))
    return response


@app.post(
    "/api/v1/commands/{command_id}/approve",
    response_model=CommandResponse,
)
async def approve_command(
    command_id: Annotated[str, Path(min_length=1, max_length=128)],
    request: ApprovalRequest,
    commands: Annotated[CommandService, Depends(get_command_service)],
    journal: Annotated[EventJournal, Depends(get_event_journal)],
) -> CommandResponse | JSONResponse:
    try:
        command = await commands.approve(
            command_id,
            actor=request.actor,
            reason=request.reason,
        )
    except CommandPolicyError as error:
        return _command_error(error)
    journal.publish_command(command)
    return CommandResponse.from_command(command)


@app.post(
    "/api/v1/commands/{command_id}/reject",
    response_model=CommandResponse,
)
async def reject_command(
    command_id: Annotated[str, Path(min_length=1, max_length=128)],
    request: RejectionRequest,
    commands: Annotated[CommandService, Depends(get_command_service)],
    journal: Annotated[EventJournal, Depends(get_event_journal)],
) -> CommandResponse | JSONResponse:
    try:
        command = await commands.reject(command_id, actor=request.actor, reason=request.reason)
    except CommandPolicyError as error:
        return _command_error(error)
    journal.publish_command(command)
    return CommandResponse.from_command(command)


@app.get("/api/v1/events")
async def events(
    last_event_id: Annotated[int, Query(ge=0)] = 0,
    journal: EventJournal = Depends(get_event_journal),
):
    """Return the finite replay window after an SSE cursor; clients reconnect when it ends."""
    return event_stream_response(journal.after(last_event_id))
