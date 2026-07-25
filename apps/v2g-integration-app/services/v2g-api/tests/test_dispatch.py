from datetime import UTC, datetime, timedelta
from math import inf, nan

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


@pytest.mark.parametrize(
    ("request_overrides", "state_overrides", "error_message"),
    [
        ({"power_kw": nan}, {}, "non-finite numeric value: request.power_kw"),
        ({"power_kw": inf}, {}, "non-finite numeric value: request.power_kw"),
        ({"power_kw": "25"}, {}, "invalid numeric value: request.power_kw"),
        ({"power_kw": True}, {}, "invalid numeric value: request.power_kw"),
        ({"projected_soc_percent": nan}, {}, "non-finite numeric value: request.projected_soc_percent"),
        ({}, {"soc_percent": nan}, "non-finite numeric value: state.soc_percent"),
        ({}, {"minimum_departure_soc_percent": nan}, "non-finite numeric value: state.minimum_departure_soc_percent"),
        ({}, {"available_flexible_kw": nan}, "non-finite numeric value: state.available_flexible_kw"),
    ],
)
def test_validate_request_rejects_non_finite_numeric_values(
    request_overrides, state_overrides, error_message
):
    with pytest.raises(CommandPolicyError, match=error_message):
        validate_request(request(**request_overrides), site_state(**state_overrides))


def test_build_recommendation_rejects_non_finite_numeric_state():
    with pytest.raises(
        CommandPolicyError,
        match="non-finite numeric value: site_state.available_flexible_kw",
    ):
        build_recommendation(site_state(available_flexible_kw=nan))
