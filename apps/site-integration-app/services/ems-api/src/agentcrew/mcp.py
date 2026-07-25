"""Bounded, active-site MCP gateways for fixture and authoritative EMS data."""

import asyncio
from dataclasses import replace
from typing import Any, Callable

from .config import settings
from .errors import AgentCrewError, AgentCrewErrorCode
from .fixtures import fixture_records
from .runtime import AuditEvent, SourceReference, ToolRequest, ToolResult, redact, validate_tool_request

TOOL_REGISTRY = {
    "get_site_snapshot": {"hats": {"site_security_manager", "report_generation_specialist"}},
    "list_site_assets": {"hats": {"device_monitoring_expert", "report_generation_specialist"}},
    "query_energy_timeseries": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "query_weather_observations": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "get_device_health_and_alerts": {"hats": {"device_monitoring_expert", "report_generation_specialist"}},
    "get_generation_reports": {"hats": {"report_generation_specialist"}},
    "get_metric_catalog": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "get_data_quality_summary": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "get_source_lineage": {"hats": {"report_generation_specialist"}},
    "site_status": {"hats": {"site_security_manager", "report_generation_specialist"}},
    "security_access_records": {"hats": {"site_security_manager"}},
    "device_health_and_alerts": {"hats": {"device_monitoring_expert", "report_generation_specialist"}},
    "energy_timeseries": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "report_inputs": {"hats": {"report_generation_specialist"}},
}

# These names correspond one-to-one with EmsMcpAdapter.  Legacy fixture names
# stay out of this registry so production cannot accidentally serve synthetic
# records after a configuration change.
AUTHORITATIVE_TOOL_REGISTRY = {
    "get_site_snapshot": {"hats": {"site_security_manager", "report_generation_specialist"}},
    "list_site_assets": {"hats": {"device_monitoring_expert", "report_generation_specialist"}},
    "query_energy_timeseries": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "query_weather_observations": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "get_device_health_and_alerts": {"hats": {"device_monitoring_expert", "report_generation_specialist"}},
    "get_generation_reports": {"hats": {"report_generation_specialist"}},
    "get_metric_catalog": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "get_data_quality_summary": {"hats": {"data_analysis_specialist", "report_generation_specialist"}},
    "get_source_lineage": {"hats": {"report_generation_specialist"}},
}


class _GatewayPolicy:
    """Common read-only workflow plan used to keep approvals bounded."""

    session_allowlist: tuple[str, ...]
    workflow_tools: dict[str, dict[str, str]]


class FixtureGateway(_GatewayPolicy):
    is_fixture = True
    session_allowlist = ("site_status", "security_access_records", "device_health_and_alerts", "energy_timeseries", "report_inputs")
    workflow_tools = {
        "site_security_manager": {"read": "security_access_records"},
        "device_monitoring_expert": {"read": "device_health_and_alerts"},
        "data_analysis_specialist": {"read": "energy_timeseries"},
        "report_generation_specialist": {"report": "report_inputs", "analysis": "energy_timeseries"},
    }
    def __init__(
        self,
        audit: Callable[[AuditEvent], None],
        approved: Callable[[str, str], bool] | None = None,
        persist_attempt: Callable[[ToolRequest, ToolResult], None] | None = None,
    ):
        self.audit = audit
        self.approved = approved or (lambda _session, _tool: True)
        self.persist_attempt = persist_attempt or (lambda _request, _result: None)
        self.failures: dict[str, int] = {}

    def call(self, request: ToolRequest) -> ToolResult:
        validate_tool_request(request, set(TOOL_REGISTRY))
        self.audit(AuditEvent("mcp_tool_requested", request.run_id, request.active_site.site_id,
                              request.active_site.user_id, request.session_id,
                              {"tool_key": request.tool_key, "arguments": redact(request.arguments)}))
        if not (self.approved(request.session_id, request.tool_key) or self.approved(request.session_id, "*")):
            self.audit(AuditEvent("mcp_tool_approval_required", request.run_id, request.active_site.site_id,
                                  request.active_site.user_id, request.session_id, {"tool_key": request.tool_key}))
            result = ToolResult(request.run_id, request.session_id, request.active_site.site_id, request.tool_key,
                                "approval_required")
            self.persist_attempt(request, result)
            return result
        self.audit(AuditEvent("mcp_tool_attempted", request.run_id, request.active_site.site_id,
                              request.active_site.user_id, request.session_id,
                              {"tool_key": request.tool_key, "attempt": request.attempt}))
        remaining = self.failures.get(request.tool_key, 0)
        if remaining:
            self.failures[request.tool_key] = remaining - 1
            if request.attempt < 3:
                self.persist_attempt(request, ToolResult(
                    request.run_id, request.session_id, request.active_site.site_id, request.tool_key,
                    "transient_failure", retry_count=request.attempt - 1,
                ))
                self.audit(AuditEvent("mcp_tool_retried", request.run_id, request.active_site.site_id,
                                      request.active_site.user_id, request.session_id,
                                      {"previous_attempt": request.attempt, "next_attempt": request.attempt + 1}))
                return self.call(replace(request, attempt=request.attempt + 1))
            result = ToolResult(request.run_id, request.session_id, request.active_site.site_id, request.tool_key,
                                "missing_source", retry_count=2,
                                error={"code": "missing_source", "message": "Fixture source unavailable after bounded retries."})
            self.audit(AuditEvent("mcp_tool_responded", request.run_id, request.active_site.site_id,
                                  request.active_site.user_id, request.session_id, {"outcome": result.outcome, "retry_count": 2}))
            self.persist_attempt(request, result)
            return result
        records = fixture_records(request.tool_key, request.active_site.site_id)
        safe, discarded = [], 0
        for record in records:
            if record.get("site_id") != request.active_site.site_id:
                discarded += 1
                self.audit(AuditEvent("mcp_scope_violation_detected", request.run_id, request.active_site.site_id,
                                      request.active_site.user_id, request.session_id,
                                      {"observed_site_id": record.get("site_id"), "expected_site_id": request.active_site.site_id}))
            else:
                safe.append(record)
        result = ToolResult(request.run_id, request.session_id, request.active_site.site_id, request.tool_key,
                            "scope_violation" if discarded else "success", tuple(safe),
                            (SourceReference(request.tool_key, f"{request.active_site.site_id}/{request.tool_key}"),),
                            discarded_record_count=discarded)
        self.audit(AuditEvent("mcp_tool_responded", request.run_id, request.active_site.site_id,
                              request.active_site.user_id, request.session_id,
                              {"outcome": result.outcome, "record_count": len(safe), "discarded": discarded}))
        self.persist_attempt(request, result)
        return result


class AuthoritativeMcpGateway(_GatewayPolicy):
    """Read the allowlisted, active-site EMS data contract with bounded retries.

    The adapter is intentionally injected: production passes EmsMcpAdapter
    configured with the database repository, while tests can exercise the
    boundary without a network or database.  No fixture alias is accepted.
    """

    is_fixture = False
    session_allowlist = tuple(AUTHORITATIVE_TOOL_REGISTRY)
    workflow_tools = {
        "site_security_manager": {"read": "get_site_snapshot"},
        "device_monitoring_expert": {"read": "get_device_health_and_alerts"},
        "data_analysis_specialist": {"read": "query_energy_timeseries"},
        "report_generation_specialist": {"report": "get_generation_reports", "analysis": "query_energy_timeseries"},
    }

    def __init__(
        self,
        audit: Callable[[AuditEvent], None],
        *,
        adapter: Any,
        authorization: Any,
        approved: Callable[[str, str], bool] | None = None,
        persist_attempt: Callable[[ToolRequest, ToolResult], None] | None = None,
    ) -> None:
        self.audit = audit
        self.adapter = adapter
        self.authorization = authorization
        self.approved = approved or (lambda _session, _tool: True)
        self.persist_attempt = persist_attempt or (lambda _request, _result: None)

    def call(self, request: ToolRequest) -> ToolResult:
        validate_tool_request(request, set(AUTHORITATIVE_TOOL_REGISTRY))
        self.audit(AuditEvent("mcp_tool_requested", request.run_id, request.active_site.site_id,
                              request.active_site.user_id, request.session_id,
                              {"tool_key": request.tool_key, "arguments": redact(request.arguments), "gateway": "authoritative"}))
        if not self.approved(request.session_id, request.tool_key):
            self.audit(AuditEvent("mcp_tool_approval_required", request.run_id, request.active_site.site_id,
                                  request.active_site.user_id, request.session_id, {"tool_key": request.tool_key}))
            result = ToolResult(request.run_id, request.session_id, request.active_site.site_id, request.tool_key, "approval_required")
            self.persist_attempt(request, result)
            return result

        for attempt in range(request.attempt, 4):
            current = replace(request, attempt=attempt)
            self.audit(AuditEvent("mcp_tool_attempted", current.run_id, current.active_site.site_id,
                                  current.active_site.user_id, current.session_id,
                                  {"tool_key": current.tool_key, "attempt": current.attempt, "gateway": "authoritative"}))
            try:
                principal = self.authorization.principal(current.active_site.user_id)
                response = asyncio.run(self.adapter.call(current.tool_key, principal, current.active_site.site_id, current.arguments))
                result = self._result_from_response(current, response, retry_count=attempt - 1)
            except Exception:
                outcome = "missing_source" if attempt == 3 else "transient_failure"
                error = {"code": "missing_source", "message": "Authoritative EMS data is unavailable after bounded retries."}
                result = ToolResult(current.run_id, current.session_id, current.active_site.site_id, current.tool_key,
                                    outcome, retry_count=attempt - 1, error=error)
            self.persist_attempt(current, result)
            if result.outcome != "transient_failure":
                self.audit(AuditEvent("mcp_tool_responded", current.run_id, current.active_site.site_id,
                                      current.active_site.user_id, current.session_id,
                                      {"outcome": result.outcome, "retry_count": result.retry_count,
                                       "record_count": len(result.records), "gateway": "authoritative"}))
                return result
            self.audit(AuditEvent("mcp_tool_retried", current.run_id, current.active_site.site_id,
                                  current.active_site.user_id, current.session_id,
                                  {"previous_attempt": attempt, "next_attempt": attempt + 1}))
        raise AssertionError("bounded MCP retry loop did not return")  # pragma: no cover

    @staticmethod
    def _result_from_response(request: ToolRequest, response: dict[str, Any], *, retry_count: int) -> ToolResult:
        response_site = response.get("site_id")
        if response_site != request.active_site.site_id:
            raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Authoritative response is outside the active site.")
        records = tuple(record for record in response.get("records", []) if record.get("site_id") == response_site)
        discarded = len(response.get("records", [])) - len(records)
        sources = tuple(
            SourceReference(item["tool"], item["reference"])
            for item in response.get("sources", [])
            if isinstance(item, dict) and isinstance(item.get("tool"), str) and isinstance(item.get("reference"), str)
        )
        if not sources:
            sources = (SourceReference(request.tool_key, f"ems://{response_site}/{request.tool_key}"),)
        outcome = "success" if response.get("outcome") == "ok" else str(response.get("outcome", "success"))
        return ToolResult(request.run_id, request.session_id, request.active_site.site_id, request.tool_key,
                          outcome, records, sources, discarded_record_count=discarded, retry_count=retry_count,
                          error=response.get("error"))


def build_mcp_gateway(
    audit: Callable[[AuditEvent], None],
    approved: Callable[[str, str], bool],
    persist_attempt: Callable[[ToolRequest, ToolResult], None],
) -> FixtureGateway | AuthoritativeMcpGateway:
    """Select fixtures only when that mode is explicitly configured."""
    if settings.mcp_gateway_mode.lower() in {"fixture", "fixtures", "deterministic-fixtures"}:
        return FixtureGateway(audit, approved, persist_attempt)

    # Delayed imports keep the fixture-only local startup free of database
    # initialization and avoid coupling this policy module to FastAPI.
    from ems.mcp_adapter import EmsMcpAdapter
    from ems.router import ems_service

    adapter = EmsMcpAdapter(ems_service)
    return AuthoritativeMcpGateway(audit, adapter=adapter, authorization=adapter.service.authorization,
                                   approved=approved, persist_attempt=persist_attempt)
