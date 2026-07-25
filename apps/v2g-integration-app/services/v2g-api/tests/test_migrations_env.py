from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_alembic_accepts_percent_encoded_async_postgresql_url() -> None:
    environment = os.environ.copy()
    environment["DATABASE_URL"] = "postgresql+asyncpg://migration:p%40ssword@localhost/v2g"

    result = subprocess.run(
        [str(Path(sys.executable).with_name("alembic")), "upgrade", "head", "--sql"],
        cwd=PROJECT_ROOT,
        env=environment,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "CREATE TABLE evses" in result.stdout
