"""Environment-backed service configuration."""

from dataclasses import dataclass
import os


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True, slots=True)
class Settings:
    api_host: str = os.getenv("EMS_API_HOST", "127.0.0.1")
    api_port: int = int(os.getenv("EMS_API_PORT", "8002"))
    mcp_host: str = os.getenv("EMS_MCP_HOST", "127.0.0.1")
    mcp_port: int = int(os.getenv("EMS_MCP_PORT", "8003"))
    internal_api_url: str = os.getenv("EMS_INTERNAL_API_URL", "http://127.0.0.1:8002")
    service_token: str = os.getenv("EMS_SERVICE_TOKEN", "local-ems-service-token")
    allowed_origins: tuple[str, ...] = tuple(_csv(os.getenv("EMS_ALLOWED_ORIGINS", "http://localhost:5175,http://127.0.0.1:5175")))
    allowed_headers: tuple[str, ...] = tuple(_csv(os.getenv("EMS_ALLOWED_HEADERS", "content-type,idempotency-key,x-correlation-id,x-ems-service-token,x-user-id")))
    provider_mode: str = os.getenv("EMS_PROVIDER_MODE", "openai" if os.getenv("OPENAI_API_KEY") else "deterministic-fixtures")
    # Fixture data is only a local/dev mode. Production resolves this default
    # to the database-backed EMS adapter and never silently falls back.
    mcp_gateway_mode: str = os.getenv("EMS_MCP_GATEWAY_MODE", "database" if os.getenv("DATABASE_URL") else "fixtures")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    database_url: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://ems:ems@127.0.0.1:5432/ems")
    db_pool_size: int = int(os.getenv("EMS_DB_POOL_SIZE", "5"))
    db_pool_mode: str = os.getenv("EMS_DB_POOL_MODE", "pool")
    persistence_mode: str = os.getenv("EMS_PERSISTENCE_MODE", "postgres" if os.getenv("DATABASE_URL") else "memory")


settings = Settings()
