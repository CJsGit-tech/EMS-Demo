from datetime import UTC, datetime, timedelta

import pytest

from v2g.dispatch import (
    CommandPolicyError,
    CommandRequest,
    SiteState,
    build_recommendation,
    validate_request,
)


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


def request(**overrides):
    values = {
        "site_id": "demo-v2g-site",
        "power_kw": 10.0,
        "projected_soc_percent": 70.0,
        "expires_at": NOW + timedelta(minutes=15),
    }
    values.update(overrides)
    return CommandRequest(**values)


def test_build_recommendation_returns_advisory_site_impact_and_guardrails():
    recommendation = build_recommendation(site_state())

    assert recommendation.site_id == "demo-v2g-site"
    assert recommendation.expected_site_impact_kw == 25.0
    assert recommendation.expires_at > NOW
    assert recommendation.assumptions
    assert recommendation.constraints
    assert recommendation.confidence == 1.0
    assert recommendation.status == "proposed"
    assert "simulator" in recommendation.reason.lower()


def test_validate_request_rejects_magnitude_above_flexible_capacity():
    with pytest.raises(CommandPolicyError, match="insufficient flexible capacity"):
        validate_request(request(power_kw=-26.0), site_state())


def test_validate_request_rejects_discharge_below_departure_soc():
    with pytest.raises(CommandPolicyError, match="departure SOC violation"):
        validate_request(
            request(power_kw=-10.0, projected_soc_percent=29.9),
            site_state(),
        )
