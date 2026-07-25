"""Persisted, simulator-only projections for the operational workspace."""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime
from statistics import median

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from v2g.contracts import (
    AlarmState,
    AnalyticsInverterResponse,
    AnalyticsResponse,
    DiagnosticAssetResponse,
    DiagnosticsResponse,
    EventAggregateResponse,
    EventResponse,
    EventsResponse,
    InverterResponse,
    InvertersResponse,
    InverterTrendMetric,
    InverterTrendPointResponse,
    InverterTrendResponse,
    StringResponse,
    WorkOrderResponse,
    WorkOrdersResponse,
    WorkOrderState,
)
from v2g.models import Alarm, Evse, InverterReading, StringReading, TelemetryPoint, WorkOrder
from v2g.repository import V2GRepository
from v2g.simulator import DEMO_SITE_ID


class WorkspaceNotFound(ValueError):
    """Raised when a fixed-site workspace resource is not persisted."""


def _utc(value: datetime) -> datetime:
    """Normalise SQLite's timezone-naive test rows and PostgreSQL timestamps."""
    return value.replace(tzinfo=UTC) if value.tzinfo is None or value.utcoffset() is None else value.astimezone(UTC)


class WorkspaceReadModel:
    """Read-only projections over the deterministic simulator persistence model."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession]) -> None:
        self._sessions = sessions

    async def diagnostics(self, site_id: str) -> DiagnosticsResponse:
        async with self._sessions() as session:
            evses = list(
                await session.scalars(
                    select(Evse).where(Evse.site_id == site_id).order_by(Evse.asset_id)
                )
            )
            latest_rows = (
                await session.execute(
                    select(TelemetryPoint.asset_id, func.max(TelemetryPoint.occurred_at))
                    .where(TelemetryPoint.site_id == site_id)
                    .group_by(TelemetryPoint.asset_id)
                )
            ).all()
            latest_by_asset = {asset_id: _utc(observed_at) for asset_id, observed_at in latest_rows}
            open_alarm_rows = (
                await session.execute(
                    select(Alarm.asset_id, func.count())
                    .where(Alarm.site_id == site_id, Alarm.state != "cleared")
                    .group_by(Alarm.asset_id)
                )
            ).all()

        if not evses or not latest_by_asset:
            raise WorkspaceNotFound("simulator diagnostics are unavailable")
        open_alarm_count_by_asset = {
            asset_id: int(count) for asset_id, count in open_alarm_rows if asset_id is not None
        }
        observed_at = max(latest_by_asset.values())
        assets = tuple(
            DiagnosticAssetResponse(
                asset_id=evse.asset_id,
                communication_state=evse.state,
                latest_telemetry_at=latest_by_asset[evse.asset_id],
                telemetry_gap_minutes=(observed_at - latest_by_asset[evse.asset_id]).total_seconds() / 60,
                open_alarm_count=open_alarm_count_by_asset.get(evse.asset_id, 0),
            )
            for evse in evses
            if evse.asset_id in latest_by_asset
        )
        return DiagnosticsResponse(
            site_id=site_id,
            observed_at=observed_at,
            open_alarm_count=sum(int(count) for _, count in open_alarm_rows),
            assets=assets,
        )

    async def inverters(self, site_id: str) -> InvertersResponse:
        readings = await self._inverter_rows(site_id)
        return InvertersResponse(
            site_id=site_id,
            inverters=tuple(self._inverter_response(reading) for reading in readings),
        )

    async def inverter_trend(
        self,
        site_id: str,
        asset_id: str,
        metric: InverterTrendMetric,
        from_: datetime,
        to: datetime,
    ) -> InverterTrendResponse:
        async with self._sessions() as session:
            rows = list(
                await session.scalars(
                    select(InverterReading)
                    .where(
                        InverterReading.site_id == site_id,
                        InverterReading.inverter_id == asset_id,
                        InverterReading.source == "simulated",
                        InverterReading.occurred_at >= from_,
                        InverterReading.occurred_at <= to,
                    )
                    .order_by(InverterReading.occurred_at)
                )
            )
            exists = await session.scalar(
                select(InverterReading.inverter_id).where(
                    InverterReading.site_id == site_id,
                    InverterReading.inverter_id == asset_id,
                    InverterReading.source == "simulated",
                )
            )
        if exists is None:
            raise WorkspaceNotFound("simulator inverter was not found")
        return InverterTrendResponse(
            site_id=site_id,
            asset_id=asset_id,
            metric=metric,
            from_=from_,
            to=to,
            points=tuple(
                InverterTrendPointResponse(
                    observed_at=_utc(row.occurred_at), value=float(getattr(row, metric))
                )
                for row in rows
            ),
        )

    async def events(
        self,
        site_id: str,
        *,
        severity: str | None = None,
        asset_id: str | None = None,
        state: AlarmState | None = None,
        from_: datetime | None = None,
        to: datetime | None = None,
    ) -> EventsResponse:
        return EventsResponse(site_id=site_id, events=tuple(await self._event_rows(
            site_id, severity=severity, asset_id=asset_id, state=state, from_=from_, to=to
        )))

    async def work_orders(self, site_id: str) -> WorkOrdersResponse:
        async with self._sessions() as session:
            rows = list(
                await session.scalars(
                    select(WorkOrder)
                    .where(WorkOrder.site_id == site_id, WorkOrder.source == "simulated")
                    .order_by(WorkOrder.created_at, WorkOrder.work_order_id)
                )
            )
        return WorkOrdersResponse(
            site_id=site_id,
            work_orders=tuple(_work_order_response(row) for row in rows),
        )

    async def analytics(self, site_id: str, from_: datetime, to: datetime) -> AnalyticsResponse:
        async with self._sessions() as session:
            inverter_rows = list(
                await session.scalars(
                    select(InverterReading)
                    .where(
                        InverterReading.site_id == site_id,
                        InverterReading.source == "simulated",
                        InverterReading.occurred_at >= from_,
                        InverterReading.occurred_at <= to,
                    )
                    .order_by(InverterReading.inverter_id)
                )
            )
            string_rows = list(
                await session.scalars(
                    select(StringReading)
                    .where(
                        StringReading.site_id == site_id,
                        StringReading.source == "simulated",
                        StringReading.occurred_at >= from_,
                        StringReading.occurred_at <= to,
                    )
                    .order_by(StringReading.inverter_id, StringReading.string_id)
                )
            )

        efficiencies = [float(row.efficiency_percent) for row in inverter_rows]
        fleet_median = median(efficiencies) if efficiencies else None
        dc_power_kw = sum(float(row.dc_power_kw) for row in inverter_rows)
        site_efficiency = (
            sum(float(row.ac_power_kw) for row in inverter_rows) / dc_power_kw * 100
            if dc_power_kw > 0
            else None
        )
        events = await self._event_rows(site_id, from_=from_, to=to)
        severity_counts = Counter(event.severity for event in events)
        return AnalyticsResponse(
            site_id=site_id,
            from_=from_,
            to=to,
            site_efficiency=site_efficiency,
            inverters=tuple(
                AnalyticsInverterResponse(
                    **self._inverter_response(row).model_dump(),
                    efficiency_deviation_percent=float(row.efficiency_percent) - float(fleet_median),
                )
                for row in inverter_rows
            ),
            strings=tuple(
                StringResponse(
                    inverter_id=row.inverter_id,
                    string_id=row.string_id,
                    dc_power_kw=float(row.dc_power_kw),
                    observed_at=_utc(row.occurred_at),
                )
                for row in string_rows
            ),
            events=EventAggregateResponse(
                total=len(events),
                by_severity=tuple(sorted(severity_counts.items())),
            ),
        )

    async def _inverter_rows(self, site_id: str) -> list[InverterReading]:
        async with self._sessions() as session:
            return list(
                await session.scalars(
                    select(InverterReading)
                    .where(InverterReading.site_id == site_id, InverterReading.source == "simulated")
                    .order_by(InverterReading.inverter_id)
                )
            )

    async def _event_rows(
        self,
        site_id: str,
        *,
        severity: str | None = None,
        asset_id: str | None = None,
        state: AlarmState | None = None,
        from_: datetime | None = None,
        to: datetime | None = None,
    ) -> list[EventResponse]:
        conditions = [Alarm.site_id == site_id]
        if severity is not None:
            conditions.append(Alarm.severity == severity)
        if asset_id is not None:
            conditions.append(Alarm.asset_id == asset_id)
        if state is not None:
            conditions.append(Alarm.state == state)
        if from_ is not None:
            conditions.append((Alarm.cleared_at.is_(None)) | (Alarm.cleared_at >= from_))
        if to is not None:
            conditions.append(Alarm.raised_at <= to)
        async with self._sessions() as session:
            rows = list(
                await session.scalars(select(Alarm).where(*conditions).order_by(Alarm.raised_at, Alarm.alarm_id))
            )
        return [
            EventResponse(
                event_id=row.alarm_id,
                asset_id=row.asset_id,
                code=row.code,
                severity=row.severity,
                state=row.state,
                message=row.message,
                raised_at=_utc(row.raised_at),
                cleared_at=_utc(row.cleared_at) if row.cleared_at is not None else None,
            )
            for row in rows
        ]

    @staticmethod
    def _inverter_response(reading: InverterReading) -> InverterResponse:
        return InverterResponse(
            asset_id=reading.inverter_id,
            ac_power_kw=float(reading.ac_power_kw),
            dc_power_kw=float(reading.dc_power_kw),
            temperature_c=float(reading.temperature_c),
            efficiency_percent=float(reading.efficiency_percent),
            communication_state=reading.communication_state,
            alarm_count=0,
            observed_at=_utc(reading.occurred_at),
        )


class WorkOrderService:
    """The only workspace write path; it delegates to Task 2's guarded transition."""

    def __init__(self, repository: V2GRepository) -> None:
        self._repository = repository

    async def transition(
        self,
        work_order_id: str,
        state: WorkOrderState,
        *,
        actor: str,
        reason: str,
    ) -> WorkOrderResponse:
        orders = await self._repository.list_work_orders(DEMO_SITE_ID)
        matching_order = next((order for order in orders if order.work_order_id == work_order_id), None)
        if matching_order is None:
            raise WorkspaceNotFound("simulator work order was not found")
        if matching_order.source != "simulated":
            raise ValueError("work-order transitions are restricted to simulator rows")
        order = await self._repository.transition_work_order_state(
            work_order_id,
            DEMO_SITE_ID,
            state,
            actor=actor,
            reason=reason,
        )
        return _work_order_response(order)


def _work_order_response(order: WorkOrder) -> WorkOrderResponse:
    return WorkOrderResponse(
        work_order_id=order.work_order_id,
        site_id=order.site_id,
        asset_id=order.asset_id,
        source_alarm_code=order.source_alarm_code,
        state=order.state,
        severity=order.severity,
        assigned_team=order.assigned_team,
        summary=order.summary,
        created_at=_utc(order.created_at),
    )
