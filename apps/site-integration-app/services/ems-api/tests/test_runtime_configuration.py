"""Regression coverage for the production AgentCrew runtime defaults."""

import importlib

import agentcrew.config as config


def test_runtime_defaults_require_explicit_fixture_mode(monkeypatch):
    """A missing environment must not silently turn the Copilot into fixtures."""
    with monkeypatch.context() as environment:
        for name in (
            "OPENAI_API_KEY",
            "OPENAI_MODEL",
            "EMS_PROVIDER_MODE",
            "EMS_MCP_GATEWAY_MODE",
            "EMS_PERSISTENCE_MODE",
            "DATABASE_URL",
        ):
            environment.delenv(name, raising=False)

        isolated = importlib.reload(config)

        assert isolated.settings.provider_mode == "openai"
        assert isolated.settings.openai_model == "gpt-5-mini"
        assert isolated.settings.mcp_gateway_mode == "database"
        assert isolated.settings.persistence_mode == "postgres"

    importlib.reload(config)


def test_fixture_modes_remain_an_explicit_test_or_demo_opt_in(monkeypatch):
    with monkeypatch.context() as environment:
        environment.setenv("EMS_PROVIDER_MODE", "deterministic-fixtures")
        environment.setenv("EMS_MCP_GATEWAY_MODE", "fixtures")
        environment.setenv("EMS_PERSISTENCE_MODE", "memory")

        isolated = importlib.reload(config)

        assert isolated.settings.provider_mode == "deterministic-fixtures"
        assert isolated.settings.mcp_gateway_mode == "fixtures"
        assert isolated.settings.persistence_mode == "memory"

    importlib.reload(config)
