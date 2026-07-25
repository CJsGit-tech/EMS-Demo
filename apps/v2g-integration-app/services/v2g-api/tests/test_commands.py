import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from v2g.commands import (
    CommandPolicyError,
    CommandRequest,
    CommandService,
    InMemoryCommandRepository,
)
from v2g.dispatch import SiteState


NOW = datetime(2026, 7, 25, 12, 0, tzinfo=UTC)


def site_state(**overrides):
    values = {
        "site_id": "demo-v2g-site",
        "soc_percent": 80.0,
        "minimum_departure_soc_percent": 30.0,
        "available_flexible_kw": 25.0,
        "observed_at": NOW,
    }
    values.update(overrides)
    return SiteState(**values)


def valid_request(**overrides):
    values = {
        "site_id": "demo-v2g-site",
        "power_kw": 10.0,
        "projected_soc_percent": 70.0,
        "expires_at": NOW + timedelta(minutes=15),
        "correlation_id": "corr-001",
        "idempotency_key": "idem-001",
    }
    values.update(overrides)
    return CommandRequest(**values)


def service(repository: InMemoryCommandRepository | None = None) -> CommandService:
    return CommandService(site_state(), repository=repository, now=lambda: NOW)


def test_expired_command_cannot_be_approved():
    async def scenario():
        commands = service()
        command = await commands.request(valid_request(expires_at=NOW - timedelta(minutes=1)))

        with pytest.raises(CommandPolicyError, match="expired"):
            await commands.approve(command.command_id, actor="operator-01")

    asyncio.run(scenario())


def test_same_idempotency_key_returns_the_original_command():
    async def scenario():
        commands = service()
        first = await commands.request(valid_request())
        second = await commands.request(valid_request(correlation_id="corr-retry"))

        assert second == first
        assert second.command_id == first.command_id
        assert second.correlation_id == "corr-001"

    asyncio.run(scenario())


def test_approved_command_has_a_complete_state_and_audit_sequence():
    async def scenario():
        commands = service()
        command = await commands.request(valid_request())
        approved = await commands.approve(command.command_id, actor="operator-01")
        simulated = await commands.execute_simulated(approved.command_id)

        assert simulated.state == "simulated"
        assert [event.event_type for event in simulated.audit_events] == [
            "command.requested",
            "command.validated",
            "command.awaiting_approval",
            "command.approved",
            "command.simulated",
        ]
        assert simulated.audit_events[-2].actor == "operator-01"

    asyncio.run(scenario())


def test_rejection_requires_a_non_empty_reason():
    async def scenario():
        commands = service()
        command = await commands.request(valid_request())

        with pytest.raises(CommandPolicyError, match="reason"):
            await commands.reject(command.command_id, actor="operator-01", reason="   ")

        assert command.state == "awaiting_approval"

    asyncio.run(scenario())


def test_rejection_persists_the_terminal_state_and_audit_sequence():
    async def scenario():
        repository = InMemoryCommandRepository()
        commands = service(repository)
        command = await commands.request(valid_request())

        await commands.reject(command.command_id, actor="operator-01", reason="operator review")

        persisted = await commands.reload(command.command_id)
        assert persisted.state == "rejected"
        assert persisted.rejection_reason == "operator review"
        assert [event.event_type for event in persisted.audit_events] == [
            "command.requested",
            "command.validated",
            "command.awaiting_approval",
            "command.rejected",
        ]
        assert [event.from_state for event in persisted.audit_events] == [
            None,
            "requested",
            "validated",
            "awaiting_approval",
        ]
        assert persisted.audit_events[-1].actor == "operator-01"
        assert persisted.audit_events[-1].reason == "operator review"

    asyncio.run(scenario())


def test_cancellation_requires_a_non_empty_reason():
    async def scenario():
        commands = service()
        command = await commands.request(valid_request())

        with pytest.raises(CommandPolicyError, match="reason"):
            await commands.cancel(command.command_id, actor="operator-01", reason="")

        assert command.state == "awaiting_approval"

    asyncio.run(scenario())


def test_cancellation_persists_the_terminal_state_and_audit_sequence():
    async def scenario():
        repository = InMemoryCommandRepository()
        commands = service(repository)
        command = await commands.request(valid_request())
        await commands.approve(command.command_id, actor="operator-01")

        await commands.cancel(command.command_id, actor="operator-02", reason="superseded")

        persisted = await commands.reload(command.command_id)
        assert persisted.state == "cancelled"
        assert [event.event_type for event in persisted.audit_events] == [
            "command.requested",
            "command.validated",
            "command.awaiting_approval",
            "command.approved",
            "command.cancelled",
        ]
        assert persisted.audit_events[-1].actor == "operator-02"
        assert persisted.audit_events[-1].reason == "superseded"

    asyncio.run(scenario())


def test_execution_is_refused_until_the_command_is_approved():
    async def scenario():
        commands = service()
        command = await commands.request(valid_request())

        with pytest.raises(CommandPolicyError, match="approved"):
            await commands.execute_simulated(command.command_id)

        assert command.state == "awaiting_approval"

    asyncio.run(scenario())


def test_request_rejects_a_missing_expiry_as_a_policy_error():
    async def scenario():
        with pytest.raises(CommandPolicyError, match="expiry"):
            await service().request(valid_request(expires_at=None))

    asyncio.run(scenario())


def test_request_requires_correlation_and_idempotency_identifiers():
    async def scenario():
        with pytest.raises(CommandPolicyError, match="correlation"):
            await service().request(valid_request(correlation_id=""))

        with pytest.raises(CommandPolicyError, match="idempotency"):
            await service().request(valid_request(idempotency_key=""))

    asyncio.run(scenario())


def test_expiry_persists_terminal_state_and_audit_sequence():
    async def scenario():
        repository = InMemoryCommandRepository()
        commands = service(repository)
        command = await commands.request(valid_request(expires_at=NOW - timedelta(minutes=1)))

        with pytest.raises(CommandPolicyError, match="expired"):
            await commands.approve(command.command_id, actor="operator-01")

        persisted = await commands.reload(command.command_id)
        assert persisted.state == "expired"
        assert [event.event_type for event in persisted.audit_events] == [
            "command.requested",
            "command.validated",
            "command.awaiting_approval",
            "command.expired",
        ]
        assert persisted.audit_events[-1].reason == "command expired"

    asyncio.run(scenario())


@pytest.mark.parametrize("bad_power", [float("nan"), "10", True])
def test_invalid_numeric_request_is_not_persisted_and_does_not_poison_retry(bad_power):
    async def scenario():
        repository = InMemoryCommandRepository()
        commands = service(repository)
        malformed = valid_request(power_kw=bad_power)

        with pytest.raises(CommandPolicyError, match="numeric value"):
            await commands.request(malformed)

        assert repository.by_idempotency_key(malformed.idempotency_key) is None

        retry = await commands.request(valid_request(power_kw=10.0))
        persisted = await commands.reload(retry.command_id)
        assert persisted.state == "awaiting_approval"
        assert [event.event_type for event in persisted.audit_events] == [
            "command.requested",
            "command.validated",
            "command.awaiting_approval",
        ]

    asyncio.run(scenario())


def test_concurrent_requests_with_the_same_idempotency_key_create_one_command():
    async def scenario():
        repository = InMemoryCommandRepository()
        commands = service(repository)

        first, second = await asyncio.gather(
            commands.request(valid_request()),
            commands.request(valid_request(correlation_id="corr-concurrent")),
        )

        assert first.command_id == second.command_id
        assert len(repository.commands) == 1
        persisted = await commands.reload(first.command_id)
        assert [event.event_type for event in persisted.audit_events] == [
            "command.requested",
            "command.validated",
            "command.awaiting_approval",
        ]

    asyncio.run(scenario())
