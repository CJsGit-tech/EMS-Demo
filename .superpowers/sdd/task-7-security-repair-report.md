## Task 7 Security Repair: DB role separation and non-root UI

### Delivered

- Added a one-shot `migrator` service. It connects as the non-superuser
  `v2g_owner`, runs Alembic, seeds the deterministic fleet, and reapplies the
  runtime grants before the API may start.
- The long-running API now connects only as `v2g_runtime`. The owner and
  runtime roles are created during fresh local-volume initialization; the
  database remains internal-only.
- Runtime access is limited to normal simulator data plus `SELECT`/`INSERT` on
  `audit_records`. `UPDATE`, `DELETE`, and `TRUNCATE` are explicitly revoked;
  the table remains owned by `v2g_owner` rather than the API identity.
- The React UI now runs Nginx as the image's `nginx` user on port 8080. Nginx
  stores its PID and every temporary-path class under the writable `/tmp`
  tmpfs, so its root filesystem remains read-only and no root master/runtime is
  required.
- API and UI publications remain loopback-only. Optional
  `V2G_API_HOST_PORT` and `V2G_UI_HOST_PORT` preserve defaults 8005 and 5181
  while making an isolated smoke run reproducible when those ports are busy.

### Verification

Executed from `apps/v2g-integration-app`:

```text
python -m pytest services/v2g-api/tests/test_task7_infrastructure_security.py -q
3 passed

docker compose config --quiet
exit 0

V2G_API_HOST_PORT=8015 V2G_UI_HOST_PORT=5182 \
  docker compose --project-name v2g-task7-security --file docker-compose.yml \
  up --build --wait --wait-timeout 120 -d
postgres healthy; migrator exited 0; api healthy; v2g-scada healthy

V2G_COMPOSE_PROJECT=v2g-task7-security V2G_API_HOST_PORT=8015 \
  V2G_UI_HOST_PORT=5182 ./scripts/smoke_test_v2g_stack.sh
V2G simulator smoke passed: API healthy, demo overview returned, UI HTTP 200.

docker compose --project-name v2g-task7-security --file docker-compose.yml \
  exec -T v2g-scada id
uid=101(nginx) gid=101(nginx) groups=101(nginx)

docker compose --project-name v2g-task7-security --file docker-compose.yml \
  exec -T api id
uid=1000(v2g) gid=1000(v2g) groups=1000(v2g)

runtime audit proof:
current_user | audit_owner | can_update | can_delete
v2g_runtime  | v2g_owner   | f          | f
INSERT 0 1
UPDATE public.audit_records ...
ERROR: permission denied for table audit_records (exit 1)
DELETE FROM public.audit_records ...
ERROR: permission denied for table audit_records (exit 1)

docker run --rm -v "$PWD:/workspace" -w /workspace/services/v2g-api \
  -e PYTHONPATH=/workspace/services/v2g-api/src --user 1000:1000 \
  v2g-task7-security-api pytest -q
55 passed, 3 skipped, 2 warnings
```

### Local-volume note

PostgreSQL init scripts run only for a new data volume. A pre-repair local
volume created with the old single `v2g_simulator` role must be reset with the
project's teardown command (including `--volumes`) before first use of this
role-separated stack. This is limited to the simulator's disposable local
data; no real integration or external system is involved.
