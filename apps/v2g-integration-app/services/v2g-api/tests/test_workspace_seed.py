import asyncio

import pytest
from sqlalchemy import func, select

from v2g.models import InverterReading, StringReading, WorkOrderEvent
from v2g.repository import V2GRepository
from v2g.seed import seed_demo_fleet


@pytest.fixture
def repository():
    repository = V2GRepository.in_memory()
    asyncio.run(repository.create_schema())
    try:
        yield repository
    finally:
        asyncio.run(repository.dispose())


def test_seed_creates_simulated_analysis_and_work_order_rows(repository):
    async def seed_and_list():
        async with repository._sessions() as session:
            await seed_demo_fleet(session)
        return (
            await repository.count_inverter_readings("demo-v2g-site"),
            await repository.count_string_readings("demo-v2g-site"),
            await repository.list_work_orders("demo-v2g-site"),
        )

    inverter_count, string_count, orders = asyncio.run(seed_and_list())

    assert inverter_count == 5
    assert string_count == 40
    assert [order.state for order in orders] == ["open", "in_progress", "completed"]
    assert {order.source for order in orders} == {"simulated"}


def test_seeded_work_order_events_are_simulated_and_appendable(repository):
    async def seed_and_append():
        async with repository._sessions() as session:
            await seed_demo_fleet(session)
            seeded_event_count = await session.scalar(select(func.count()).select_from(WorkOrderEvent))
            seeded_events = list(await session.scalars(select(WorkOrderEvent)))
            inverter_sources = list(await session.scalars(select(InverterReading.source)))
            string_sources = list(await session.scalars(select(StringReading.source)))
        event = await repository.append_work_order_event(
            "wo-001", "work_order.note_added", {"source": "simulated"}
        )
        return seeded_event_count, seeded_events, inverter_sources, string_sources, event

    seeded_event_count, seeded_events, inverter_sources, string_sources, event = asyncio.run(seed_and_append())

    assert seeded_event_count == 3
    assert set(inverter_sources) == {"simulated"}
    assert set(string_sources) == {"simulated"}
    state_events = [item for item in seeded_events if item.event_type == "work_order.state_changed"]
    assert len(state_events) == 2
    assert all(item.actor and item.reason for item in state_events)
    assert all(item.payload["source"] == "simulated" for item in state_events)
    assert event.work_order_id == "wo-001"
    assert event.event_type == "work_order.note_added"
