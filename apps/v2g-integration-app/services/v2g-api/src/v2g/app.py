"""Simulator-only HTTP surface for the V2G supervisor demo."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Path, Query, status
from fastapi.responses import JSONResponse

from v2g.commands import CommandPolicyError, CommandService
from v2g.contracts import (
    AlarmsResponse,
    ApprovalRequest,
    CommandCreateRequest,
    CommandResponse,
    DemoReadModel,
    FleetResponse,
    HistorianResponse,
    MetricName,
    OverviewResponse,
    RecommendationsResponse,
    RejectionRequest,
)
from v2g.simulator import DEMO_SITE_ID
from v2g.stream import EventJournal, event_stream_response

app = FastAPI(title="V2G SCADA Simulator")

_read_model = DemoReadModel()
_command_service = CommandService(_read_model.site_state, now=lambda: datetime.now(UTC))
_event_journal = EventJournal()


def get_read_model() -> DemoReadModel:
    """Dependency seam for deterministic read-model fixtures."""
    return _read_model


def get_command_service() -> CommandService:
    """Dependency seam for isolated in-memory command-service fixtures."""
    return _command_service


def get_event_journal() -> EventJournal:
    """Dependency seam for a bounded event journal fixture."""
    return _event_journal


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
