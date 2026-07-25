"""Pure, simulator-only V2G dispatch recommendations and policy checks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import isfinite


class CommandPolicyError(ValueError):
    """Raised when a requested dispatch violates a configured site policy."""


@dataclass(frozen=True)
class SiteState:
    """The site inputs used by the advisory dispatch engine."""

    site_id: str
    soc_percent: float
    minimum_departure_soc_percent: float
    available_flexible_kw: float
    observed_at: datetime

    @property
    def minimum_ev_soc(self) -> float:
        """Compatibility name for the minimum departure SOC policy."""
        return self.minimum_departure_soc_percent


@dataclass(frozen=True)
class CommandRequest:
    """A signed simulator request; negative ``power_kw`` means discharge."""

    site_id: str
    power_kw: float
    projected_soc_percent: float
    expires_at: datetime

    @property
    def projected_soc(self) -> float:
        return self.projected_soc_percent


@dataclass(frozen=True)
class DispatchRecommendation:
    """An advisory result; it contains no executable device operation."""

    site_id: str
    expected_site_impact_kw: float
    expires_at: datetime
    assumptions: tuple[str, ...]
    constraints: tuple[str, ...]
    confidence: float
    status: str
    reason: str

    @property
    def impact_kw(self) -> float:
        return self.expected_site_impact_kw


def _require_timezone_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} requires a timezone-aware timestamp")


def _require_finite_numeric(value: float, field_name: str) -> None:
    if not isfinite(value):
        raise CommandPolicyError(f"non-finite numeric value: {field_name}")


def validate_request(request: CommandRequest, state: SiteState) -> None:
    """Validate a signed request against the supplied simulated site state."""
    _require_timezone_aware(request.expires_at, "request.expires_at")
    _require_timezone_aware(state.observed_at, "state.observed_at")

    if request.site_id != state.site_id:
        raise CommandPolicyError("site mismatch")

    for value, field_name in (
        (request.power_kw, "request.power_kw"),
        (request.projected_soc_percent, "request.projected_soc_percent"),
        (state.soc_percent, "state.soc_percent"),
        (state.minimum_departure_soc_percent, "state.minimum_departure_soc_percent"),
        (state.available_flexible_kw, "state.available_flexible_kw"),
    ):
        _require_finite_numeric(value, field_name)

    if abs(request.power_kw) > state.available_flexible_kw:
        raise CommandPolicyError("insufficient flexible capacity")
    if request.power_kw < 0 and request.projected_soc_percent < state.minimum_departure_soc_percent:
        raise CommandPolicyError("departure SOC violation")


def build_recommendation(site_state: SiteState) -> DispatchRecommendation:
    """Build a short-lived, simulator-only recommendation from site state."""
    _require_timezone_aware(site_state.observed_at, "site_state.observed_at")
    for value, field_name in (
        (site_state.soc_percent, "site_state.soc_percent"),
        (site_state.minimum_departure_soc_percent, "site_state.minimum_departure_soc_percent"),
        (site_state.available_flexible_kw, "site_state.available_flexible_kw"),
    ):
        _require_finite_numeric(value, field_name)

    if site_state.available_flexible_kw < 0:
        raise ValueError("available_flexible_kw must not be negative")

    expires_at = site_state.observed_at.astimezone(UTC) + timedelta(minutes=15)
    return DispatchRecommendation(
        site_id=site_state.site_id,
        expected_site_impact_kw=round(site_state.available_flexible_kw, 3),
        expires_at=expires_at,
        assumptions=(
            "Telemetry is representative of the simulated site at observed_at.",
            "Flexible capacity remains available until expiry.",
        ),
        constraints=(
            f"Flexible capacity <= {site_state.available_flexible_kw:g} kW.",
            f"Departure SOC >= {site_state.minimum_departure_soc_percent:g}%.",
        ),
        confidence=1.0,
        status="proposed",
        reason="Simulator-only advisory recommendation; no device or network action is performed.",
    )
