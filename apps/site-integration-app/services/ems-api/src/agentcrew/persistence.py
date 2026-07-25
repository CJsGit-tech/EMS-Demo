"""Durable repository adapter with an explicit local-fixture fallback.

The orchestration service remains synchronous for the deterministic MVP contract.
This adapter owns the async SQLAlchemy boundary and executes one bounded database
operation at a time. A failed connection disables the adapter for the process;
it never silently creates a second state owner or exposes database errors to the
browser.
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict
from datetime import datetime, timezone
import hashlib
import json
from typing import Any

from sqlalchemy import delete, select

from .config import settings
from .db import async_session_factory
from .errors import AgentCrewError, AgentCrewErrorCode
from .db.models import (
    AgentRunRecord,
    ApprovalRecord,
    AuditEventRecord,
    ChatMessage,
    ChatSession,
    HandoffRecord,
    McpAttemptRecord,
    MemoryItem,
    ReportDraftRecord,
    ReportDraftRevisionRecord,
    UserPreference,
)
from .runtime import AuditEvent, redact


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class DurableRepository:
    """Persistence port used by FastAPI-owned orchestration state."""

    def __init__(self) -> None:
        self.enabled = settings.persistence_mode.lower() not in {"memory", "fixtures", "off"}
        self.available = self.enabled
        self.last_error: str | None = None

    def _execute(self, operation):
        # Explicit fixture/offline modes intentionally have no database owner.
        # Every configured production persistence operation must either commit
        # or surface a safe failure; it must never become a silent no-op.
        if not self.enabled:
            return None
        if not self.available:
            raise AgentCrewError(AgentCrewErrorCode.PERSISTENCE_UNAVAILABLE, "Durable AgentCrew persistence is unavailable.")
        try:
            return asyncio.run(operation())
        except AgentCrewError:
            raise
        except Exception as exc:
            self.available = False
            self.last_error = type(exc).__name__
            raise AgentCrewError(AgentCrewErrorCode.PERSISTENCE_UNAVAILABLE, "Durable AgentCrew persistence is unavailable.") from exc

    def save_session(self, session_id: str, site_id: str, user_id: str, title: str = "Site operations chat") -> None:
        async def operation():
            async with async_session_factory() as db:
                row = await db.get(ChatSession, session_id)
                now = _now()
                if row is None:
                    row = ChatSession(id=session_id, site_id=site_id, user_id=user_id, title=title, status="active", created_at=now, updated_at=now)
                    db.add(row)
                else:
                    row.updated_at = now
                await db.commit()
        self._execute(operation)

    def save_message(self, message: dict[str, Any], session_id: str, site_id: str, user_id: str, content: str, run_id: str | None = None) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                db.add(ChatMessage(id=message["messageId"], session_id=session_id, site_id=site_id, user_id=user_id, role=message["role"], content_redacted=redact(content), content_hash=_hash(content), run_id=run_id, created_at=now, updated_at=now))
                session = await db.get(ChatSession, session_id)
                if session:
                    session.updated_at = now
                    session.last_run_id = run_id
                await db.commit()
        self._execute(operation)

    def save_run(self, run: dict[str, Any], context, request: str) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                row = await db.get(AgentRunRecord, run["runId"])
                values = {"site_id": context.site_id, "user_id": context.user_id, "session_id": run.get("sessionId", ""), "status": run["status"], "active_hat": run.get("activeHat"), "request_redacted": json.dumps(redact(request)), "result_json": run.get("result"), "updated_at": now}
                if row is None:
                    db.add(AgentRunRecord(id=run["runId"], created_at=now, **values))
                else:
                    for key, value in values.items():
                        setattr(row, key, value)
                await db.commit()
        self._execute(operation)

    def load_run(self, run_id: str) -> dict[str, Any] | None:
        async def operation():
            async with async_session_factory() as db:
                row = await db.get(AgentRunRecord, run_id)
                if row is None:
                    return None
                return {"runId": row.id, "status": row.status, "activeHat": row.active_hat, "result": row.result_json, "siteId": row.site_id, "userId": row.user_id, "sessionId": row.session_id, "request": row.request_redacted}
        return self._execute(operation)

    def save_audit(self, event: AuditEvent) -> None:
        async def operation():
            async with async_session_factory() as db:
                db.add(AuditEventRecord(id=event.event_id, site_id=event.site_id, user_id=event.user_id, session_id=event.session_id, run_id=event.run_id, event_type=event.event_type, safe_metadata_json=redact(event.payload), sequence=event.sequence, created_at=_now(), updated_at=_now()))
                await db.commit()
        self._execute(operation)

    def save_mcp_attempt(self, request, result) -> None:
        """Persist one safe attempt row, including failed bounded retries."""
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                attempt_id = f"mcp-{_hash(f'{request.run_id}:{request.tool_key}:{request.attempt}')[:48]}"
                row = await db.get(McpAttemptRecord, attempt_id)
                values = {
                    "user_id": request.active_site.user_id,
                    "site_id": request.active_site.site_id,
                    "run_id": request.run_id,
                    "session_id": request.session_id,
                    "tool_key": request.tool_key,
                    "attempt": request.attempt,
                    "outcome": result.outcome,
                    "safe_request_json": {"arguments": redact(request.arguments)},
                    "safe_response_json": {
                        "outcome": result.outcome,
                        "record_count": len(result.records),
                        "sources": [asdict(source) for source in result.sources],
                        "retry_count": result.retry_count,
                        "error": redact(result.error),
                    },
                    "updated_at": now,
                }
                if row is None:
                    db.add(McpAttemptRecord(id=attempt_id, created_at=now, **values))
                else:
                    for key, value in values.items():
                        setattr(row, key, value)
                await db.commit()
        self._execute(operation)

    def save_stream_artifact(self, artifact: dict[str, Any], context, request: str) -> None:
        """Checkpoint the public SSE artifact so disconnects do not erase a run."""
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                row = await db.get(AgentRunRecord, artifact["runId"])
                values = {
                    "site_id": context.site_id,
                    "user_id": context.user_id,
                    "session_id": artifact["sessionId"],
                    "status": artifact["status"],
                    "active_hat": artifact.get("activeHat"),
                    "request_redacted": json.dumps(redact(request)),
                    "result_json": {"streamEvents": artifact["events"]},
                    "updated_at": now,
                }
                if row is None:
                    db.add(AgentRunRecord(id=artifact["runId"], created_at=now, **values))
                else:
                    for key, value in values.items():
                        setattr(row, key, value)
                await db.commit()
        self._execute(operation)

    def list_audit(self, site_id: str, user_id: str) -> list[dict[str, Any]] | None:
        async def operation():
            async with async_session_factory() as db:
                rows = (await db.execute(select(AuditEventRecord).where(AuditEventRecord.site_id == site_id, AuditEventRecord.user_id == user_id).order_by(AuditEventRecord.created_at))).scalars().all()
                return [{"event_id": row.id, "event_type": row.event_type, "run_id": row.run_id, "site_id": row.site_id, "user_id": row.user_id, "session_id": row.session_id, "payload": row.safe_metadata_json, "sequence": row.sequence, "occurred_at": row.created_at.isoformat()} for row in rows]
        return self._execute(operation)

    def save_memory(self, item: dict[str, Any], session_id: str | None = None) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                db.add(MemoryItem(id=item["memory_id"], site_id=item["site_id"], user_id=item["user_id"], session_id=session_id, memory_type=item["memory_type"], content=item["content"], source_message_id=item.get("source_message_id"), status=item["status"], confidence=item["confidence"], created_at=now, updated_at=now))
                await db.commit()
        self._execute(operation)

    def confirm_memory(self, memory_id: str, site_id: str, user_id: str) -> None:
        async def operation():
            async with async_session_factory() as db:
                row = await db.get(MemoryItem, memory_id)
                if row and row.site_id == site_id and row.user_id == user_id:
                    row.status = "confirmed"
                    row.confidence = 1.0
                    row.confirmed_at = _now()
                    row.updated_at = _now()
                    await db.commit()
        self._execute(operation)

    def save_preference(self, preference: dict[str, Any]) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                preference_key = ":".join(str(preference[field]) for field in ("userId", "siteId", "preferenceKey", "version"))
                preference_id = f"pref-{_hash(preference_key)[:40]}"
                db.add(UserPreference(id=preference_id, site_id=preference["siteId"], user_id=preference["userId"], preference_key=preference["preferenceKey"], value_json={"value": preference["value"]}, source=preference["source"], status=preference["status"], version=preference["version"], confidence=preference["confidence"], confirmed_at=now if preference["status"] == "active" else None, created_at=now, updated_at=now))
                await db.commit()
        self._execute(operation)

    def save_report(self, draft: dict[str, Any], user_id: str) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                row = await db.get(ReportDraftRecord, draft["draft_id"])
                values = {"site_id": draft["site_id"], "user_id": user_id, "run_id": draft["run_id"], "title": draft["title"], "html_sanitized": draft["html"], "sections_json": draft["sections"], "sources_json": draft["sources"], "version": draft.get("version", 1), "state": draft.get("state", "draft"), "updated_at": now}
                if row is None:
                    db.add(ReportDraftRecord(id=draft["draft_id"], created_at=now, **values))
                else:
                    for key, value in values.items():
                        setattr(row, key, value)
                await db.flush()
                revision_id = f"revision-{draft['draft_id']}-{draft.get('version', 1)}"
                if await db.get(ReportDraftRevisionRecord, revision_id) is None:
                    db.add(ReportDraftRevisionRecord(
                        id=revision_id,
                        user_id=user_id,
                        site_id=draft["site_id"],
                        created_at=now,
                        updated_at=now,
                        draft_id=draft["draft_id"],
                        run_id=draft["run_id"],
                        title=draft["title"],
                        html_sanitized=draft["html"],
                        sections_json=draft["sections"],
                        sources_json=draft["sources"],
                        version=draft.get("version", 1),
                        state=draft.get("state", "draft"),
                    ))
                await db.commit()
        self._execute(operation)

    def confirm_report(self, draft_id: str, site_id: str, user_id: str) -> dict[str, Any] | None:
        """Confirm a draft once and retain the immutable confirmed revision."""
        async def operation():
            async with async_session_factory() as db:
                row = await db.get(ReportDraftRecord, draft_id)
                if row is None or row.site_id != site_id or row.user_id != user_id:
                    return None
                now = _now()
                if row.state != "confirmed":
                    row.version += 1
                    row.state = "confirmed"
                    row.updated_at = now
                revision_id = f"revision-{row.id}-{row.version}"
                if await db.get(ReportDraftRevisionRecord, revision_id) is None:
                    db.add(ReportDraftRevisionRecord(
                        id=revision_id,
                        user_id=row.user_id,
                        site_id=row.site_id,
                        created_at=now,
                        updated_at=now,
                        draft_id=row.id,
                        run_id=row.run_id,
                        title=row.title,
                        html_sanitized=row.html_sanitized,
                        sections_json=row.sections_json,
                        sources_json=row.sources_json,
                        version=row.version,
                        state=row.state,
                    ))
                await db.commit()
                return {
                    "draft_id": row.id,
                    "site_id": row.site_id,
                    "run_id": row.run_id,
                    "title": row.title,
                    "html": row.html_sanitized,
                    "sections": row.sections_json,
                    "sources": row.sources_json,
                    "version": row.version,
                    "state": row.state,
                }
        return self._execute(operation)

    def purge_report_revisions(self, site_id: str | None = None, keep_versions: int = 5) -> int:
        """Delete revisions older than the retention window, scoped by site."""
        if keep_versions < 1:
            raise ValueError("keep_versions must be at least 1")

        async def operation():
            async with async_session_factory() as db:
                statement = select(ReportDraftRevisionRecord).order_by(
                    ReportDraftRevisionRecord.draft_id,
                    ReportDraftRevisionRecord.version.desc(),
                )
                if site_id is not None:
                    statement = statement.where(ReportDraftRevisionRecord.site_id == site_id)
                revisions = (await db.execute(statement)).scalars().all()
                seen: dict[str, int] = {}
                stale_ids: list[str] = []
                for revision in revisions:
                    retained = seen.get(revision.draft_id, 0)
                    if retained < keep_versions:
                        seen[revision.draft_id] = retained + 1
                    else:
                        stale_ids.append(revision.id)
                if stale_ids:
                    await db.execute(delete(ReportDraftRevisionRecord).where(ReportDraftRevisionRecord.id.in_(stale_ids)))
                    await db.commit()
                return len(stale_ids)

        return self._execute(operation) or 0

    def save_approval(self, run_id: str, session_id: str, site_id: str, user_id: str, mode: str, tool_key: str) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                approval_id = f"approval-{_hash(f'{run_id}:{tool_key}')[:40]}"
                db.add(ApprovalRecord(id=approval_id, run_id=run_id, session_id=session_id, site_id=site_id, user_id=user_id, mode=mode, tool_key=tool_key, status="approved", expires_at=None, created_at=now, updated_at=now))
                await db.commit()
        self._execute(operation)

    def save_handoffs(self, run_id: str, site_id: str, user_id: str, sequence: list[str]) -> None:
        async def operation():
            async with async_session_factory() as db:
                now = _now()
                for index in range(1, len(sequence)):
                    handoff_id = f"handoff-{run_id}-{index}"
                    if await db.get(HandoffRecord, handoff_id) is None:
                        db.add(HandoffRecord(id=handoff_id, run_id=run_id, site_id=site_id, user_id=user_id, source_hat=sequence[index - 1], target_hat=sequence[index], sequence=index, created_at=now, updated_at=now))
                await db.commit()
        self._execute(operation)

    def load_memory_context(self, session_id: str, site_id: str, user_id: str, limit: int = 12) -> dict[str, Any] | None:
        async def operation():
            async with async_session_factory() as db:
                messages = (await db.execute(select(ChatMessage).where(ChatMessage.session_id == session_id, ChatMessage.site_id == site_id, ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.desc()).limit(limit))).scalars().all()
                memories = (await db.execute(select(MemoryItem).where(MemoryItem.site_id == site_id, MemoryItem.user_id == user_id, MemoryItem.status.in_(["candidate", "confirmed"])).order_by(MemoryItem.created_at.desc()).limit(limit))).scalars().all()
                preferences = (await db.execute(select(UserPreference).where(UserPreference.site_id == site_id, UserPreference.user_id == user_id, UserPreference.status == "active").order_by(UserPreference.preference_key, UserPreference.version.desc()))).scalars().all()
                return {"messages": [{"messageId": row.id, "role": row.role, "content": row.content_redacted, "createdAt": row.created_at.isoformat(), "runId": row.run_id} for row in reversed(messages)], "memories": [{"memory_id": row.id, "site_id": row.site_id, "user_id": row.user_id, "memory_type": row.memory_type, "content": row.content, "source_message_id": row.source_message_id, "status": row.status, "confidence": row.confidence, "created_at": row.created_at.isoformat()} for row in memories], "preferences": [{"userId": row.user_id, "siteId": row.site_id, "preferenceKey": row.preference_key, "value": (row.value_json or {}).get("value"), "source": row.source, "status": row.status, "version": row.version, "confidence": row.confidence, "updatedAt": row.updated_at.isoformat()} for row in preferences]}
        return self._execute(operation)
