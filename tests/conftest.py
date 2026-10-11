from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Isolated test database and upload directory (never touches user data).
for suffix in ["", "-journal", "-wal", "-shm"]:
    (ROOT / "data" / f"test-pytest.db{suffix}").unlink(missing_ok=True)
shutil.rmtree(ROOT / "data" / "test-pytest-uploads", ignore_errors=True)

os.environ["DATABASE_URL"] = "file:./data/test-pytest.db"
os.environ["UPLOAD_DIR"] = "./data/test-pytest-uploads"
os.environ["SESSION_SECRET"] = "pytest-secret-not-for-production"
os.environ["APP_DEMO_MODE"] = "false"
os.environ["AI_MODE"] = "mock"
os.environ["RUN_LIVE_AI_TESTS"] = "false"
os.environ["MAINTENANCE_TOKEN"] = "test-maintenance-token"

import pytest  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    from app.db import run_migrations

    run_migrations()
    yield