"""PostgreSQL-only proof for append-only command audit records.

This suite intentionally refuses every database except the local disposable
``v2g_test`` database named by ``V2G_TEST_DATABASE_URL``.  SQLite is covered by
the portable repository tests and cannot prove PostgreSQL trigger behavior or
advisory-lock concurrency.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from collections.abc import Awaitable, Callable
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url
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


async def _reset_schema(database_url: str) -> None:
    """Remove all objects from the disposable PostgreSQL schema."""
    engine = create_async_engine(database_url, pool_size=8, max_overflow=0)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await connection.execute(text("CREATE SCHEMA public"))
    finally:
        await engine.dispose()


def _upgrade_to_head(database_url: str) -> None:
    """Execute the production Alembic CLI using the application's async URL."""
    environment = os.environ.copy()
    environment["DATABASE_URL"] = database_url
    result = subprocess.run(
        [str(Path(sys.executable).with_name("alembic")), "upgrade", "head"],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


async def _assert_in_disposable_postgres(
    database_url: str, assertion: Callable[[AsyncEngine], Awaitable[None]]
) -> None:
    engine = create_async_engine(database_url, pool_size=8, max_overflow=0)
    try:
        await assertion(engine)
    finally:
        await engine.dispose()


def _in_disposable_postgres(
    database_url: str, assertion: Callable[[AsyncEngine], Awaitable[None]]
) -> None:
    try:
        asyncio.run(_reset_schema(database_url))
        _upgrade_to_head(database_url)
        asyncio.run(_assert_in_disposable_postgres(database_url, assertion))
    finally:
        asyncio.run(_reset_schema(database_url))


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

    _in_disposable_postgres(postgres_test_url, assertion)


def test_audit_events_receive_ordered_sequences(postgres_test_url: str) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        repository = V2GRepository(engine)
        await repository.append_audit("cmd-sequenced", "command.requested", {"actor": "test"})
        await repository.append_audit("cmd-sequenced", "command.approved", {"actor": "test"})

        assert [event.sequence for event in await repository.audit_events("cmd-sequenced")] == [1, 2]

    _in_disposable_postgres(postgres_test_url, assertion)


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

    _in_disposable_postgres(postgres_test_url, assertion)
