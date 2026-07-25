"""FastAPI application for the authoritative AgentCrew service."""

from dataclasses import asdict
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from .config import settings
from .contracts import ActiveSiteContext, ApprovalMode
from .errors import AgentCrewError
from .runtime import ToolRequest
from .service import AgentCrewService
from .supervisor import GPTSupervisor
from ems.router import router as ems_router, ems_session_factory
from ems.mcp_adapter import EmsMcpAdapter, TOOL_KEYS
from ems.capabilities import CapabilityIssuer, DurableReplayLedger, ReplayLedger


class SiteContextPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    site_id: str = Field(alias="siteId")
    site_name: str = Field(default="Verde North", alias="siteName")
    user_id: str = Field(default="demo-user", alias="userId")
    source_route: str = Field(alias="sourceRoute")

    def to_domain(self) -> ActiveSiteContext:
        return ActiveSiteContext(self.site_id, self.site_name, self.user_id, self.source_route)


class RunRequest(SiteContextPayload):
    session_id: str = Field(default="local-session", alias="sessionId")
    message: str = Field(min_length=1, max_length=4000)


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    session_id: str = Field(alias="sessionId")
    mode: ApprovalMode


class SessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    session_id: str = Field(alias="sessionId")


class ToolRequestPayload(SiteContextPayload):
    run_id: str = Field(default="mcp-direct", alias="runId")
    session_id: str = Field(alias="sessionId")
    tool_key: str = Field(alias="toolKey")
    arguments: dict = Field(default_factory=dict)
    attempt: int = 1


class AuditQuery(BaseModel):
    site_id: str = Field(alias="site_id")
    user_id: str = "demo-user"


class MemoryQuery(SiteContextPayload):
    session_id: str = Field(alias="sessionId")
    query: str = ""
    limit: int = Field(default=12, ge=1, le=50)


class PreferenceRequest(SiteContextPayload):
    preference_key: str = Field(alias="preferenceKey", min_length=1, max_length=96)
    value: object
    source: str = "user"


class MemoryConfirmRequest(SiteContextPayload):
    memory_id: str = Field(alias="memoryId")


class ReportConfirmationRequest(SiteContextPayload):
    pass


service = AgentCrewService()
supervisor = GPTSupervisor(service.provider)
ems_mcp_adapter = EmsMcpAdapter()
ems_capability_issuer = CapabilityIssuer()
ems_replay_ledger = ReplayLedger()
ems_durable_replay_ledger = DurableReplayLedger(ems_session_factory) if ems_session_factory is not None else None
app = FastAPI(title="Verde EMS AgentCrew API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=list(settings.allowed_headers),
)
app.include_router(ems_router)


def request_id(correlation_id: str | None) -> str:
    return correlation_id or f"req-{uuid4().hex[:10]}"


def internal_service_auth(x_ems_service_token: str | None = Header(default=None)) -> None:
    if x_ems_service_token != settings.service_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "invalid_service_token"})


def error_response(exc: Exception) -> HTTPException:
    if isinstance(exc, AgentCrewError):
        code = exc.code.value
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE if code == "provider_unavailable" else (status.HTTP_409_CONFLICT if code in {"site_scope_violation", "run_interrupted"} else status.HTTP_400_BAD_REQUEST)
        return HTTPException(status_code=http_status, detail=exc.as_dict())
    if isinstance(exc, (KeyError, ValueError)):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "validation_failed", "message": str(exc)})
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"code": "internal_error", "message": "Unexpected AgentCrew error."})


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "ems-api", "provider": settings.provider_mode}


@app.get("/readyz")
def readyz() -> dict[str, str]:
    return {"status": "ready", "service": "ems-api"}


@app.post("/api/v1/agentcrew/context")
def context(payload: SiteContextPayload, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        result = service.context(payload.to_domain())
        return {"requestId": request_id(x_correlation_id), **result}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/api/v1/agentcrew/runs", status_code=status.HTTP_202_ACCEPTED)
def start_run(payload: RunRequest, idempotency_key: str | None = Header(default=None), x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        result = service.start(payload.to_domain(), payload.message, payload.session_id, idempotency_key)
        return {"requestId": request_id(x_correlation_id), "run": result}
    except Exception as exc:
        raise error_response(exc) from exc


@app.get("/api/v1/agentcrew/provider")
def provider_status(x_correlation_id: str | None = Header(default=None)) -> dict:
    return {"requestId": request_id(x_correlation_id), "provider": supervisor.provider_status()}


@app.post("/api/v1/agentcrew/runs/stream")
def stream_run(payload: RunRequest) -> StreamingResponse:
    """Stream public AgentCrew progress; the blocking endpoint remains supported."""
    try:
        context = payload.to_domain()
        # Validate before returning a 200 stream; provider errors become the
        # terminal SSE event because headers may already have been sent.
        from .runtime import require_site_context

        require_site_context(context)
        events = supervisor.stream(
            context,
            payload.message,
            payload.session_id,
            recall=lambda: service.recall(payload.session_id, context, payload.message),
        )
        return StreamingResponse(
            (event.as_sse() for event in events),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except Exception as exc:
        raise error_response(exc) from exc


@app.get("/api/v1/agentcrew/runs/{run_id}")
def get_run(run_id: str, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "run": service.snapshot(run_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Run not found"}) from exc


@app.post("/api/v1/agentcrew/runs/{run_id}/approvals")
def approve_run(run_id: str, payload: ApprovalRequest, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "run": service.approve(run_id, payload.session_id, payload.mode)}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/api/v1/agentcrew/reports/{draft_id}/confirm")
def confirm_report(draft_id: str, payload: ReportConfirmationRequest, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        report = service.confirm_report(draft_id, payload.to_domain())
        return {"requestId": request_id(x_correlation_id), "report": report}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/api/v1/agentcrew/runs/{run_id}/interrupt", status_code=status.HTTP_202_ACCEPTED)
def interrupt_run(run_id: str, payload: SessionRequest, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "run": service.interrupt(run_id, payload.session_id)}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/api/v1/agentcrew/runs/{run_id}/recover", status_code=status.HTTP_202_ACCEPTED)
def recover_run(run_id: str, payload: SessionRequest, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "run": service.recover(run_id, payload.session_id)}
    except Exception as exc:
        raise error_response(exc) from exc


@app.get("/api/v1/agentcrew/audit")
def audit(site_id: str, user_id: str = "demo-user", x_correlation_id: str | None = Header(default=None)) -> dict:
    return {"requestId": request_id(x_correlation_id), "siteId": site_id, "events": service.audit(site_id, user_id)}


@app.post("/api/v1/agentcrew/memory/recall")
def recall_memory(payload: MemoryQuery, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "memory": service.recall(payload.session_id, payload.to_domain(), payload.query) | {"limit": payload.limit}}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/api/v1/agentcrew/preferences")
def save_preference(payload: PreferenceRequest, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "preference": service.set_preference(payload.to_domain(), payload.preference_key, payload.value, payload.source)}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/api/v1/agentcrew/memory/{memory_id}/confirm")
def confirm_memory(memory_id: str, payload: MemoryConfirmRequest, x_correlation_id: str | None = Header(default=None)) -> dict:
    try:
        return {"requestId": request_id(x_correlation_id), "memory": service.confirm_memory(payload.to_domain(), memory_id)}
    except Exception as exc:
        raise error_response(exc) from exc


@app.post("/internal/agentcrew/runs", dependencies=[Depends(internal_service_auth)])
def internal_start_run(payload: RunRequest) -> dict:
    return {"run": service.start(payload.to_domain(), payload.message, payload.session_id)}


@app.get("/internal/agentcrew/runs/{run_id}", dependencies=[Depends(internal_service_auth)])
def internal_get_run(run_id: str) -> dict:
    try:
        return {"run": service.snapshot(run_id)}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Run not found"}) from exc


@app.post("/internal/agentcrew/tools/{tool_key}", dependencies=[Depends(internal_service_auth)])
async def internal_tool(tool_key: str, payload: ToolRequestPayload) -> dict:
    if tool_key != payload.tool_key:
        raise HTTPException(status_code=400, detail={"code": "validation_failed", "message": "Tool path and payload do not match."})
    try:
        if tool_key in TOOL_KEYS:
            principal = ems_mcp_adapter.service.authorization.principal(payload.user_id)
            capability = ems_capability_issuer.issue(payload.user_id, payload.site_id, payload.run_id, payload.session_id, {tool_key})
            ems_capability_issuer.verify(capability, user_id=payload.user_id, site_code=payload.site_id, run_id=payload.run_id, session_id=payload.session_id, tool_key=tool_key)
            nonce = str(payload.arguments.get("nonce", "mcp-direct"))
            replay_key = ems_replay_ledger.key(payload.run_id, tool_key, payload.arguments, nonce)
            prior = await ems_durable_replay_ledger.get(replay_key) if ems_durable_replay_ledger else ems_replay_ledger.get(replay_key)
            if prior is not None:
                return {"result": prior}
            result = await ems_mcp_adapter.call(tool_key, principal, payload.site_id, payload.arguments)
            if ems_durable_replay_ledger:
                await ems_durable_replay_ledger.put(replay_key, session_id=payload.session_id, site_code=payload.site_id, result=result, expires_at=capability.expires_at)
            else:
                ems_replay_ledger.put(replay_key, result)
            return {"result": result}
        result = service.gateway.call(ToolRequest(payload.run_id, payload.session_id, payload.to_domain(), tool_key, payload.arguments, attempt=payload.attempt))
        return {"result": {"run_id": result.run_id, "session_id": result.session_id, "site_id": result.site_id, "tool_key": result.tool_key, "outcome": result.outcome, "records": list(result.records), "sources": [asdict(source) for source in result.sources], "quality_notices": [asdict(notice) for notice in result.quality_notices], "discarded_record_count": result.discarded_record_count, "retry_count": result.retry_count, "error": result.error}}
    except Exception as exc:
        raise error_response(exc) from exc
