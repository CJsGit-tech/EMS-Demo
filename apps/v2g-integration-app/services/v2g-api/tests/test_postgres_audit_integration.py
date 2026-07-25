"""PostgreSQL-only proof for immutable event and runtime-role boundaries.

This suite intentionally refuses every database except the local disposable
``v2g_test`` database named by ``V2G_TEST_DATABASE_URL``.  SQLite is covered by
the portable repository tests and cannot prove PostgreSQL trigger behavior or
advisory-lock concurrency.

The runtime-role test additionally requires ``V2G_RUNTIME_TEST_DATABASE_URL``
for the same local disposable database. Both URLs must be available from the
local Docker stack; otherwise the relevant tests skip explicitly.
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
LOCAL_TEST_HOSTS = {"127.0.0.1", "localhost", "::1", "postgres"}


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


@pytest.fixture(scope="module")
def postgres_runtime_test_url() -> str:
    """Return the separately configured runtime URL for role-privilege proof."""
    database_url = os.getenv("V2G_RUNTIME_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip(
            "V2G_RUNTIME_TEST_DATABASE_URL is required for PostgreSQL runtime-role integration tests"
        )

    url = make_url(database_url)
    if url.drivername != "postgresql+asyncpg":
        pytest.fail("V2G_RUNTIME_TEST_DATABASE_URL must use the postgresql+asyncpg driver")
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


def test_runtime_role_appends_audit_only_through_guarded_function(
    postgres_test_url: str, postgres_runtime_test_url: str
) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        async with engine.begin() as connection:
            privileges = (
                await connection.execute(
                    text(
                        "SELECT "
                        "has_table_privilege('v2g_runtime', 'audit_records', 'SELECT'), "
                        "has_table_privilege('v2g_runtime', 'audit_records', 'INSERT'), "
                        "COALESCE(has_function_privilege("
                        "'v2g_runtime', "
                        "to_regprocedure("
                        "'append_audit_record(character varying, character varying, jsonb)'"
                        "), 'EXECUTE'), FALSE)"
                    )
                )
            ).one()
            assert privileges == (True, False, True)

        runtime_engine = create_async_engine(postgres_runtime_test_url)
        try:
            async with runtime_engine.connect() as connection:
                with pytest.raises(DBAPIError, match="permission denied for table audit_records"):
                    await connection.execute(
                        text(
                            "INSERT INTO audit_records ("
                            "command_id, sequence, event_type, payload, occurred_at"
                            ") VALUES ("
                            "'cmd-runtime-guarded', 99, 'command.tampered', "
                            "'{\"actor\": \"runtime-test\"}'::jsonb, NOW())"
                        )
                    )
                await connection.rollback()

                for event_type in ("command.requested", "command.approved"):
                    await connection.execute(
                        text(
                            "SELECT append_audit_record("
                            "'cmd-runtime-guarded', CAST(:event_type AS VARCHAR), "
                            "'{\"actor\": \"runtime-test\"}'::jsonb)"
                        ),
                        {"event_type": event_type},
                    )
                await connection.commit()
        finally:
            await runtime_engine.dispose()

        async with engine.begin() as connection:
            events = (
                await connection.execute(
                    text(
                        "SELECT sequence, event_type FROM audit_records "
                        "WHERE command_id = 'cmd-runtime-guarded' ORDER BY sequence"
                    )
                )
            ).all()
            assert events == [
                (1, "command.requested"),
                (2, "command.approved"),
            ]

    _in_disposable_postgres(postgres_test_url, assertion)


def test_runtime_role_uses_only_controlled_work_order_transition_and_event_trigger(
    postgres_test_url: str, postgres_runtime_test_url: str
) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "INSERT INTO evses (asset_id, site_id, display_name, state, created_at) "
                    "VALUES ('evse-role-test', 'demo-v2g-site', 'Role test EVSE', 'available', NOW())"
                )
            )
            await connection.execute(
                text(
                    "INSERT INTO work_orders ("
                    "work_order_id, site_id, asset_id, state, severity, assigned_team, summary, source, created_at"
                    ") VALUES ("
                    "'wo-role-test', 'demo-v2g-site', 'evse-role-test', 'open', "
                    "'low', 'test-team', 'Role-boundary test', 'simulated', NOW())"
                )
            )
            privileges = (
                await connection.execute(
                    text(
                        "SELECT "
                        "has_table_privilege('v2g_runtime', 'work_orders', 'SELECT'), "
                        "has_table_privilege('v2g_runtime', 'work_orders', 'UPDATE'), "
                        "has_table_privilege('v2g_runtime', 'work_order_events', 'INSERT'), "
                        "has_table_privilege('v2g_runtime', 'work_order_events', 'UPDATE'), "
                        "has_function_privilege("
                        "'v2g_runtime', "
                        "'transition_work_order_state(character varying, character varying, character varying, character varying, text)', "
                        "'EXECUTE')"
                    )
                )
            ).one()
            assert privileges == (True, False, False, False, True)

        runtime_engine = create_async_engine(postgres_runtime_test_url)
        try:
            async with runtime_engine.begin() as connection:
                await connection.execute(
                    text(
                        "SELECT transition_work_order_state("
                        "'wo-role-test', 'demo-v2g-site', 'in_progress', 'runtime-test', 'controlled transition')"
                    )
                )

            async with runtime_engine.connect() as connection:
                with pytest.raises(DBAPIError):
                    await connection.execute(
                        text("UPDATE work_orders SET state = 'completed' WHERE work_order_id = 'wo-role-test'")
                    )
                await connection.rollback()
        finally:
            await runtime_engine.dispose()

        async with engine.begin() as connection:
            event = (
                await connection.execute(
                    text(
                        "SELECT event_type, actor, reason, payload->>'source' FROM work_order_events "
                        "WHERE work_order_id = 'wo-role-test'"
                    )
                )
            ).one()
            assert event == (
                "work_order.state_changed",
                "runtime-test",
                "controlled transition",
                "simulated-runtime",
            )
            with pytest.raises(DBAPIError, match="work_order_events are append-only"):
                await connection.execute(
                    text(
                        "UPDATE work_order_events SET actor = 'tampered' "
                        "WHERE work_order_id = 'wo-role-test'"
                    )
                )

    _in_disposable_postgres(postgres_test_url, assertion)


def test_runtime_transition_rejects_every_disallowed_pair_and_other_site_history(
    postgres_test_url: str, postgres_runtime_test_url: str
) -> None:
    async def assertion(engine: AsyncEngine) -> None:
        async with engine.begin() as connection:
            for work_order_id, site_id, state in (
                ("wo-pair-open", "demo-v2g-site", "open"),
                ("wo-pair-progress", "demo-v2g-site", "in_progress"),
                ("wo-pair-completed", "demo-v2g-site", "completed"),
                ("wo-other-site", "other-site", "open"),
            ):
                await connection.execute(
                    text(
                        "INSERT INTO work_orders ("
                        "work_order_id, site_id, state, severity, assigned_team, summary, source, created_at"
                        ") VALUES ("
                        ":work_order_id, :site_id, :state, 'low', 'test-team', "
                        "'Transition-pair test', 'simulated', NOW())"
                    ),
                    {"work_order_id": work_order_id, "site_id": site_id, "state": state},
                )
            # This emulates a future broad bootstrap grant: the trigger must still
            # block unscoped direct runtime event insertion.
            await connection.execute(text("GRANT INSERT ON TABLE work_order_events TO v2g_runtime"))

        runtime_engine = create_async_engine(postgres_runtime_test_url)
        try:
            async with runtime_engine.connect() as connection:
                for work_order_id, target_state in (
                    ("wo-pair-open", "open"),
                    ("wo-pair-open", "completed"),
                    ("wo-pair-progress", "in_progress"),
                    ("wo-pair-completed", "open"),
                    ("wo-pair-completed", "in_progress"),
                    ("wo-pair-completed", "completed"),
                ):
                    with pytest.raises(DBAPIError, match="not permitted"):
                        await connection.execute(
                            text(
                                "SELECT transition_work_order_state("
                                ":work_order_id, 'demo-v2g-site', :target_state, "
                                "'runtime-test', 'rejected pair')"
                            ),
                            {"work_order_id": work_order_id, "target_state": target_state},
                        )
                    await connection.rollback()

                with pytest.raises(DBAPIError, match="demo-v2g-site"):
                    await connection.execute(
                        text(
                            "SELECT transition_work_order_state("
                            "'wo-other-site', 'other-site', 'in_progress', "
                            "'runtime-test', 'cross-site transition')"
                        )
                    )
                await connection.rollback()

                with pytest.raises(DBAPIError, match="demo-v2g-site"):
                    await connection.execute(
                        text(
                            "SELECT append_demo_work_order_event("
                            "'wo-other-site', 'work_order.note_added', "
                            "'{\"source\": \"simulated-runtime\"}'::jsonb, NULL, NULL)"
                        )
                    )
                await connection.rollback()

                with pytest.raises(DBAPIError, match="controlled function"):
                    await connection.execute(
                        text(
                            "INSERT INTO work_order_events (work_order_id, event_type, payload) VALUES ("
                            "'wo-other-site', 'work_order.note_added', "
                            "'{\"source\": \"simulated-runtime\"}'::jsonb)"
                        )
                    )
                await connection.rollback()
        finally:
            await runtime_engine.dispose()

    _in_disposable_postgres(postgres_test_url, assertion)
