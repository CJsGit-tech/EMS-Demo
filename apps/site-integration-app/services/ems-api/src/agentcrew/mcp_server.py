"""Separate FastMCP process exposing typed, site-scoped tool operations."""

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from mcp.server.fastmcp import FastMCP

from .config import settings


mcp = FastMCP("Verde EMS AgentCrew MCP", host=settings.mcp_host, port=settings.mcp_port, streamable_http_path="/mcp")
_FIXTURE_MODES = {"fixture", "fixtures", "deterministic-fixtures"}


def _fixture_tool():
    """Register synthetic aliases only when fixtures were explicitly selected."""
    if settings.mcp_gateway_mode.lower() in _FIXTURE_MODES:
        return mcp.tool()
    return lambda function: function


def _api_call(path: str, payload: dict) -> dict:
    body = json.dumps(payload).encode()
    request = Request(
        f"{settings.internal_api_url.rstrip('/')}{path}",
        data=body,
        headers={"content-type": "application/json", "x-ems-service-token": settings.service_token},
        method="POST",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode())
            safe_detail = detail.get("detail", detail)
            code = safe_detail.get("code", "api_error") if isinstance(safe_detail, dict) else "api_error"
            raise RuntimeError(f"Authoritative EMS API rejected the request ({code}).") from exc
        except (json.JSONDecodeError, UnicodeDecodeError, AttributeError):
            raise RuntimeError("Authoritative EMS API rejected the request.") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Authoritative EMS API is unavailable.") from exc


def _tool_call(tool_key: str, run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str, arguments: dict) -> dict:
    return _api_call(f"/internal/agentcrew/tools/{tool_key}", {"toolKey": tool_key, "runId": run_id, "sessionId": session_id, "siteId": site_id, "siteName": site_name, "userId": user_id, "sourceRoute": source_route, "arguments": {**arguments, "site_id": site_id}})


@mcp.tool()
def start_agentcrew_run(site_id: str, site_name: str, user_id: str, source_route: str, session_id: str, message: str) -> dict:
    """Start a deterministic AgentCrew run for the active site."""
    return _api_call("/internal/agentcrew/runs", {"siteId": site_id, "siteName": site_name, "userId": user_id, "sourceRoute": source_route, "sessionId": session_id, "message": message})


@mcp.tool()
def get_agentcrew_run(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read a run only when its active site, user, and session match the caller."""
    query = urlencode({"session_id": session_id, "site_id": site_id, "site_name": site_name, "user_id": user_id, "source_route": source_route})
    request = Request(f"{settings.internal_api_url.rstrip('/')}/internal/agentcrew/runs/{run_id}?{query}", headers={"x-ems-service-token": settings.service_token})
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except HTTPError as exc:
        raise RuntimeError("Authoritative EMS API rejected the request.") from exc
    except (URLError, TimeoutError) as exc:
        raise RuntimeError("Authoritative EMS API is unavailable.") from exc


@_fixture_tool()
def read_site_status(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read the current site's operating status."""
    return _tool_call("site_status", run_id, session_id, site_id, site_name, user_id, source_route, {})


@_fixture_tool()
def read_security_access_records(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read security access records for the current site."""
    return _tool_call("security_access_records", run_id, session_id, site_id, site_name, user_id, source_route, {})


@_fixture_tool()
def read_device_health_and_alerts(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read device health and alerts for the current site."""
    return _tool_call("device_health_and_alerts", run_id, session_id, site_id, site_name, user_id, source_route, {})


@_fixture_tool()
def read_energy_timeseries(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read energy time-series data for the current site."""
    return _tool_call("energy_timeseries", run_id, session_id, site_id, site_name, user_id, source_route, {})


@_fixture_tool()
def read_report_inputs(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read report inputs for the current site."""
    return _tool_call("report_inputs", run_id, session_id, site_id, site_name, user_id, source_route, {})


@mcp.tool()
def get_site_snapshot(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Return the active site's identity, assets, quality, and freshness."""
    return _tool_call("get_site_snapshot", run_id, session_id, site_id, site_name, user_id, source_route, {})


@mcp.tool()
def list_site_assets(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """List assets owned by the active site."""
    return _tool_call("list_site_assets", run_id, session_id, site_id, site_name, user_id, source_route, {})


@mcp.tool()
def query_energy_timeseries(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str, from_: str | None = None, to: str | None = None, limit: int = 100) -> dict:
    """Read bounded energy observations for the active site."""
    return _tool_call("query_energy_timeseries", run_id, session_id, site_id, site_name, user_id, source_route, {"from": from_, "to": to, "limit": limit})


@mcp.tool()
def get_generation_reports(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str, from_: str | None = None, to: str | None = None, limit: int = 100) -> dict:
    """Read persisted calculated metrics and report summaries."""
    return _tool_call("get_generation_reports", run_id, session_id, site_id, site_name, user_id, source_route, {"from": from_, "to": to, "limit": limit})


@mcp.tool()
def get_data_quality_summary(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read quality and freshness metadata for the active site."""
    return _tool_call("get_data_quality_summary", run_id, session_id, site_id, site_name, user_id, source_route, {})


@mcp.tool()
def query_weather_observations(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str, from_: str | None = None, to: str | None = None, limit: int = 100) -> dict:
    """Read bounded weather observations for the active site."""
    return _tool_call("query_weather_observations", run_id, session_id, site_id, site_name, user_id, source_route, {"from": from_, "to": to, "limit": limit})


@mcp.tool()
def get_device_health_and_alerts(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str, limit: int = 100) -> dict:
    """Read device health and alerts for the active site."""
    return _tool_call("get_device_health_and_alerts", run_id, session_id, site_id, site_name, user_id, source_route, {"limit": limit})


@mcp.tool()
def get_metric_catalog(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str) -> dict:
    """Read the approved EMS metric catalog."""
    return _tool_call("get_metric_catalog", run_id, session_id, site_id, site_name, user_id, source_route, {})


@mcp.tool()
def get_source_lineage(run_id: str, session_id: str, site_id: str, site_name: str, user_id: str, source_route: str, limit: int = 100) -> dict:
    """Read safe source lineage metadata without raw payloads or local paths."""
    return _tool_call("get_source_lineage", run_id, session_id, site_id, site_name, user_id, source_route, {"limit": limit})


def run() -> None:
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    run()
