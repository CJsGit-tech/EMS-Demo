"""Bounded, replayable Server-Sent Event support for the local simulator."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.responses import StreamingResponse

from v2g.commands import SimulatedCommand


class EventEnvelope(BaseModel):
    """The only event body exposed by the SSE endpoint."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    type: str = Field(min_length=1, max_length=128)
    occurred_at: datetime
    correlation_id: str = Field(min_length=1, max_length=128)
    payload: dict[str, Any]

    @field_validator("occurred_at")
    @classmethod
    def timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("occurred_at must include a timezone")
        return value.astimezone(UTC)


@dataclass(frozen=True)
class StoredEvent:
    event_id: int
    envelope: EventEnvelope


class EventJournal:
    """A finite in-memory replay window; it never waits on external producers."""

    def __init__(self, capacity: int = 256) -> None:
        if capacity < 1:
            raise ValueError("event capacity must be positive")
        self._events: deque[StoredEvent] = deque(maxlen=capacity)
        self._published_command_states: deque[tuple[str, str]] = deque(maxlen=capacity)
        self._next_event_id = 1

    def publish(self, envelope: EventEnvelope) -> StoredEvent:
        event = StoredEvent(event_id=self._next_event_id, envelope=envelope)
        self._next_event_id += 1
        self._events.append(event)
        return event

    def publish_command(self, command: SimulatedCommand) -> StoredEvent | None:
        """Publish one public event per observed command state, including retries only once."""
        state_key = (command.command_id, command.state)
        if state_key in self._published_command_states:
            return None
        self._published_command_states.append(state_key)
        audit = command.audit_events[-1]
        return self.publish(
            EventEnvelope(
                type=audit.event_type,
                occurred_at=audit.occurred_at,
                correlation_id=command.correlation_id,
                payload={
                    "command_id": command.command_id,
                    "site_id": command.request.site_id,
                    "state": command.state,
                    "power_kw": command.request.power_kw,
                    "expires_at": command.expires_at.isoformat(),
                    "actor": audit.actor,
                    "reason": audit.reason,
                },
            )
        )

    def after(self, last_event_id: int) -> tuple[StoredEvent, ...]:
        return tuple(event for event in self._events if event.event_id > last_event_id)


def format_sse(event: StoredEvent) -> str:
    """Format a complete SSE message without exposing the journal's internal fields."""
    data = json.dumps(event.envelope.model_dump(mode="json"), separators=(",", ":"))
    return f"id: {event.event_id}\nevent: {event.envelope.type}\ndata: {data}\n\n"


def event_stream_response(events: tuple[StoredEvent, ...]) -> StreamingResponse:
    """Return a finite snapshot so clients reconnect with their last received event ID."""
    return StreamingResponse(
        (format_sse(event) for event in events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
