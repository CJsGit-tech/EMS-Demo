"""Repository boundary for V2G historian data and command audit events."""

from __future__ import annotations

from typing import Any

from sqlalchemy import Engine, create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from v2g.models import AuditRecord, Base


class V2GRepository:
    """The API's sole persistence writer for simulator data."""

    def __init__(self, engine: Engine):
        self._engine = engine
        self._sessions = sessionmaker(bind=engine, expire_on_commit=False)

    @classmethod
    def in_memory(cls) -> "V2GRepository":
        return cls(
            create_engine(
                "sqlite+pysqlite:///:memory:",
                connect_args={"check_same_thread": False},
                poolclass=StaticPool,
            )
        )

    async def create_schema(self) -> None:
        Base.metadata.create_all(self._engine)

    async def dispose(self) -> None:
        self._engine.dispose()

    async def append_audit(
        self, command_id: str, event_type: str, payload: dict[str, Any]
    ) -> AuditRecord:
        """Append an immutable command event with a transaction-local sequence."""
        with self._sessions.begin() as session:
            self._lock_audit_stream(session, command_id)
            sequence = session.scalar(
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
            session.flush()
            return record

    async def audit_events(self, command_id: str) -> list[AuditRecord]:
        with self._sessions() as session:
            return list(
                session.scalars(
                    select(AuditRecord)
                    .where(AuditRecord.command_id == command_id)
                    .order_by(AuditRecord.sequence)
                )
            )

    def _lock_audit_stream(self, session: Session, command_id: str) -> None:
        if self._engine.dialect.name == "postgresql":
            session.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:command_id))"),
                {"command_id": command_id},
            )
