"""Persistent models for the simulator-only V2G SCADA API."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint
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
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="open")
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
