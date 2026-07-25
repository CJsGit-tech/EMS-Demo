"""Deterministic local-container bootstrap for the simulator database."""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import text
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


async def grant_runtime_access(database_url: str) -> None:
    """Grant the API role only the privileges needed by the simulator.

    This runs after every owner-led migration so grants remain correct for a
    reused local volume as well as a new database. Immutable event tables stay
    append/read-only, while work-order state changes are allowed only through
    the owner-defined transition function so future services cannot bypass its
    site, state, and attribution checks with direct ``UPDATE`` access.
    """
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            for statement in (
                "REVOKE ALL ON SCHEMA public FROM v2g_runtime",
                "GRANT USAGE ON SCHEMA public TO v2g_runtime",
                "GRANT CONNECT ON DATABASE v2g_simulator TO v2g_runtime",
                "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO v2g_runtime",
                "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO v2g_runtime",
                "REVOKE ALL ON TABLE audit_records, work_order_events, work_orders FROM v2g_runtime",
                "REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_records, work_order_events, work_orders FROM v2g_runtime",
                "GRANT SELECT, INSERT ON TABLE audit_records, work_order_events TO v2g_runtime",
                "GRANT SELECT ON TABLE work_orders TO v2g_runtime",
                "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO v2g_runtime",
                "GRANT EXECUTE ON FUNCTION transition_work_order_state(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT) TO v2g_runtime",
                "ALTER DEFAULT PRIVILEGES FOR ROLE v2g_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO v2g_runtime",
                "ALTER DEFAULT PRIVILEGES FOR ROLE v2g_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO v2g_runtime",
            ):
                await connection.execute(text(statement))
    finally:
        await engine.dispose()


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required to seed the V2G simulator")
    async def bootstrap_database() -> None:
        await seed_database(database_url)
        await grant_runtime_access(database_url)

    asyncio.run(bootstrap_database())


if __name__ == "__main__":
    main()
