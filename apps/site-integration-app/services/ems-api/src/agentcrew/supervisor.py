"""Streaming GPT supervisor for the site-scoped AgentCrew API.

The supervisor deliberately exposes only a small, public event vocabulary.
Raw Responses API events, prompts, credentials, and hidden reasoning never
cross this boundary.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum
import json
from typing import Any, Protocol
from uuid import uuid4

from .contracts import ActiveSiteContext, AgentHat
from .errors import AgentCrewError, AgentCrewErrorCode
from .router import route
from .runtime import redact, require_site_context


class SupervisorEventType(StrEnum):
    RUN_STARTED = "run.started"
    SPECIALIST_DELEGATED = "specialist.delegated"
    ASSISTANT_DELTA = "assistant.delta"
    TOOL_CALL = "tool.call"
    WEB_SEARCH_STARTED = "web_search.started"
    WEB_SEARCH_COMPLETED = "web_search.completed"
    RUN_COMPLETED = "run.completed"
    RUN_FAILED = "run.failed"


@dataclass(frozen=True, slots=True)
class SupervisorEvent:
    """A versionable public SSE envelope, independent of the OpenAI SDK."""

    type: SupervisorEventType
    run_id: str
    sequence: int
    occurred_at: str
    data: dict[str, Any]
    event_id: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "eventId": self.event_id,
            "type": self.type.value,
            "runId": self.run_id,
            "sequence": self.sequence,
            "occurredAt": self.occurred_at,
            "data": redact(self.data),
        }

    def as_sse(self) -> str:
        return f"event: {self.type.value}\ndata: {json.dumps(self.as_dict(), separators=(',', ':'))}\n\n"


class StreamingProvider(Protocol):
    model: str

    def stream(
        self,
        hat: AgentHat,
        context: ActiveSiteContext,
        user_message: str,
        evidence: dict[str, Any],
    ) -> Iterator[Any]: ...


class GPTSupervisor:
    """Map a specialist Responses stream into safe, ordered SSE events."""

    def __init__(
        self,
        provider: StreamingProvider | None,
        *,
        recall: Callable[[], dict[str, Any]] | None = None,
    ) -> None:
        self.provider = provider
        self.recall = recall or (lambda: {})

    def provider_status(self) -> dict[str, Any]:
        if self.provider is None:
            return {"mode": "deterministic-fixtures", "model": None, "status": "ready"}
        return {"mode": "openai", "model": self.provider.model, "status": "configured"}

    def stream(
        self,
        context: ActiveSiteContext,
        user_message: str,
        session_id: str,
        *,
        recall: Callable[[], dict[str, Any]] | None = None,
    ) -> Iterator[SupervisorEvent]:
        del session_id  # session ownership is enforced by the API/service boundary.
        require_site_context(context)
        run_id = f"run-{uuid4().hex[:10]}"
        sequence = 0

        def emit(event_type: SupervisorEventType, data: dict[str, Any]) -> SupervisorEvent:
            nonlocal sequence
            sequence += 1
            return SupervisorEvent(
                type=event_type,
                run_id=run_id,
                sequence=sequence,
                occurred_at=_now_iso(),
                data=redact(data),
                event_id=f"evt-{uuid4().hex[:12]}",
            )

        hat = route(user_message)
        provider = self.provider_status()
        yield emit(SupervisorEventType.RUN_STARTED, {
            "provider": {"mode": provider["mode"], "model": provider["model"]},
            "siteId": context.site_id,
        })
        yield emit(SupervisorEventType.SPECIALIST_DELEGATED, _delegation_data(hat))

        if self.provider is None:
            yield emit(SupervisorEventType.TOOL_CALL, {
                "name": _fixture_tool_for(hat),
                "arguments": {"site_id": context.site_id},
                "mode": "deterministic-fixtures",
            })
            yield emit(SupervisorEventType.RUN_COMPLETED, {
                "provider": {"mode": provider["mode"], "model": provider["model"]},
                "status": "completed",
            })
            return

        try:
            recalled = (recall or self.recall)()
            evidence = {"site_memory": recalled if isinstance(recalled, dict) else {}}
            completed = False
            for raw_event in self.provider.stream(hat, context, user_message, evidence):
                for event_type, data in _translate_response_event(raw_event):
                    if event_type == SupervisorEventType.RUN_COMPLETED:
                        completed = True
                    yield emit(event_type, data)
            if not completed:
                yield emit(SupervisorEventType.RUN_COMPLETED, {
                    "provider": {"mode": provider["mode"], "model": provider["model"]},
                    "status": "completed",
                })
        except Exception as exc:
            code = exc.code.value if isinstance(exc, AgentCrewError) else AgentCrewErrorCode.PROVIDER_UNAVAILABLE.value
            yield emit(SupervisorEventType.RUN_FAILED, {
                "code": code,
                "message": "The configured OpenAI provider is unavailable.",
            })


def _translate_response_event(raw_event: Any) -> list[tuple[SupervisorEventType, dict[str, Any]]]:
    event_type = _field(raw_event, "type")
    if event_type == "response.output_text.delta":
        delta = _field(raw_event, "delta")
        return [(SupervisorEventType.ASSISTANT_DELTA, {"delta": delta if isinstance(delta, str) else ""})]
    if event_type == "response.output_item.added":
        item = _field(raw_event, "item")
        if _field(item, "type") == "web_search_call":
            return [(SupervisorEventType.WEB_SEARCH_STARTED, {"id": _field(item, "id")})]
    if event_type == "response.output_item.done":
        item = _field(raw_event, "item")
        if _field(item, "type") == "web_search_call":
            action = _field(item, "action")
            return [(SupervisorEventType.WEB_SEARCH_COMPLETED, {
                "id": _field(item, "id"),
                "query": _field(action, "query"),
                "sources": _safe_sources(_field(action, "sources")),
            })]
        if _field(item, "type") == "function_call":
            return _function_call_event(_field(item, "name"), _field(item, "arguments"))
    if event_type == "response.function_call_arguments.done":
        return _function_call_event(_field(raw_event, "name"), _field(raw_event, "arguments"))
    if event_type == "response.completed":
        return [(SupervisorEventType.RUN_COMPLETED, {"status": "completed"})]
    if event_type in {"error", "response.failed"}:
        message = _field(raw_event, "message") or "OpenAI provider event failed"
        raise AgentCrewError(AgentCrewErrorCode.PROVIDER_UNAVAILABLE, str(message))
    return []


def _function_call_event(name: Any, arguments: Any) -> list[tuple[SupervisorEventType, dict[str, Any]]]:
    safe_name = name if isinstance(name, str) else "unknown_tool"
    parsed = _parse_arguments(arguments)
    if safe_name == "delegate_to_specialist":
        try:
            return [(SupervisorEventType.SPECIALIST_DELEGATED, _delegation_data(AgentHat(parsed.get("hat"))))]
        except (TypeError, ValueError):
            return [(SupervisorEventType.TOOL_CALL, {"name": safe_name, "arguments": parsed})]
    return [(SupervisorEventType.TOOL_CALL, {"name": safe_name, "arguments": parsed})]


def _field(value: Any, name: str) -> Any:
    if isinstance(value, dict):
        return value.get(name)
    return getattr(value, name, None)


def _parse_arguments(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return redact(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return redact(parsed)
        except json.JSONDecodeError:
            pass
    return {}


def _safe_sources(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    sources: list[dict[str, str]] = []
    for source in value:
        url = _field(source, "url")
        title = _field(source, "title")
        if not isinstance(url, str):
            continue
        item = {"url": url}
        if isinstance(title, str):
            item["title"] = title
        sources.append(item)
    return sources


def _delegation_data(hat: AgentHat) -> dict[str, str]:
    return {"hat": hat.value, "label": hat.value.replace("_", " ").title()}


def _fixture_tool_for(hat: AgentHat) -> str:
    return {
        AgentHat.SITE_SECURITY_MANAGER: "security_access_records",
        AgentHat.DEVICE_MONITORING_EXPERT: "device_health_and_alerts",
        AgentHat.DATA_ANALYSIS_SPECIALIST: "energy_timeseries",
        AgentHat.REPORT_GENERATION_SPECIALIST: "report_inputs",
    }[hat]


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
