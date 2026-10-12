from __future__ import annotations

import base64
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
        # Never depend on the external AMap service inside automated tests.
        "MAP_PROVIDER": "osm",
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


# 1x1 transparent PNG: served in place of real map tiles so page loads never depend on
# an external tile service (the real map is covered by dedicated smoke scripts instead).
_TILE_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _block_external_tiles(page) -> None:
    for pattern in ("**/tile.openstreetmap.org/**", "**/webapi.amap.com/**", "**/*.is.autonavi.com/**"):
        page.route(
            pattern,
            lambda route: route.fulfill(status=200, content_type="image/png", body=_TILE_PNG),
        )


@pytest.fixture()
def browser_page():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context()
        page = context.new_page()
        _block_external_tiles(page)
        yield page
        context.close()
        browser.close()