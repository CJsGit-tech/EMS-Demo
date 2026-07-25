import asyncio

import pytest

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
        event = await repository.append_audit(
            "cmd-1", "command.requested", {"actor": "operator"}
        )
        return event, await repository.audit_events("cmd-1")

    event, events = asyncio.run(append_and_read())

    assert event.sequence == 1
    assert events == [event]


def test_historian_models_expose_required_query_indexes():
    indexes = {index.name for table in Base.metadata.tables.values() for index in table.indexes}

    assert {
        "ix_telemetry_points_asset_occurred_at",
        "ix_telemetry_points_site_occurred_at",
        "ix_alarms_state_severity",
        "ix_dispatch_recommendations_asset_created_at",
        "ix_simulated_commands_state_expires_at",
    } <= indexes
