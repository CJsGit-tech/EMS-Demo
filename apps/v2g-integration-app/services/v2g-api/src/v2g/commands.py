"""Approval-gated, in-memory simulated V2G command state machine.

This module deliberately has no device, network, or database integration.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from typing import Callable, Literal
from uuid import uuid4

from v2g.dispatch import (
    CommandPolicyError,
    CommandRequest as DispatchCommandRequest,
    SiteState,
    validate_request,
)


CommandState = Literal[
    "requested",
    "validated",
    "awaiting_approval",
    "approved",
    "simulated",
    "rejected",
    "failed",
    "expired",
    "cancelled",
]

TERMINAL_STATES = frozenset({"simulated", "rejected", "failed", "expired", "cancelled"})


@dataclass(frozen=True)
class CommandRequest(DispatchCommandRequest):
    """A dispatch request carrying the metadata required for command control."""

    correlation_id: str = ""
    idempotency_key: str = ""


@dataclass(frozen=True)
class CommandAuditEvent:
    """An immutable local audit entry for one command state transition."""

    event_type: str
    occurred_at: datetime
    correlation_id: str
    from_state: CommandState | None
    to_state: CommandState
    actor: str | None = None
    reason: str | None = None


@dataclass(frozen=True)
class SimulatedCommand:
    """A command whose execution is represented only by its terminal state."""

    command_id: str
    request: CommandRequest
    state: CommandState
    created_at: datetime
    audit_events: tuple[CommandAuditEvent, ...] = ()
    approved_by: str | None = None
    rejection_reason: str | None = None

    @property
    def expires_at(self) -> datetime:
        return self.request.expires_at

    @property
    def correlation_id(self) -> str:
        return self.request.correlation_id

    @property
    def idempotency_key(self) -> str:
        return self.request.idempotency_key


class InMemoryCommandRepository:
    """Explicit local command state and idempotency indexes for this service only."""

    def __init__(self) -> None:
        self.commands: dict[str, SimulatedCommand] = {}
        self.command_ids_by_idempotency_key: dict[str, str] = {}
        self.lock = asyncio.Lock()

    def by_idempotency_key(self, key: str) -> SimulatedCommand | None:
        command_id = self.command_ids_by_idempotency_key.get(key)
        return self.commands.get(command_id) if command_id else None

    def get(self, command_id: str) -> SimulatedCommand | None:
        return self.commands.get(command_id)

    def reload(self, command_id: str) -> SimulatedCommand | None:
        """Return the current immutable snapshot for verification or recovery."""
        return self.get(command_id)

    def add(self, command: SimulatedCommand) -> None:
        self.commands[command.command_id] = command
        self.command_ids_by_idempotency_key[command.idempotency_key] = command.command_id

    def replace(self, command: SimulatedCommand) -> None:
        self.commands[command.command_id] = command


class CommandService:
    """Enforce validation and named approval before a simulated state change."""

    def __init__(
        self,
        site_state: SiteState,
        *,
        repository: InMemoryCommandRepository | None = None,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._site_state = site_state
        self._repository = repository or InMemoryCommandRepository()
        self._now = now or (lambda: datetime.now(UTC))

    async def request(self, request: CommandRequest) -> SimulatedCommand:
        """Validate and queue a simulator-only command for named approval."""
        self._require_expiry(request.expires_at)
        self._require_request_metadata(request)

        async with self._repository.lock:
            existing = self._repository.by_idempotency_key(request.idempotency_key)
            if existing is not None:
                return existing

            # Validate before allocating a command or recording its idempotency key.
            # A malformed runtime value must never poison a later valid retry.
            validate_request(request, self._site_state)

            command = SimulatedCommand(
                command_id=str(uuid4()),
                request=request,
                state="requested",
                created_at=self._timestamp(),
            )
            command = self._transition(command, "requested")
            self._repository.add(command)

            command = self._transition(command, "validated")
            command = self._transition(command, "awaiting_approval")
            self._repository.replace(command)
            return command

    async def reload(self, command_id: str) -> SimulatedCommand:
        """Load the latest immutable command snapshot from the injected repository."""
        async with self._repository.lock:
            command = self._repository.reload(command_id)
            if command is None:
                raise CommandPolicyError("unknown command")
            return command

    async def approve(self, command_id: str, actor: str) -> SimulatedCommand:
        """Record a named operator's approval for a non-expired command."""
        async with self._repository.lock:
            command = self._require_command(command_id)
            command = self._expire_if_needed(command)
            self._require_non_empty(actor, "actor")
            self._require_state(command, "awaiting_approval")
            approved = self._transition(command, "approved", actor=actor.strip())
            approved = replace(approved, approved_by=actor.strip())
            self._repository.replace(approved)
            return approved

    async def reject(self, command_id: str, actor: str, reason: str) -> SimulatedCommand:
        """Reject a pending command with a named actor and non-empty reason."""
        self._require_non_empty(reason, "reason")
        async with self._repository.lock:
            command = self._require_command(command_id)
            command = self._expire_if_needed(command)
            self._require_non_empty(actor, "actor")
            self._require_state(command, "awaiting_approval")
            rejected = self._transition(
                command,
                "rejected",
                actor=actor.strip(),
                reason=reason.strip(),
            )
            rejected = replace(rejected, rejection_reason=reason.strip())
            self._repository.replace(rejected)
            return rejected

    async def cancel(self, command_id: str, actor: str, reason: str) -> SimulatedCommand:
        """Cancel a pending or approved command with an operator-supplied reason."""
        self._require_non_empty(reason, "reason")
        async with self._repository.lock:
            command = self._require_command(command_id)
            command = self._expire_if_needed(command)
            self._require_non_empty(actor, "actor")
            if command.state not in {"awaiting_approval", "approved"}:
                raise CommandPolicyError(f"command cannot be cancelled from {command.state}")
            cancelled = self._transition(
                command,
                "cancelled",
                actor=actor.strip(),
                reason=reason.strip(),
            )
            self._repository.replace(cancelled)
            return cancelled

    async def execute_simulated(self, command_id: str) -> SimulatedCommand:
        """Represent execution solely by a simulated terminal-state transition."""
        async with self._repository.lock:
            command = self._require_command(command_id)
            command = self._expire_if_needed(command)
            self._require_state(command, "approved")
            simulated = self._transition(command, "simulated")
            self._repository.replace(simulated)
            return simulated

    def _expire_if_needed(self, command: SimulatedCommand) -> SimulatedCommand:
        if command.expires_at > self._timestamp():
            return command
        if command.state != "expired" and command.state not in TERMINAL_STATES:
            command = self._transition(command, "expired", reason="command expired")
            self._repository.replace(command)
        raise CommandPolicyError("command expired")

    def _transition(
        self,
        command: SimulatedCommand,
        state: CommandState,
        *,
        actor: str | None = None,
        reason: str | None = None,
    ) -> SimulatedCommand:
        event = CommandAuditEvent(
            event_type=f"command.{state}",
            occurred_at=self._timestamp(),
            correlation_id=command.correlation_id,
            from_state=None if not command.audit_events else command.state,
            to_state=state,
            actor=actor,
            reason=reason,
        )
        return replace(command, state=state, audit_events=(*command.audit_events, event))

    def _timestamp(self) -> datetime:
        value = self._now()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("command clock requires a timezone-aware timestamp")
        return value.astimezone(UTC)

    @staticmethod
    def _require_non_empty(value: str, field_name: str) -> None:
        if not isinstance(value, str) or not value.strip():
            raise CommandPolicyError(f"{field_name} is required")

    @staticmethod
    def _require_expiry(value: datetime | None) -> None:
        if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
            raise CommandPolicyError("expiry requires a timezone-aware timestamp")

    def _require_request_metadata(self, request: CommandRequest) -> None:
        self._require_non_empty(request.correlation_id, "correlation ID")
        self._require_non_empty(request.idempotency_key, "idempotency key")

    def _require_command(self, command_id: str) -> SimulatedCommand:
        command = self._repository.get(command_id)
        if command is None:
            raise CommandPolicyError("unknown command")
        return command

    @staticmethod
    def _require_state(command: SimulatedCommand, expected: CommandState) -> None:
        if command.state != expected:
            raise CommandPolicyError(
                f"command must be {expected} before this operation; current state is {command.state}"
            )
