"""Start an isolated, mock-mode server for browser E2E tests (fresh DB + uploads).

Mirrors scripts/start-test-server.mjs from the reference implementation.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

PORT = int(os.environ.get("E2E_PORT", "8100"))

DATA = ROOT / "data"
for suffix in ["", "-journal", "-wal", "-shm"]:
    (DATA / f"test-e2e-py.db{suffix}").unlink(missing_ok=True)
shutil.rmtree(DATA / "test-e2e-py-uploads", ignore_errors=True)

os.environ.update(
    {
        "DATABASE_URL": "file:./data/test-e2e-py.db",
        "UPLOAD_DIR": "./data/test-e2e-py-uploads",
        "SESSION_SECRET": "e2e-py-secret-not-for-production",
        "APP_DEMO_MODE": "false",
        "AI_MODE": "mock",
        "RUN_LIVE_AI_TESTS": "false",
        "MAINTENANCE_TOKEN": "test-maintenance-token",
        # Tests must not depend on the external AMap service; use the local-first OSM renderer.
        "MAP_PROVIDER": "osm",
    }
)

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=PORT, log_level="warning")