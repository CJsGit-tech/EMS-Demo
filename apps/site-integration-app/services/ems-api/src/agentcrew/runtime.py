"""Typed, deterministic orchestration primitives for the local MVP runtime."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Callable
from uuid import uuid4

from .contracts import ActiveSiteContext, AgentCrewRun, AgentHat, AgentRunStatus, ApprovalMode
from .errors import AgentCrewError, AgentCrewErrorCode


class QualityState(StrEnum):
    VALID = "valid"
    DEGRADED = "degraded"
    INSUFFICIENT = "insufficient"
    REJECTED = "rejected"


@dataclass(frozen=True, slots=True)
class ToolRequest:
    run_id: str
    session_id: str
    active_site: ActiveSiteContext
    tool_key: str
    arguments: dict[str, Any]
    approval_mode: ApprovalMode | None = None
    attempt: int = 1


@dataclass(frozen=True, slots=True)
class SourceReference:
    tool: str
    reference: str


@dataclass(frozen=True, slots=True)
class QualityNotice:
    code: str
    message: str
    affected_fields: tuple[str, ...] = ()
    corrective_actions: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class ToolResult:
    run_id: str
    session_id: str
    site_id: str
    tool_key: str
    outcome: str
    records: tuple[dict[str, Any], ...] = ()
    sources: tuple[SourceReference, ...] = ()
    quality_notices: tuple[QualityNotice, ...] = ()
    discarded_record_count: int = 0
    retry_count: int = 0
    error: dict[str, str] | None = None


@dataclass
class AuditEvent:
    event_type: str
    run_id: str
    site_id: str
    user_id: str
    session_id: str
    payload: dict[str, Any] = field(default_factory=dict)
    sequence: int = 0
    event_id: str = field(default_factory=lambda: f"evt-{uuid4().hex[:12]}")
    occurred_at: str = field(default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"))

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class ReportDraft:
    draft_id: str
    site_id: str
    run_id: str
    title: str
    html: str
    sections: list[dict[str, str]]
    sources: list[dict[str, str]]
    version: int = 1
    state: str = "draft"

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def require_site_context(context: ActiveSiteContext | None) -> ActiveSiteContext:
    if context is None or not context.site_id or not context.user_id or not context.source_route:
        raise AgentCrewError(AgentCrewErrorCode.SITE_CONTEXT_REQUIRED, "An authorized active site context is required.")
    route = context.source_route.lstrip("#/")
    if not route.startswith(f"site/{context.site_id}/"):
        raise AgentCrewError(AgentCrewErrorCode.INVALID_SITE_ROUTE, "The source route does not resolve to the active site.")
    return context


def public_run(run: AgentCrewRun, *, routing: dict[str, Any] | None = None, result: Any = None, **extra: Any) -> dict[str, Any]:
    output = {
        "runId": run.run_id,
        "status": run.status.value,
        "siteContext": {"siteId": run.site_context.site_id, "siteName": run.site_context.site_name,
                         "userId": run.site_context.user_id, "sourceRoute": run.site_context.source_route},
        "activeHat": run.active_hat.value if run.active_hat else None,
        "message": run.message,
    }
    if routing is not None:
        output["routing"] = routing
    if result is not None:
        output["result"] = result
    output.update(extra)
    return output


def validate_tool_request(request: ToolRequest, allowed_tools: set[str]) -> None:
    require_site_context(request.active_site)
    if request.tool_key not in allowed_tools:
        raise AgentCrewError(AgentCrewErrorCode.VALIDATION_FAILED, f"Tool is not allowlisted: {request.tool_key}.")
    if request.attempt < 1 or request.attempt > 3:
        raise AgentCrewError(AgentCrewErrorCode.VALIDATION_FAILED, "MCP attempt must be between 1 and 3.")
    requested_site = request.arguments.get("site_id")
    if requested_site != request.active_site.site_id:
        raise AgentCrewError(AgentCrewErrorCode.SITE_SCOPE_VIOLATION, "Tool site_id must equal the active site.")


def redact(value: Any) -> Any:
    secret_words = ("token", "secret", "password", "authorization", "api_key", "credential")
    if isinstance(value, dict):
        return {key: "[REDACTED]" if any(word in key.lower() for word in secret_words) else redact(item)
                for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def sanitize_html(html: str) -> str:
    """Reject active/network markup; fixtures are already safe and need no rewrite."""
    import re
    if not isinstance(html, str) or not html.strip():
        raise ValueError("unsafe HTML: empty preview")
    if re.search(r"<\s*(script|iframe|object|embed|link)\b|\bon[a-z]+\s*=|(?:src|href)\s*=\s*['\"]\s*(?:https?:|//|data:)", html, re.I):
        raise ValueError("unsafe HTML")
    if "javascript:" in html.lower() or "<form" in html.lower():
        raise ValueError("unsafe HTML")
    return html
