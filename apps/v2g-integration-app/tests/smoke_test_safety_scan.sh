#!/usr/bin/env bash
set -euo pipefail

app_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_script="$app_root/scripts/smoke_test_v2g_stack.sh"
real_rg="$(command -v rg)"
test_root="$(mktemp -d "${TMPDIR:-/tmp}/v2g-smoke-safety.XXXXXX")"

cleanup() {
  if [[ -n "${test_root:-}" && -d "$test_root" ]]; then
    rm -rf -- "$test_root"
  fi
}
trap cleanup EXIT

project_root="$test_root/project"
fake_bin="$test_root/bin"
mkdir -p "$project_root/scripts" "$project_root/services/v2g-api/src" "$fake_bin"
cp "$source_script" "$project_root/scripts/smoke_test_v2g_stack.sh"

printf '%s\n' '#!/bin/sh' 'exit 0' >"$fake_bin/docker"
printf '%s\n' \
  '#!/bin/sh' \
  "printf '%s\\n' '{\"status\":\"ok\",\"site_id\":\"demo-v2g-site\"} V2G SCADA'" \
  >"$fake_bin/curl"
chmod +x "$fake_bin/docker" "$fake_bin/curl"
ln -s "$real_rg" "$fake_bin/rg"

run_smoke() {
  local path_value="$1"
  if smoke_output="$(PATH="$path_value" /bin/bash "$project_root/scripts/smoke_test_v2g_stack.sh" 2>&1)"; then
    smoke_status=0
  else
    smoke_status=$?
  fi
}

assert_scan_rejects() {
  local source_pattern="$1"
  printf '# harmless source-scan fixture: %s\n' "$source_pattern" \
    >"$project_root/services/v2g-api/src/transport_fixture.py"

  run_smoke "$fake_bin:/usr/bin:/bin"

  if [[ "$smoke_status" -eq 0 ]]; then
    printf 'Expected safety scan to reject %s, but smoke passed.\nOutput:\n%s\n' \
      "$source_pattern" "$smoke_output" >&2
    return 1
  fi
  [[ "$smoke_output" == *"$source_pattern"* ]]
  [[ "$smoke_output" == *'External-control transport pattern found in simulator API source.'* ]]
}

for source_pattern in 'socket.connect' 'requests.post' 'requests.put'; do
  assert_scan_rejects "$source_pattern"
done

: >"$project_root/services/v2g-api/src/transport_fixture.py"
rm "$fake_bin/rg"
run_smoke "$fake_bin:/usr/bin:/bin"

if [[ "$smoke_status" -eq 0 ]]; then
  printf 'Expected smoke to fail closed without rg, but it passed.\nOutput:\n%s\n' \
    "$smoke_output" >&2
  exit 1
fi
[[ "$smoke_output" == *"Required safety scanner 'rg' is unavailable; refusing to run the V2G smoke test."* ]]

printf 'Safety scan regression checks passed.\n'
