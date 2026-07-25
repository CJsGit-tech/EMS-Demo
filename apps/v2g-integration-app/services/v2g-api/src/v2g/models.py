"""Persistent models for the simulator-only V2G SCADA API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


JsonDocument = JSON().with_variant(JSONB, "postgresql")


class Base(DeclarativeBase):
    pass


class Evse(Base):
    __tablename__ = "evses"
    __table_args__ = (UniqueConstraint("asset_id", "site_id", name="uq_evses_asset_site"),)

    asset_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    site_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="available")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"
    __table_args__ = (
        Index("ix_telemetry_points_asset_occurred_at", "asset_id", "occurred_at"),
        Index("ix_telemetry_points_site_occurred_at", "site_id", "occurred_at"),
    )

    telemetry_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[str] = mapped_column(
        ForeignKey("evses.asset_id", ondelete="RESTRICT"), nullable=False
    )
    site_id: Mapped[str] = mapped_column(String(128), nullable=False)
    metric: Mapped[str] = mapped_column(String(128), nullable=False)
    value: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    quality: Mapped[str] = mapped_column(String(32), nullable=False, default="good")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class ChargingSession(Base):
    __tablename__ = "charging_sessions"
    __table_args__ = (Index("ix_charging_sessions_asset_started_at", "asset_id", "started_at"),)

    session_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    asset_id: Mapped[str] = mapped_column(
        ForeignKey("evses.asset_id", ondelete="RESTRICT"), nullable=False
    )
    site_id: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    energy_imported_kwh: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)
    energy_exported_kwh: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False, default=0)


class Alarm(Base):
    __tablename__ = "alarms"
    __table_args__ = (
        Index("ix_alarms_state_severity", "state", "severity"),
        Index("ix_alarms_asset_raised_at", "asset_id", "raised_at"),
    )

    alarm_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("evses.asset_id", ondelete="RESTRICT"))
    site_id: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str] = mapped_column(String(128), nullable=False)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="open", server_default="open"
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    raised_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DispatchRecommendation(Base):
    __tablename__ = "dispatch_recommendations"
    __table_args__ = (
        Index("ix_dispatch_recommendations_site_expires_at", "site_id", "expires_at"),
        Index("ix_dispatch_recommendations_asset_created_at", "asset_id", "created_at"),
    )

    recommendation_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("evses.asset_id", ondelete="RESTRICT"))
    site_id: Mapped[str] = mapped_column(String(128), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="proposed")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JsonDocument, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class SimulatedCommand(Base):
    __tablename__ = "simulated_commands"
    __table_args__ = (
        Index("ix_simulated_commands_state_expires_at", "state", "expires_at"),
        Index("ix_simulated_commands_asset_created_at", "asset_id", "created_at"),
    )

    command_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    asset_id: Mapped[str] = mapped_column(
        ForeignKey("evses.asset_id", ondelete="RESTRICT"), nullable=False
    )
    site_id: Mapped[str] = mapped_column(String(128), nullable=False)
    command_type: Mapped[str] = mapped_column(String(64), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JsonDocument, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)


class AuditRecord(Base):
    __tablename__ = "audit_records"
    __table_args__ = (UniqueConstraint("command_id", "sequence", name="uq_audit_records_command_sequence"),)

    audit_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    command_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JsonDocument, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, AuditRecord):
            return NotImplemented
        return self.audit_id == other.audit_id


class InverterReading(Base):
    __tablename__ = "inverter_readings"
    __table_args__ = (
        UniqueConstraint("inverter_id", "site_id", name="uq_inverter_readings_inverter_site"),
        Index("ix_inverter_readings_site_occurred_at", "site_id", "occurred_at"),
    )

    inverter_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    site_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    ac_power_kw: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    dc_power_kw: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    temperature_c: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    efficiency_percent: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    communication_state: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="simulated", server_default="simulated"
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class StringReading(Base):
    __tablename__ = "string_readings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["inverter_id", "site_id"],
            ["inverter_readings.inverter_id", "inverter_readings.site_id"],
            name="fk_string_readings_inverter_site",
            ondelete="RESTRICT",
        ),
        Index("ix_string_readings_inverter_occurred_at", "inverter_id", "occurred_at"),
        Index("ix_string_readings_site_occurred_at", "site_id", "occurred_at"),
    )

    string_reading_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inverter_id: Mapped[str] = mapped_column(String(128), nullable=False)
    site_id: Mapped[str] = mapped_column(String(128), nullable=False)
    string_id: Mapped[str] = mapped_column(String(128), nullable=False)
    dc_power_kw: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="simulated", server_default="simulated"
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WorkOrder(Base):
    __tablename__ = "work_orders"
    __table_args__ = (
        ForeignKeyConstraint(
            ["asset_id", "site_id"],
            ["evses.asset_id", "evses.site_id"],
            name="fk_work_orders_asset_site",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "state IN ('open', 'in_progress', 'completed')", name="ck_work_orders_permitted_state"
        ),
        Index("ix_work_orders_site_created_at", "site_id", "created_at"),
        Index("ix_work_orders_asset_created_at", "asset_id", "created_at"),
    )

    work_order_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    site_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    asset_id: Mapped[str | None] = mapped_column(String(128))
    source_alarm_code: Mapped[str | None] = mapped_column(String(128))
    state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="open", server_default="open"
    )
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    assigned_team: Mapped[str] = mapped_column(String(128), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(
        String(32), nullable=False, default="simulated", server_default="simulated"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class WorkOrderEvent(Base):
    __tablename__ = "work_order_events"
    __table_args__ = (
        CheckConstraint(
            "event_type <> 'work_order.state_changed' OR "
            "(actor IS NOT NULL AND length(trim(actor)) > 0 AND "
            "reason IS NOT NULL AND length(trim(reason)) > 0)",
            name="ck_work_order_events_state_transition_attribution",
        ),
        Index("ix_work_order_events_work_order_occurred_at", "work_order_id", "occurred_at"),
    )

    work_order_event_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    work_order_id: Mapped[str] = mapped_column(
        ForeignKey("work_orders.work_order_id", ondelete="RESTRICT"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    actor: Mapped[str | None] = mapped_column(String(128))
    reason: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(JsonDocument, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("CURRENT_TIMESTAMP")
    )
