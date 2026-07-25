"""Repository boundary for V2G historian data and command audit events."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from v2g.models import AuditRecord, Base, Evse


class V2GRepository:
    """The API's sole persistence writer for simulator data."""

    SQLITE_TEST_URL = "sqlite+aiosqlite:///:memory:"

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
