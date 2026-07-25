import asyncio
from dataclasses import replace
import importlib

import agentcrew.config as config
import agentcrew.mcp_server as mcp_server
from agentcrew.mcp_server import mcp


def test_fastmcp_registers_typed_agentcrew_tools():
    tools = asyncio.run(mcp.list_tools())
    assert {tool.name for tool in tools} == {
        "start_agentcrew_run",
        "get_agentcrew_run",
        "read_site_status",
        "read_security_access_records",
        "read_device_health_and_alerts",
        "read_energy_timeseries",
        "read_report_inputs",
        "get_site_snapshot",
        "list_site_assets",
        "query_energy_timeseries",
        "get_generation_reports",
        "get_data_quality_summary",
        "query_weather_observations",
        "get_device_health_and_alerts",
        "get_metric_catalog",
        "get_source_lineage",
    }
    energy = next(tool for tool in tools if tool.name == "read_energy_timeseries")
    assert "site_id" in energy.inputSchema["properties"]
    assert "source_route" in energy.inputSchema["properties"]


def test_database_mode_does_not_advertise_fixture_only_legacy_tools(monkeypatch):
    original = config.settings
    monkeypatch.setattr(config, "settings", replace(original, mcp_gateway_mode="database", persistence_mode="postgres"))
    production_server = importlib.reload(mcp_server)
    try:
        tool_names = {tool.name for tool in asyncio.run(production_server.mcp.list_tools())}
        assert {"read_site_status", "read_security_access_records", "read_device_health_and_alerts", "read_energy_timeseries", "read_report_inputs"}.isdisjoint(tool_names)
        assert "query_energy_timeseries" in tool_names
    finally:
        monkeypatch.setattr(config, "settings", original)
        importlib.reload(production_server)
