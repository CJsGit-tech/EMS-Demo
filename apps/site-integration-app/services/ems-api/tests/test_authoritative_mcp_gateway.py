import asyncio
from types import SimpleNamespace

from agentcrew.contracts import ActiveSiteContext
import agentcrew.mcp as mcp_module
from agentcrew.mcp import AuthoritativeMcpGateway, build_mcp_gateway
from agentcrew.runtime import AuditEvent, ToolRequest


CONTEXT = ActiveSiteContext("site-001", "Verde North", "demo-user", "site/site-001/overview")


class TransientAdapter:
    def __init__(self):
        self.calls = 0

    async def call(self, tool_key, principal, site_code, arguments):
        self.calls += 1
        if self.calls < 3:
            raise RuntimeError("upstream temporarily unavailable")
        assert tool_key == "query_energy_timeseries"
        assert principal.user_id == "demo-user"
        assert site_code == "site-001"
        assert arguments["site_id"] == "site-001"
        return {
            "site_id": site_code,
            "tool_key": tool_key,
            "outcome": "ok",
            "records": [{"site_id": site_code, "metric": "energy_kwh", "value": 812}],
            "sources": [{"tool": tool_key, "reference": "ems://site-001/query_energy_timeseries"}],
        }


class PrincipalFactory:
    def principal(self, user_id):
        return type("Principal", (), {"user_id": user_id})()


def test_authoritative_gateway_retries_a_canonical_site_scoped_tool_and_preserves_provenance():
    events = []
    attempts = []
    adapter = TransientAdapter()
    gateway = AuthoritativeMcpGateway(
        events.append,
        adapter=adapter,
        authorization=PrincipalFactory(),
        approved=lambda session_id, tool_key: True,
        persist_attempt=lambda request, result: attempts.append((request.attempt, result.outcome)),
    )

    result = gateway.call(ToolRequest(
        "run-1", "session-1", CONTEXT, "query_energy_timeseries", {"site_id": "site-001"}
    ))

    assert adapter.calls == 3
    assert result.outcome == "success"
    assert result.retry_count == 2
    assert result.sources[0].reference == "ems://site-001/query_energy_timeseries"
    assert attempts == [(1, "transient_failure"), (2, "transient_failure"), (3, "success")]
    assert len([event for event in events if event.event_type == "mcp_tool_attempted"]) == 3


def test_authoritative_gateway_rejects_fixture_only_tool_names_before_an_external_call():
    gateway = AuthoritativeMcpGateway(
        lambda event: None,
        adapter=TransientAdapter(),
        authorization=PrincipalFactory(),
        approved=lambda session_id, tool_key: True,
    )

    try:
        gateway.call(ToolRequest("run-1", "session-1", CONTEXT, "energy_timeseries", {"site_id": "site-001"}))
    except Exception as error:
        assert "allowlisted" in str(error)
    else:  # pragma: no cover - makes the intended fail-closed contract explicit
        raise AssertionError("fixture-only tool name unexpectedly reached the authoritative gateway")


def test_database_mode_selects_the_authoritative_gateway(monkeypatch):
    adapter = TransientAdapter()
    service = SimpleNamespace(authorization=PrincipalFactory())
    monkeypatch.setattr(mcp_module, "settings", SimpleNamespace(mcp_gateway_mode="database", persistence_mode="postgres"))
    monkeypatch.setattr("ems.mcp_adapter.EmsMcpAdapter", lambda _service: adapter)
    monkeypatch.setattr("ems.router.ems_service", service)

    gateway = build_mcp_gateway(lambda _event: None, lambda _session, _tool: True, lambda _request, _result: None)

    assert isinstance(gateway, AuthoritativeMcpGateway)
    assert gateway.adapter is adapter


def test_database_mode_fails_closed_without_a_postgres_repository(monkeypatch):
    monkeypatch.setattr(mcp_module, "settings", SimpleNamespace(mcp_gateway_mode="database", persistence_mode="memory"))

    gateway = build_mcp_gateway(lambda _event: None, lambda _session, _tool: True, lambda _request, _result: None)
    result = gateway.call(ToolRequest("run-1", "session-1", CONTEXT, "query_energy_timeseries", {"site_id": "site-001"}))

    assert isinstance(gateway, AuthoritativeMcpGateway)
    assert result.outcome == "missing_source"
    assert result.error["code"] == "authoritative_repository_unavailable"


def test_audit_event_uses_a_construction_time_utc_timestamp():
    event = AuditEvent("test", "run-1", "site-001", "demo-user", "session-1")

    assert event.occurred_at.endswith("Z")
    assert event.occurred_at != "2026-07-22T12:00:00Z"
