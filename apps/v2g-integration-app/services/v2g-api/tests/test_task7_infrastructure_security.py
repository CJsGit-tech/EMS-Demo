"""Regression checks for Task 7 local-stack security boundaries."""

from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[3]


def test_compose_separates_owner_migration_from_runtime_api_access() -> None:
    compose = (APP_ROOT / "docker-compose.yml").read_text()

    assert "POSTGRES_USER: postgres" in compose
    assert "migrator:" in compose
    assert "alembic upgrade head" in compose
    assert "python -m v2g.bootstrap" in compose
    assert "v2g_runtime" in compose
    assert "v2g_owner" in compose
    assert "condition: service_completed_successfully" in compose
    assert '"127.0.0.1:${V2G_API_HOST_PORT:-8005}:8000"' in compose


def test_runtime_grants_preserve_append_only_audit_protection() -> None:
    bootstrap = (APP_ROOT / "services/v2g-api/src/v2g/bootstrap.py").read_text()
    roles = (APP_ROOT / "scripts/postgres-init/01-v2g-roles.sql").read_text()

    assert "GRANT SELECT, INSERT ON TABLE audit_records TO v2g_runtime" in bootstrap
    assert "REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_records FROM v2g_runtime" in bootstrap
    assert "GRANT USAGE, CREATE ON SCHEMA public TO v2g_owner WITH GRANT OPTION" in roles


def test_ui_runs_nginx_unprivileged_on_a_high_port() -> None:
    dockerfile = (APP_ROOT / "Dockerfile").read_text()
    nginx = (APP_ROOT / "nginx.conf").read_text()
    compose = (APP_ROOT / "docker-compose.yml").read_text()

    assert "USER nginx" in dockerfile
    assert "EXPOSE 8080" in dockerfile
    assert "listen 8080;" in nginx
    assert "pid /tmp/nginx.pid;" in nginx
    assert "fastcgi_temp_path /tmp/fastcgi_temp;" in nginx
    assert "uwsgi_temp_path /tmp/uwsgi_temp;" in nginx
    assert "scgi_temp_path /tmp/scgi_temp;" in nginx
    assert '"127.0.0.1:${V2G_UI_HOST_PORT:-5181}:8080"' in compose
