# Task 2C — Async Alembic Migration Repair Report

## Delivered

- Converted Alembic's online runner to `async_engine_from_config` with a
  `connection.run_sync(do_run_migrations)` bridge and guaranteed engine disposal.
- Preserved the existing SQLite URL form by selecting the installed
  `sqlite+aiosqlite` dialect for the same configured SQLite database path.
- Changed PostgreSQL audit setup to run the production `alembic upgrade head`
  CLI with `DATABASE_URL` set to the exact `V2G_TEST_DATABASE_URL` before every
  audit assertion.

## Verification

- Red: the new PostgreSQL test failed before the repair with Alembic exit code
  1 and `sqlalchemy.exc.MissingGreenlet` from the synchronous online runner.
- Portable V2G suite: `10 passed, 3 skipped`.
- SQLite compatibility: `DATABASE_URL=sqlite:////private/tmp/v2g-task2c-async.sqlite ./.venv/bin/alembic upgrade head` exited 0.
- Disposable PostgreSQL suite using a local `v2g_test` instance and
  `postgresql+asyncpg://…`: `3 passed`.

## Scope and concerns

- Only Task 2C's migration environment, audit integration test, and this report
  were changed.
- The local disposable PostgreSQL container is used solely for verification and
  should be removed after the task.

## Review Finding Closure

- Escaped percent signs when injecting `DATABASE_URL` into Alembic's
  `ConfigParser`, preserving exact `%40` credentials for SQLAlchemy while
  retaining the async PostgreSQL and SQLite migration paths.
- Added `tests/test_migrations_env.py`, which runs the real Alembic environment
  with a percent-encoded `postgresql+asyncpg` URL in offline mode.
- Verification: targeted migration regression plus repository tests: `4 passed`;
  SQLite online migration exited 0.
