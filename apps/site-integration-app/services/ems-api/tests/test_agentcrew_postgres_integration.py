"""Database-backed Task 2 contracts, run against the local Docker PostgreSQL stack."""

import asyncio
import os
from uuid import uuid4

import pytest
from sqlalchemy import delete, select


@pytest.mark.skipif(os.getenv("EMS_INTEGRATION_DATABASE") != "1", reason="requires EMS_INTEGRATION_DATABASE=1 for the local Docker PostgreSQL stack")
def test_authoritative_mcp_attempts_and_runs_survive_a_service_restart():
    from agentcrew.contracts import ActiveSiteContext
    from agentcrew.db import async_session_factory
    from agentcrew.db.models import AgentRunRecord, AuditEventRecord, ChatMessage, ChatSession, McpAttemptRecord
    from agentcrew.mcp import AuthoritativeMcpGateway
    from agentcrew.runtime import ToolRequest
    from agentcrew.service import AgentCrewService

    suffix = uuid4().hex[:12]
    session_id = f"task2-session-{suffix}"
    run_id = f"task2-mcp-{suffix}"
    context = ActiveSiteContext("site-001", "Verde North", "demo-user", "site/site-001/overview")
    service = AgentCrewService(provider=False)
    assert isinstance(service.gateway, AuthoritativeMcpGateway)
    service.approvals.add((session_id, "get_metric_catalog"))

    result = service.call_tool(ToolRequest(run_id, session_id, context, "get_metric_catalog", {"site_id": "site-001"}))
    started = service.start(context, "Show device health", session_id)
    recovered = AgentCrewService(provider=False).snapshot(started["runId"], context, session_id)

    async def read_and_cleanup():
        async with async_session_factory() as db:
            attempt = (await db.execute(select(McpAttemptRecord).where(McpAttemptRecord.run_id == run_id))).scalar_one()
            audit_types = list((await db.execute(select(AuditEventRecord.event_type).where(AuditEventRecord.run_id == run_id))).scalars())
            await db.execute(delete(McpAttemptRecord).where(McpAttemptRecord.run_id.in_([run_id, started["runId"]])))
            await db.execute(delete(AuditEventRecord).where(AuditEventRecord.run_id.in_([run_id, started["runId"]])))
            await db.execute(delete(ChatMessage).where(ChatMessage.run_id == started["runId"]))
            await db.execute(delete(AgentRunRecord).where(AgentRunRecord.id == started["runId"]))
            await db.execute(delete(ChatSession).where(ChatSession.id == session_id))
            await db.commit()
            return attempt.outcome, audit_types

    outcome, audit_types = asyncio.run(read_and_cleanup())
    assert result.outcome == "success"
    assert outcome == "success"
    assert {"mcp_tool_requested", "mcp_tool_attempted", "mcp_tool_responded"}.issubset(audit_types)
    assert recovered["runId"] == started["runId"]
    assert recovered["siteContext"]["siteId"] == "site-001"
