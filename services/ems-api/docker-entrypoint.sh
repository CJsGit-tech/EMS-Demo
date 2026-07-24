#!/bin/sh
set -eu

export PYTHONPATH=/app/src

echo "Applying EMS database migrations..."
/app/.venv/bin/alembic upgrade head

echo "Loading deterministic synthetic EMS data..."
/app/.venv/bin/python -m agentcrew seed-ems --seed-version 3

exec /app/.venv/bin/uvicorn agentcrew.app:app --host 0.0.0.0 --port 8004
