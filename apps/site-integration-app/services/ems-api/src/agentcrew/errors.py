"""Typed errors shared by AgentCrew routing and policy boundaries."""

from enum import StrEnum


class AgentCrewErrorCode(StrEnum):
    SITE_CONTEXT_REQUIRED = "site_context_required"
    INVALID_SITE_ROUTE = "invalid_site_route"
    SITE_SCOPE_VIOLATION = "site_scope_violation"
    TOOL_APPROVAL_REQUIRED = "tool_approval_required"
    VALIDATION_FAILED = "validation_failed"
    RUN_INTERRUPTED = "run_interrupted"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    PROVIDER_OUTPUT_INVALID = "provider_output_invalid"
    PERSISTENCE_UNAVAILABLE = "persistence_unavailable"


class AgentCrewError(Exception):
    """An expected, user-safe AgentCrew boundary error."""

    def __init__(self, code: AgentCrewErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def as_dict(self) -> dict[str, str]:
        return {"code": self.code.value, "message": self.message}
