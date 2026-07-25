import asyncio

import pytest
from sqlalchemy import text

from v2g.repository import V2GRepository
from v2g.seed import seed_demo_fleet


@pytest.fixture
def seed_repository():
    repository = V2GRepository.in_memory()
    asyncio.run(repository.create_schema())
    try:
        yield repository
    finally:
        asyncio.run(repository.dispose())


def test_seed_contains_five_evses(seed_repository):
    async def seed_and_count():
        async with seed_repository._sessions() as session:
            await seed_demo_fleet(session)
        return await seed_repository.count_evses("demo-v2g-site")

    assert asyncio.run(seed_and_count()) == 5


def test_seed_persists_evse_rows_before_foreign_key_dependents(seed_repository):
    async def seed_with_foreign_keys_enforced():
        async with seed_repository._engine.begin() as connection:
            await connection.execute(text("PRAGMA foreign_keys = ON"))
        async with seed_repository._sessions() as session:
            await seed_demo_fleet(session)
        return await seed_repository.count_evses("demo-v2g-site")

    assert asyncio.run(seed_with_foreign_keys_enforced()) == 5
