"""Typed, allowlisted HTTP contracts for the simulator-only V2G demo."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from v2g.commands import CommandRequest, SimulatedCommand
from v2g.dispatch import SiteState, build_recommendation
from v2g.seed import DEMO_SEED_AT, DemoFleet, build_demo_fleet
from v2g.simulator import DEMO_SITE_ID


MetricName = Literal["power_kw"]
DataQuality = Literal["good", "stale"]


class ContractModel(BaseModel):
    """Reject undeclared input fields and non-finite JSON numbers at the boundary."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)


NonEmptyText = Annotated[str, Field(min_length=1, max_length=256)]
Identifier = Annotated[str, Field(min_length=1, max_length=128)]


class DataFreshness(ContractModel):
    observed_at: datetime
    quality: DataQuality

    @field_validator("observed_at")
    @classmethod
    def requires_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("observed_at must include a timezone")
        return value.astimezone(UTC)


class OverviewResponse(ContractModel):
    site_id: str
    site_power_kw: float
    available_flexible_kw: float
    data_freshness: DataFreshness


class FleetEvseResponse(ContractModel):
    asset_id: str
    display_name: str
    state: str


class FleetSessionResponse(ContractModel):
    session_id: str
    asset_id: str
    state: str
    started_at: datetime
    energy_imported_kwh: float


class FleetResponse(ContractModel):
    site_id: str
    evses: tuple[FleetEvseResponse, ...]
    sessions: tuple[FleetSessionResponse, ...]


class HistorianPointResponse(ContractModel):
    asset_id: str
    value: float
    unit: str
    quality: str
    occurred_at: datetime


class HistorianResponse(ContractModel):
    site_id: str
    metric: MetricName
    from_: datetime = Field(serialization_alias="from")
    to: datetime
    points: tuple[HistorianPointResponse, ...]
    truncated: bool


class AlarmResponse(ContractModel):
    asset_id: str | None
    code: str
    severity: str
    state: str
    message: str
    raised_at: datetime
    cleared_at: datetime | None


class AlarmsResponse(ContractModel):
    site_id: str
    alarms: tuple[AlarmResponse, ...]


class RecommendationResponse(ContractModel):
    site_id: str
    expected_site_impact_kw: float
    expires_at: datetime
    assumptions: tuple[str, ...]
    constraints: tuple[str, ...]
    confidence: float
    status: str
    reason: str


class RecommendationsResponse(ContractModel):
    site_id: str
    recommendations: tuple[RecommendationResponse, ...]


class CommandCreateRequest(ContractModel):
    site_id: Identifier
    power_kw: float
    projected_soc_percent: float
    expires_at: datetime
    correlation_id: Identifier
    idempotency_key: Identifier

    @field_validator("expires_at")
    @classmethod
    def expiry_requires_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("expires_at must include a timezone")
        return value.astimezone(UTC)

    def to_command_request(self) -> CommandRequest:
        return CommandRequest(
            site_id=self.site_id,
            power_kw=self.power_kw,
            projected_soc_percent=self.projected_soc_percent,
            expires_at=self.expires_at,
            correlation_id=self.correlation_id,
            idempotency_key=self.idempotency_key,
        )


class ApprovalRequest(ContractModel):
    actor: NonEmptyText
    reason: NonEmptyText


class RejectionRequest(ContractModel):
    actor: NonEmptyText
    reason: NonEmptyText


class CommandResponse(ContractModel):
    command_id: str
    site_id: str
    state: str
    power_kw: float
    projected_soc_percent: float
    expires_at: datetime
    created_at: datetime
    correlation_id: str
    approved_by: str | None
    rejection_reason: str | None

    @classmethod
    def from_command(cls, command: SimulatedCommand) -> "CommandResponse":
        return cls(
            command_id=command.command_id,
            site_id=command.request.site_id,
            state=command.state,
            power_kw=command.request.power_kw,
            projected_soc_percent=command.request.projected_soc_percent,
            expires_at=command.expires_at,
            created_at=command.created_at,
            correlation_id=command.correlation_id,
            approved_by=command.approved_by,
            rejection_reason=command.rejection_reason,
        )


class DemoReadModel:
    """Fixed, in-process simulator data projected through public contract models only."""

    historian_limit = 1_000

    def __init__(
        self,
        fleet: DemoFleet | None = None,
        *,
        site_state: SiteState | None = None,
    ) -> None:
        self._fleet = fleet or build_demo_fleet(DEMO_SEED_AT)
        observed_at = max(point.occurred_at for point in self._fleet.telemetry_points)
        self._site_state = site_state or SiteState(
            site_id=DEMO_SITE_ID,
            soc_percent=80.0,
            minimum_departure_soc_percent=30.0,
            available_flexible_kw=25.0,
            observed_at=observed_at,
        )

    @property
    def site_state(self) -> SiteState:
        return self._site_state

    def overview(self) -> OverviewResponse:
        latest_by_asset = {}
        for point in self._fleet.telemetry_points:
            if point.metric == "power_kw":
                latest_by_asset[point.asset_id] = point
        observed_at = max(point.occurred_at for point in latest_by_asset.values())
        return OverviewResponse(
            site_id=DEMO_SITE_ID,
            site_power_kw=round(sum(float(point.value) for point in latest_by_asset.values()), 3),
            available_flexible_kw=self._site_state.available_flexible_kw,
            data_freshness=DataFreshness(observed_at=observed_at, quality="good"),
        )

    def fleet(self) -> FleetResponse:
        return FleetResponse(
            site_id=DEMO_SITE_ID,
            evses=tuple(
                FleetEvseResponse(
                    asset_id=evse.asset_id,
                    display_name=evse.display_name,
                    state=evse.state,
                )
                for evse in self._fleet.evses
            ),
            sessions=tuple(
                FleetSessionResponse(
                    session_id=session.session_id,
                    asset_id=session.asset_id,
                    state=session.state,
                    started_at=session.started_at,
                    energy_imported_kwh=float(session.energy_imported_kwh),
                )
                for session in self._fleet.sessions
            ),
        )

    def historian(self, from_: datetime, to: datetime, metric: MetricName) -> HistorianResponse:
        points = [
            HistorianPointResponse(
                asset_id=point.asset_id,
                value=float(point.value),
                unit=point.unit,
                quality=point.quality,
                occurred_at=point.occurred_at,
            )
            for point in self._fleet.telemetry_points
            if point.metric == metric and from_ <= point.occurred_at <= to
        ]
        points.sort(key=lambda point: (point.occurred_at, point.asset_id))
        return HistorianResponse(
            site_id=DEMO_SITE_ID,
            metric=metric,
            from_=from_,
            to=to,
            points=tuple(points[: self.historian_limit]),
            truncated=len(points) > self.historian_limit,
        )

    def alarms(self) -> AlarmsResponse:
        return AlarmsResponse(
            site_id=DEMO_SITE_ID,
            alarms=tuple(
                AlarmResponse(
                    asset_id=alarm.asset_id,
                    code=alarm.code,
                    severity=alarm.severity,
                    state=alarm.state,
                    message=alarm.message,
                    raised_at=alarm.raised_at,
                    cleared_at=alarm.cleared_at,
                )
                for alarm in self._fleet.alarms
            ),
        )

    def recommendations(self) -> RecommendationsResponse:
        recommendation = build_recommendation(self._site_state)
        return RecommendationsResponse(
            site_id=DEMO_SITE_ID,
            recommendations=(
                RecommendationResponse(
                    site_id=recommendation.site_id,
                    expected_site_impact_kw=recommendation.expected_site_impact_kw,
                    expires_at=recommendation.expires_at,
                    assumptions=recommendation.assumptions,
                    constraints=recommendation.constraints,
                    confidence=recommendation.confidence,
                    status=recommendation.status,
                    reason=recommendation.reason,
                ),
            ),
        )
