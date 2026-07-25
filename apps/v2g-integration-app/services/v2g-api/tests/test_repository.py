import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from v2g.models import Base
from v2g.repository import V2GRepository


@pytest.fixture
def repository():
    repository = V2GRepository.in_memory()
    asyncio.run(repository.create_schema())
    try:
        yield repository
    finally:
        asyncio.run(repository.dispose())


def test_command_audit_is_append_only(repository):
    async def append_and_read():
        first_event = await repository.append_audit(
            "cmd-1", "command.requested", {"actor": "operator"}
        )
        second_event = await repository.append_audit(
            "cmd-1", "command.approved", {"actor": "operator"}
        )
        return first_event, second_event, await repository.audit_events("cmd-1")

    first_event, second_event, events = asyncio.run(append_and_read())

    assert isinstance(repository._engine, AsyncEngine)
    assert [first_event.sequence, second_event.sequence] == [1, 2]
    assert events == [first_event, second_event]


def test_create_schema_rejects_non_test_database():
    async def create_schema():
        repository = V2GRepository(
            create_async_engine("postgresql+asyncpg://user:password@localhost/v2g")
        )
        try:
            with pytest.raises(RuntimeError, match="SQLite test database"):
                await repository.create_schema()
        finally:
            await repository.dispose()

    asyncio.run(create_schema())


def test_historian_models_expose_required_query_indexes():
    indexes = {index.name for table in Base.metadata.tables.values() for index in table.indexes}

    assert {
        "ix_telemetry_points_asset_occurred_at",
        "ix_telemetry_points_site_occurred_at",
        "ix_alarms_state_severity",
        "ix_dispatch_recommendations_asset_created_at",
        "ix_simulated_commands_state_expires_at",
    } <= indexes
