"""Environment self-check. Writes artifacts/environment.json (Python reimplementation)."""

from __future__ import annotations

import json
import socket
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import ROOT, is_ai_live_configured, settings  # noqa: E402
from app.db import database_path, upload_dir  # noqa: E402

checks: list[dict] = []


def add(name: str, ok: bool, detail: str, critical: bool = True) -> None:
    checks.append({"name": name, "ok": ok, "detail": detail, "critical": critical})


def writable(path: Path) -> bool:
    try:
        path.mkdir(parents=True, exist_ok=True)
        probe = path / f".doctor-{hash(str(path)) & 0xFFFF}.tmp"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        return True
    except OSError:
        return False


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1.0)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def main() -> int:
    add("python", sys.version_info >= (3, 12), sys.version.split()[0], True)

    import importlib

    for module in ["fastapi", "uvicorn", "jinja2", "PIL", "httpx", "multipart"]:
        try:
            importlib.import_module(module)
            add(f"dependency:{module}", True, "importable", module in {"fastapi", "uvicorn", "jinja2", "PIL"})
        except Exception as exc:  # noqa: BLE001
            add(f"dependency:{module}", False, str(exc), True)

    db_path = database_path()
    add("data dir writable", writable(db_path.parent), str(db_path.parent), True)
    add("upload dir writable", writable(upload_dir()), str(upload_dir()), True)

    browser_path = Path(
        Path.home() / "AppData" / "Local" / "ms-playwright"
    )
    add("playwright browser dir", browser_path.exists(), str(browser_path), False)

    add("port free", not port_in_use(settings.port), f"127.0.0.1:{settings.port}", False)
    add("session secret", bool(settings.session_secret), "已配置（未输出）" if settings.session_secret else "未配置 SESSION_SECRET", True)
    add(
        "ai config",
        settings.ai.mode == "mock" or is_ai_live_configured(),
        f"mode={settings.ai.mode}, baseUrl={'已配置' if settings.ai.base_url else '未配置'}, "
        f"key={'已配置' if settings.ai.api_key else '未配置'}, model={settings.ai.vision_model or '未配置'}",
        False,
    )
    add("database url", bool(settings.database_url), settings.database_url.replace("file:", ""), False)
    add("map tile url", bool(settings.map_tile_url), settings.map_tile_url, False)

    report = {
        "generatedAt": __import__("datetime").datetime.now().isoformat(),
        "platform": f"{sys.platform}",
        "python": sys.version,
        "database": str(db_path),
        "uploadDir": str(upload_dir()),
        "ai": {
            "mode": settings.ai.mode,
            "baseUrlSet": bool(settings.ai.base_url),
            "keySet": bool(settings.ai.api_key),
            "model": settings.ai.vision_model or None,
        },
        "liveTests": {"authorized": settings.live_run, "maxRequests": settings.live_max_requests},
        "checks": checks,
    }
    (ROOT / "artifacts").mkdir(exist_ok=True)
    (ROOT / "artifacts" / "environment.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    for check in checks:
        flag = "PASS" if check["ok"] else ("FAIL" if check["critical"] else "WARN")
        print(f"{flag}  {check['name']} — {check['detail']}")

    failures = [c for c in checks if c["critical"] and not c["ok"]]
    if failures:
        print(f"\n[doctor] {len(failures)} 项关键检查未通过。")
        return 1
    print("\n[doctor] 本地环境可用。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())