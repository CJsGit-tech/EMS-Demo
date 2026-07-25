"""Named-tool adapter used by AgentCrew and FastMCP."""

from .schemas import Principal, SiteScopedQuery
from .service import EmsService

TOOL_KEYS = frozenset({"get_site_snapshot", "list_site_assets", "query_energy_timeseries", "query_weather_observations", "get_device_health_and_alerts", "get_generation_reports", "get_metric_catalog", "get_data_quality_summary", "get_source_lineage"})


class EmsMcpAdapter:
    def __init__(self, service: EmsService | None = None) -> None:
        self.service = service or EmsService()

    async def call(self, tool_key: str, principal: Principal, site_code: str, arguments: dict) -> dict:
        if tool_key not in TOOL_KEYS:
            raise ValueError(f"Tool is not allowlisted: {tool_key}")
        if "site_id" in arguments and arguments["site_id"] != site_code:
            raise PermissionError("Caller cannot override the authorized site")
        query = SiteScopedQuery.model_validate(arguments)
        if tool_key == "get_site_snapshot": result = await self.service.retrieve_site_snapshot(principal, site_code)
        elif tool_key in {"get_generation_reports"}: result = await self.service.query_derived(principal, site_code, query)
        elif tool_key == "get_data_quality_summary": result = await self.service.quality_summary(principal, site_code)
        elif tool_key == "get_metric_catalog":
            self.service.authorization.require_site(principal, site_code)
            result = {"site_id": site_code, "tool_key": tool_key, "outcome": "ok", "records": [{"metric_code": "energy_kwh", "unit": "kWh", "aggregation": "interval_sum"}, {"metric_code": "performance_ratio", "unit": "ratio", "aggregation": "derived"}]}
        elif tool_key == "get_source_lineage":
            self.service.authorization.require_site(principal, site_code)
            result = {"site_id": site_code, "tool_key": tool_key, "outcome": "ok", "records": [{"source_id": f"{site_code}:deterministic-seed-v1", "file_hash": "synthetic-manifest", "parser_version": "ems-parser-v1", "window": {"from": "2026-07-22T00:00:00Z", "to": "2026-07-23T00:00:00Z"}}]}
        elif tool_key == "get_device_health_and_alerts":
            self.service.authorization.require_site(principal, site_code)
            result = {"site_id": site_code, "tool_key": tool_key, "outcome": "ok", "records": [{"asset_id": asset["asset_id"], "status": "healthy", "alert_code": None} for asset in await self.service.repository.list_assets(site_code)]}
        elif tool_key == "list_site_assets":
            self.service.authorization.require_site(principal, site_code)
            result = {"site_id": site_code, "tool_key": tool_key, "outcome": "ok", "records": await self.service.repository.list_assets(site_code)}
        else: result = await self.service.query_timeseries(principal, site_code, query, tool_key=tool_key)
        payload = result.model_dump() if hasattr(result, "model_dump") else result
        payload.setdefault("sources", [{"tool": tool_key, "reference": f"ems://{site_code}/{tool_key}"}])
        return payload
