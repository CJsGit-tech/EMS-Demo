import asyncio
import os
from uuid import uuid4

import pytest
from sqlalchemy import delete, select


def test_required_persistence_mode_surfaces_an_unavailable_database():
    from agentcrew.errors import AgentCrewError, AgentCrewErrorCode
    from agentcrew.persistence import DurableRepository

    repository = DurableRepository()
    repository.enabled = True
    repository.available = False

    with pytest.raises(AgentCrewError) as error:
        repository.load_run("run-unavailable")

    assert error.value.code == AgentCrewErrorCode.PERSISTENCE_UNAVAILABLE


def test_failed_required_run_checkpoint_returns_terminal_failure_without_another_write():
    from agentcrew.contracts import ActiveSiteContext, AgentRunStatus
    from agentcrew.service import AgentCrewService

    class FailingCheckpointPersistence:
        enabled = True

        def __init__(self):
            self.calls: list[str] = []
            self.checkpoint_failed = False

        def save_session(self, *_args):
            self.calls.append("save_session")

        def save_message(self, *_args):
            self.calls.append("save_message")
            if self.checkpoint_failed:
                raise RuntimeError("all writes fail after the checkpoint failure")

        def save_mcp_attempt(self, *_args):
            self.calls.append("save_mcp_attempt")

        def load_memory_context(self, *_args):
            return None

        def save_run(self, *_args):
            self.calls.append("save_run")
            self.checkpoint_failed = True
            raise RuntimeError("required run checkpoint unavailable")

    persistence = FailingCheckpointPersistence()
    service = AgentCrewService(provider=False)
    service.persistence = persistence
    context = ActiveSiteContext("site-001", "Verde North", "demo-user", "site/site-001/overview")

    result = service.start(context, "Show device health", "checkpoint-failure")

    assert result["status"] == AgentRunStatus.FAILED.value
    assert result["result"] == {
        "code": "persistence_unavailable",
        "message": "The run could not be durably saved; no durable success was reported.",
    }
    assert persistence.calls == ["save_session", "save_message", "save_mcp_attempt", "save_run"]


@pytest.mark.skipif(os.getenv("EMS_LIVE_DB") != "1", reason="requires the isolated local PostgreSQL profile")
def test_report_draft_persists_in_public_agentcrew_schema():
    from agentcrew.contracts import ActiveSiteContext, ApprovalMode
    from agentcrew.db import async_engine, async_session_factory
    from agentcrew.db.models import ReportDraftRecord, ReportDraftRevisionRecord
    from agentcrew.service import AgentCrewService

    session_id = f"persistence-{uuid4().hex[:12]}"
    service = AgentCrewService(provider=False)
    context = ActiveSiteContext("site-001", "Verde North", "demo-user", "site/site-001/reports")
    waiting = service.start(context, "Create a site operations report draft", session_id)
    completed = service.approve(waiting["runId"], session_id, ApprovalMode.APPROVE_STEP)
    draft_id = completed["result"]["draft"]["draft_id"]
    confirmed = service.confirm_report(draft_id, context)

    async def read_and_cleanup():
        async with async_session_factory() as session:
            row = (await session.execute(select(ReportDraftRecord).where(ReportDraftRecord.id == draft_id))).scalar_one()
            revisions = (await session.execute(select(ReportDraftRevisionRecord).where(ReportDraftRevisionRecord.draft_id == draft_id).order_by(ReportDraftRevisionRecord.version))).scalars().all()
            result = (row.site_id, row.state, row.version, bool(row.html_sanitized), len(row.sources_json), [revision.state for revision in revisions])
            await session.execute(delete(ReportDraftRecord).where(ReportDraftRecord.id == draft_id))
            await session.execute(delete(ReportDraftRevisionRecord).where(ReportDraftRevisionRecord.draft_id == draft_id))
            await session.commit()
            return result

    persisted = asyncio.run(read_and_cleanup())
    asyncio.run(async_engine.dispose())
    assert service.persistence.available
    assert confirmed["state"] == "confirmed"
    assert confirmed["version"] == 2
    assert persisted == ("site-001", "confirmed", 2, True, 2, ["draft", "confirmed"])


@pytest.mark.skipif(os.getenv("EMS_LIVE_DB") != "1", reason="requires the isolated local PostgreSQL profile")
def test_report_revision_retention_keeps_latest_five_per_draft():
    from datetime import datetime, timezone

    from agentcrew.db import async_engine, async_session_factory
    from agentcrew.db.models import ReportDraftRecord, ReportDraftRevisionRecord
    from agentcrew.persistence import DurableRepository

    draft_id = f"retention-{uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    async def seed_revisions():
        async with async_session_factory() as session:
            session.add(ReportDraftRecord(
                id=draft_id,
                user_id="demo-user",
                site_id="site-001",
                run_id="run-retention",
                title="Retention test",
                html_sanitized="<p>safe</p>",
                sections_json=[],
                sources_json=[],
                version=7,
                state="confirmed",
                created_at=now,
                updated_at=now,
            ))
            for version in range(1, 8):
                session.add(ReportDraftRevisionRecord(
                    id=f"revision-{draft_id}-{version}",
                    user_id="demo-user",
                    site_id="site-001",
                    draft_id=draft_id,
                    run_id="run-retention",
                    title="Retention test",
                    html_sanitized="<p>safe</p>",
                    sections_json=[],
                    sources_json=[],
                    version=version,
                    state="confirmed" if version > 1 else "draft",
                    created_at=now,
                    updated_at=now,
                ))
            await session.commit()

    async def read_and_cleanup():
        from sqlalchemy import delete, select

        async with async_session_factory() as session:
            revisions = (await session.execute(select(ReportDraftRevisionRecord).where(ReportDraftRevisionRecord.draft_id == draft_id).order_by(ReportDraftRevisionRecord.version))).scalars().all()
            versions = [revision.version for revision in revisions]
            await session.execute(delete(ReportDraftRevisionRecord).where(ReportDraftRevisionRecord.draft_id == draft_id))
            await session.execute(delete(ReportDraftRecord).where(ReportDraftRecord.id == draft_id))
            await session.commit()
            return versions

    asyncio.run(seed_revisions())
    purged = DurableRepository().purge_report_revisions(site_id="site-001", keep_versions=5)
    versions = asyncio.run(read_and_cleanup())
    asyncio.run(async_engine.dispose())

    assert purged == 2
    assert versions == [3, 4, 5, 6, 7]
