from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent.parent
PORT = 8100


@pytest.fixture(scope="session")
def base_url():
    for suffix in ["", "-journal", "-wal", "-shm"]:
        (ROOT / "data" / f"test-e2e.db{suffix}").unlink(missing_ok=True)
    shutil.rmtree(ROOT / "data" / "test-e2e-uploads", ignore_errors=True)

    env = {
        **os.environ,
        "DATABASE_URL": "file:./data/test-e2e.db",
        "UPLOAD_DIR": "./data/test-e2e-uploads",
        "SESSION_SECRET": "e2e-secret-not-for-production",
        "APP_DEMO_MODE": "false",
        "AI_MODE": "mock",
        "RUN_LIVE_AI_TESTS": "false",
        "MAINTENANCE_TOKEN": "test-maintenance-token",
    }
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
        cwd=ROOT,
        env=env,
    )
    for _ in range(120):
        try:
            socket.create_connection(("127.0.0.1", PORT), 1).close()
            break
        except OSError:
            time.sleep(0.5)
    else:
        process.terminate()
        raise RuntimeError("test server did not start")
    yield f"http://127.0.0.1:{PORT}"
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


@pytest.fixture()
def browser_page():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        yield page
        context.close()
        browser.close()