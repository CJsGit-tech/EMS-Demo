"""Repository boundary for V2G historian data and command audit events."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from v2g.models import AuditRecord, Base, Evse, InverterReading, StringReading, WorkOrder, WorkOrderEvent
from v2g.simulator import DEMO_SITE_ID


class V2GRepository:
    """The API's sole persistence writer for simulator data."""

    SQLITE_TEST_URL = "sqlite+aiosqlite:///:memory:"
    WORK_ORDER_STATE_EVENT = "work_order.state_changed"
    WORK_ORDER_TRANSITIONS = {"open": {"in_progress"}, "in_progress": {"completed", "open"}}

    def __init__(self, engine: AsyncEngine):
        self._engine = engine
        self._sessions = async_sessionmaker(bind=engine, expire_on_commit=False)

    @classmethod
    def in_memory(cls) -> "V2GRepository":
        return cls(
            create_async_engine(
                cls.SQLITE_TEST_URL,
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
        )

    async def create_schema(self) -> None:
        """Create schema only for the explicit in-memory SQLite test database."""
        if self._engine.url.render_as_string(hide_password=False) != self.SQLITE_TEST_URL:
            raise RuntimeError("create_schema() is restricted to the SQLite test database")

        async with self._engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def dispose(self) -> None:
        await self._engine.dispose()

    async def count_evses(self, site_id: str) -> int:
        """Return the number of simulator EVSEs provisioned for a site."""
        async with self._sessions() as session:
            count = await session.scalar(
                select(func.count()).select_from(Evse).where(Evse.site_id == site_id)
            )
        return int(count or 0)

    async def count_inverter_readings(self, site_id: str) -> int:
        async with self._sessions() as session:
            count = await session.scalar(
                select(func.count()).select_from(InverterReading).where(InverterReading.site_id == site_id)
            )
        return int(count or 0)

    async def count_string_readings(self, site_id: str) -> int:
        async with self._sessions() as session:
            count = await session.scalar(
                select(func.count()).select_from(StringReading).where(StringReading.site_id == site_id)
            )
        return int(count or 0)

    async def list_work_orders(self, site_id: str) -> list[WorkOrder]:
        async with self._sessions() as session:
            return list(
                await session.scalars(
                    select(WorkOrder)
                    .where(WorkOrder.site_id == site_id)
                    .order_by(WorkOrder.created_at, WorkOrder.work_order_id)
                )
            )

    async def append_work_order_event(
        self,
        work_order_id: str,
        event_type: str,
        payload: dict[str, Any],
        *,
        actor: str | None = None,
        reason: str | None = None,
    ) -> WorkOrderEvent:
        """Append a work-order history event without exposing mutation operations."""
        actor = self._required_text(actor, "actor") if actor is not None else None
        reason = self._required_text(reason, "reason") if reason is not None else None
        if event_type == self.WORK_ORDER_STATE_EVENT and (actor is None or reason is None):
            raise ValueError("work-order state events require actor and reason")
        if event_type == self.WORK_ORDER_STATE_EVENT:
            raise ValueError("work-order state events must use the controlled transition boundary")
        async with self._sessions.begin() as session:
            if self._engine.dialect.name == "postgresql":
                event_id = await session.scalar(
                    text(
                        "SELECT append_demo_work_order_event("
                        "CAST(:work_order_id AS VARCHAR), "
                        "CAST(:event_type AS VARCHAR), "
                        "CAST(:payload AS JSONB), "
                        "CAST(:actor AS VARCHAR), "
                        "CAST(:reason AS TEXT))"
                    ),
                    {
                        "work_order_id": work_order_id,
                        "event_type": event_type,
                        "payload": json.dumps(payload),
                        "actor": actor,
                        "reason": reason,
                    },
                )
                event = await session.get(WorkOrderEvent, event_id)
                if event is None:
                    raise RuntimeError("controlled work-order event append did not return an event")
                return event

            await self._demo_work_order(session, work_order_id)
            event = WorkOrderEvent(
                work_order_id=work_order_id,
                event_type=event_type,
                actor=actor,
                reason=reason,
                payload=payload,
            )
            session.add(event)
            await session.flush()
            return event

    async def transition_work_order_state(
        self,
        work_order_id: str,
        site_id: str,
        state: str,
        *,
        actor: str,
        reason: str,
    ) -> WorkOrder:
        """Atomically transition one site-scoped work order with an immutable event."""
        actor = self._required_text(actor, "actor")
        reason = self._required_text(reason, "reason")
        if site_id != DEMO_SITE_ID:
            raise ValueError(f"work-order transitions are restricted to {DEMO_SITE_ID}")
        if self._engine.dialect.name == "postgresql":
            async with self._sessions.begin() as session:
                await session.execute(
                    text(
                        "SELECT transition_work_order_state("
                        ":work_order_id, :site_id, :state, :actor, :reason)"
                    ),
                    {
                        "work_order_id": work_order_id,
                        "site_id": site_id,
                        "state": state,
                        "actor": actor,
                        "reason": reason,
                    },
                )
                order = await session.get(WorkOrder, work_order_id)
                if order is None:
                    raise RuntimeError("work-order transition did not return a record")
                return order

        async with self._sessions.begin() as session:
            order = await session.scalar(
                select(WorkOrder)
                .where(WorkOrder.work_order_id == work_order_id, WorkOrder.site_id == site_id)
                .with_for_update()
            )
            if order is None:
                raise ValueError("work order does not belong to the expected site")
            await self._validate_work_order_asset_site(session, order)
            if state not in self.WORK_ORDER_TRANSITIONS.get(order.state, set()):
                raise ValueError(f"state transition from {order.state!r} to {state!r} is not permitted")

            previous_state = order.state
            order.state = state
            event = WorkOrderEvent(
                work_order_id=order.work_order_id,
                event_type=self.WORK_ORDER_STATE_EVENT,
                actor=actor,
                reason=reason,
                payload={
                    "source": "simulated-runtime",
                    "from_state": previous_state,
                    "to_state": state,
                    "actor": actor,
                    "reason": reason,
                },
            )
            session.add(event)
            await session.flush()
            return order

    async def append_audit(
        self, command_id: str, event_type: str, payload: dict[str, Any]
    ) -> AuditRecord:
        """Append an immutable command event with a transaction-local sequence."""
        async with self._sessions.begin() as session:
            await self._lock_audit_stream(session, command_id)
            sequence = await session.scalar(
                select(func.coalesce(func.max(AuditRecord.sequence), 0) + 1).where(
                    AuditRecord.command_id == command_id
                )
            )
            record = AuditRecord(
                command_id=command_id,
                sequence=sequence,
                event_type=event_type,
                payload=payload,
            )
            session.add(record)
            await session.flush()
            return record

    async def audit_events(self, command_id: str) -> list[AuditRecord]:
        async with self._sessions() as session:
            return list(
                (
                    await session.scalars(
                    select(AuditRecord)
                    .where(AuditRecord.command_id == command_id)
                    .order_by(AuditRecord.sequence)
                    )
                )
            )

    async def _lock_audit_stream(self, session: AsyncSession, command_id: str) -> None:
        if self._engine.dialect.name == "postgresql":
            await session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:command_id))"),
                {"command_id": command_id},
            )

    @staticmethod
    def _required_text(value: str | None, field: str) -> str:
        if not isinstance(value, str) or not (normalized := value.strip()):
            raise ValueError(f"{field} is required")
        return normalized

    @staticmethod
    async def _validate_work_order_asset_site(session: AsyncSession, order: WorkOrder) -> None:
        if order.asset_id is None:
            return
        asset_site_id = await session.scalar(
            select(Evse.site_id).where(Evse.asset_id == order.asset_id)
        )
        if asset_site_id != order.site_id:
            raise ValueError("work order asset does not belong to the expected site")

    @staticmethod
    async def _demo_work_order(session: AsyncSession, work_order_id: str) -> WorkOrder:
        order = await session.get(WorkOrder, work_order_id)
        if order is None or order.site_id != DEMO_SITE_ID:
            raise ValueError(f"work-order events are restricted to {DEMO_SITE_ID}")
        return order
