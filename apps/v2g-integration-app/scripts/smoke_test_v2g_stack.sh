#!/usr/bin/env bash
set -euo pipefail

project_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
project_name="${V2G_COMPOSE_PROJECT:-v2g-local-simulator}"
timeout_seconds="${V2G_SMOKE_TIMEOUT_SECONDS:-90}"
api_host_port="${V2G_API_HOST_PORT:-8005}"
ui_host_port="${V2G_UI_HOST_PORT:-5181}"
compose=(docker compose --project-name "$project_name" --file "$project_root/docker-compose.yml")

if [[ "${1:-}" == "--teardown" ]]; then
  exec "${compose[@]}" down --volumes --remove-orphans
fi

if [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--teardown]" >&2
  exit 2
fi

# Compose waits on declared health checks; it does not use a time-based sleep.
"${compose[@]}" up --wait --no-recreate --wait-timeout "$timeout_seconds"

health="$(curl --fail --silent --show-error "http://127.0.0.1:${api_host_port}/healthz")"
overview="$(curl --fail --silent --show-error "http://127.0.0.1:${api_host_port}/api/v1/sites/demo-v2g-site/overview")"
analytics="$(curl --fail --silent --show-error "http://127.0.0.1:${api_host_port}/api/v1/sites/demo-v2g-site/analytics?from=2026-07-24T00:00:00Z&to=2026-07-26T00:00:00Z")"
diagnostics="$(curl --fail --silent --show-error "http://127.0.0.1:${api_host_port}/api/v1/sites/demo-v2g-site/diagnostics")"
ui="$(curl --fail --silent --show-error "http://127.0.0.1:${ui_host_port}/")"

[[ "$health" == *'"status":"ok"'* ]]
[[ "$overview" == *'"site_id":"demo-v2g-site"'* ]]
[[ "$analytics" == *'"site_id":"demo-v2g-site"'* ]]
[[ "$diagnostics" == *'"site_id":"demo-v2g-site"'* ]]
[[ "$ui" == *'V2G SCADA'* ]]

# OCPP-shaped local event names are intentional; external control transports
# are not. Fail closed if the simulator API acquires one of these patterns.
if rg --line-number --pcre2 'websocket|socket\\.connect|requests\\.(post|put)' "$project_root/services/v2g-api/src"; then
  echo "External-control transport pattern found in simulator API source." >&2
  exit 1
fi

printf 'V2G simulator smoke passed: API healthy; demo overview, analytics, and diagnostics returned; UI identifies V2G SCADA; no external-control transport pattern found.\n'
