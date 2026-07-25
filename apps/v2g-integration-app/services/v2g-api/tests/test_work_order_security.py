import asyncio

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from v2g.models import StringReading, WorkOrder, WorkOrderEvent
from v2g.repository import V2GRepository
from v2g.seed import DEMO_SEED_AT, seed_demo_fleet
from v2g.simulator import DEMO_SITE_ID


@pytest.fixture
def repository():
    repository = V2GRepository.in_memory()
    asyncio.run(repository.create_schema())
    try:
        yield repository
    finally:
        asyncio.run(repository.dispose())


def test_transition_updates_the_expected_site_and_appends_attributed_event(repository):
    async def transition():
        async with repository._sessions() as session:
            await seed_demo_fleet(session)

        order = await repository.transition_work_order_state(
            "wo-001",
            DEMO_SITE_ID,
            "in_progress",
            actor="operator-17",
            reason="現場確認後開始檢修",
        )

        async with repository._sessions() as session:
            events = list(
                await session.scalars(
                    select(WorkOrderEvent)
                    .where(WorkOrderEvent.work_order_id == "wo-001")
                    .order_by(WorkOrderEvent.work_order_event_id)
                )
            )
        return order, events

    order, events = asyncio.run(transition())

    assert order.state == "in_progress"
    assert events[-1].event_type == "work_order.state_changed"
    assert events[-1].actor == "operator-17"
    assert events[-1].reason == "現場確認後開始檢修"
    assert events[-1].payload["from_state"] == "open"
    assert events[-1].payload["to_state"] == "in_progress"


def test_transition_rejects_missing_attribution_and_wrong_site(repository):
    async def invalid_transitions():
        async with repository._sessions() as session:
            await seed_demo_fleet(session)

        with pytest.raises(ValueError, match="actor"):
            await repository.transition_work_order_state(
                "wo-001", DEMO_SITE_ID, "in_progress", actor=" ", reason="開始檢修"
            )
        with pytest.raises(ValueError, match="site"):
            await repository.transition_work_order_state(
                "wo-001", "other-site", "in_progress", actor="operator-17", reason="開始檢修"
            )
        with pytest.raises(ValueError, match="actor and reason"):
            await repository.append_work_order_event(
                "wo-001", "work_order.state_changed", {"to_state": "in_progress"}
            )

    asyncio.run(invalid_transitions())


def test_site_aware_foreign_keys_reject_cross_site_string_and_work_order_rows(repository):
    async def reject_cross_site_rows():
        async with repository._engine.begin() as connection:
            await connection.execute(text("PRAGMA foreign_keys = ON"))
        async with repository._sessions() as session:
            await seed_demo_fleet(session)

        async with repository._sessions() as session:
            session.add(
                StringReading(
                    inverter_id="inv-01",
                    site_id="other-site",
                    string_id="inv-01-cross-site",
                    dc_power_kw=1.0,
                    source="simulated",
                    occurred_at=DEMO_SEED_AT,
                )
            )
            with pytest.raises(IntegrityError):
                await session.flush()
            await session.rollback()

        async with repository._sessions() as session:
            session.add(
                WorkOrder(
                    work_order_id="wo-cross-site",
                    site_id="other-site",
                    asset_id="evse-01",
                    source_alarm_code=None,
                    state="open",
                    severity="low",
                    assigned_team="維運一組",
                    summary="Cross-site row must be rejected",
                    created_at=DEMO_SEED_AT,
                )
            )
            with pytest.raises(IntegrityError):
                await session.flush()
            await session.rollback()

    asyncio.run(reject_cross_site_rows())
