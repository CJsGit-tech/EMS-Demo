import sys
import asyncio
import json

from .mcp_server import run as run_mcp
from .config import settings
from ems.db import create_ems_session_factory
from ems.seed import seed_ems
from .persistence import DurableRepository


def main(argv: list[str] | None = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "mcp":
        run_mcp()
    elif argv and argv[0] == "seed-ems":
        seed_version = int(argv[argv.index("--seed-version") + 1]) if "--seed-version" in argv else 3
        session_factory = create_ems_session_factory()[1] if settings.persistence_mode.lower() == "postgres" else None
        print(asyncio.run(seed_ems(session_factory=session_factory, seed_version=seed_version)).model_dump_json())
    elif argv and argv[0] == "purge-report-revisions":
        if settings.persistence_mode.lower() != "postgres":
            raise SystemExit("purge-report-revisions requires EMS_PERSISTENCE_MODE=postgres.")
        site_id = argv[argv.index("--site-id") + 1] if "--site-id" in argv else None
        keep_versions = int(argv[argv.index("--keep-versions") + 1]) if "--keep-versions" in argv else 5
        if keep_versions < 1:
            raise SystemExit("--keep-versions must be at least 1.")
        purged = DurableRepository().purge_report_revisions(site_id=site_id, keep_versions=keep_versions)
        print(json.dumps({"site_id": site_id, "keep_versions": keep_versions, "purged": purged}, sort_keys=True))
    else:
        raise SystemExit("Use uvicorn agentcrew.app:app, python -m agentcrew mcp, python -m agentcrew seed-ems [--seed-version 3], or python -m agentcrew purge-report-revisions [--site-id SITE] [--keep-versions N].")


if __name__ == "__main__":
    main()
