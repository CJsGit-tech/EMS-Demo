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
ui_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:${ui_host_port}/")"

[[ "$health" == *'"status":"ok"'* ]]
[[ "$overview" == *'"site_id":"demo-v2g-site"'* ]]
[[ "$ui_status" == "200" ]]

printf 'V2G simulator smoke passed: API healthy, demo overview returned, UI HTTP %s.\n' "$ui_status"
