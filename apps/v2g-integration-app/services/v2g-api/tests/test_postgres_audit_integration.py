"""PostgreSQL-only proof for append-only command audit records.

This suite intentionally refuses every database except the local disposable
``v2g_test`` database named by ``V2G_TEST_DATABASE_URL``.  SQLite is covered by
the portable repository tests and cannot prove PostgreSQL trigger behavior or
advisory-lock concurrency.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import pytest
from alembic.config import Config
from alembic.runtime.environment import EnvironmentContext
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from v2g.repository import V2GRepository


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LOCAL_TEST_HOSTS = {"127.0.0.1", "localhost", "::1"}


@pytest.fixture(scope="module")
def postgres_test_url() -> str:
    """Return only the explicitly configured disposable PostgreSQL URL."""
    database_url = os.getenv("V2G_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("V2G_TEST_DATABASE_URL is required for PostgreSQL audit integration tests")

    url = make_url(database_url)
    if url.drivername != "postgresql+asyncpg":
        pytest.fail("V2G_TEST_DATABASE_URL must use the postgresql+asyncpg driver")
    if url.host not in LOCAL_TEST_HOSTS or url.database != "v2g_test":
        pytest.fail(
            "refusing to run against a non-disposable database; "
            "use local v2g_test only"
        )
    return database_url


def _upgrade_to_head(connection: Connection) -> None:
    """Run Alembic's real revision graph against an async connection's sync bridge."""
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    script = ScriptDirectory.from_config(config)

    def upgrade(revision: str | None, _context: Any) -> list[Any]:
        return script._upgrade_revs("head", revision)

    with EnvironmentContext(config, script, fn=upgrade, destination_rev="head") as environment:
        environment.configure(connection=connection)
        with environment.begin_transaction():
            environment.run_migrations()


async def _reset_and_upgrade(engine: AsyncEngine) -> None:
    """Remove all disposable schema objects, then apply the Alembic head revision."""
    async with engine.begin() as connection:
        await connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await connection.execute(text("CREATE SCHEMA public"))

    async with engine.begin() as connection:
        await connection.run_sync(_upgrade_to_head)


async def _clean_disposable_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await connection.execute(text("CREATE SCHEMA public"))


async def _in_disposable_postgres(
    database_url: str, assertion: Callable[[AsyncEngine], Awaitable[None]]
) -> None:
    engine = create_async_engine(database_url, pool_size=8, max_overflow=0)
    try:
        await _reset_and_upgrade(engine)
        await assertion(engine)
    finally:
        await _clean_disposable_schema(engine)
        await engine.dispose()


def test_audit_records_reject_update_delete_and_truncate(postgres_test_url: str) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        repository = V2GRepository(engine)
        await repository.append_audit("cmd-immutable", "command.requested", {"actor": "test"})

        for statement in (
            "UPDATE audit_records SET event_type = 'tampered' WHERE command_id = 'cmd-immutable'",
            "DELETE FROM audit_records WHERE command_id = 'cmd-immutable'",
            "TRUNCATE audit_records",
        ):
            with pytest.raises(DBAPIError, match="audit_records are append-only"):
                async with engine.begin() as connection:
                    await connection.execute(text(statement))

    asyncio.run(_in_disposable_postgres(postgres_test_url, assertion))


def test_audit_events_receive_ordered_sequences(postgres_test_url: str) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        repository = V2GRepository(engine)
        await repository.append_audit("cmd-sequenced", "command.requested", {"actor": "test"})
        await repository.append_audit("cmd-sequenced", "command.approved", {"actor": "test"})

        assert [event.sequence for event in await repository.audit_events("cmd-sequenced")] == [1, 2]

    asyncio.run(_in_disposable_postgres(postgres_test_url, assertion))


def test_concurrent_same_command_audit_appends_are_unique_and_ordered(
    postgres_test_url: str,
) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        repository = V2GRepository(engine)
        append_count = 8

        await asyncio.gather(
            *(
                repository.append_audit(
                    "cmd-concurrent", "command.requested", {"request": request_number}
                )
                for request_number in range(append_count)
            )
        )

        sequences = [event.sequence for event in await repository.audit_events("cmd-concurrent")]
        assert sequences == list(range(1, append_count + 1))
        assert len(sequences) == len(set(sequences))

    asyncio.run(_in_disposable_postgres(postgres_test_url, assertion))
