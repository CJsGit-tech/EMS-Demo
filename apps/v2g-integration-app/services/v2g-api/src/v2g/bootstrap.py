"""Deterministic local-container bootstrap for the simulator database."""

from __future__ import annotations

import asyncio
import os

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from v2g.seed import seed_demo_fleet


async def seed_database(database_url: str) -> None:
    """Seed the migrated database once; ``seed_demo_fleet`` is idempotent."""
    engine = create_async_engine(database_url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with sessions() as session:
            await seed_demo_fleet(session)
    finally:
        await engine.dispose()


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to seed the V2G simulator")
    asyncio.run(seed_database(database_url))


if __name__ == "__main__":
    main()
