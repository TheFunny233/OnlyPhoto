"""Real provider smoke test (authorised + budgeted). Mirrors scripts/test-live.ts."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ai.analyze import run_analysis  # noqa: E402
from app.ai.budget import BudgetExceededError, consume_budget, get_budget  # noqa: E402
from app.config import ROOT, is_ai_live_configured, settings  # noqa: E402
from app.db import execute, query_one, run_migrations  # noqa: E402
from app.imaging import ingest_image  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.utils import new_id, now_ms  # noqa: E402

OUT = ROOT / "artifacts" / "test-results" / "live-ai.json"
SAMPLES = [
    ("city-skyline.jpg", "architecture"),
    ("mountain-mist.jpg", "landscape"),
    ("night-market.jpg", "food"),
]


def main() -> int:
    run_migrations()
    OUT.parent.mkdir(parents=True, exist_ok=True)

    if not settings.live_run:
        OUT.write_text(json.dumps({"status": "SKIPPED", "reason": "RUN_LIVE_AI_TESTS=false，未授权真实测试"}, ensure_ascii=False, indent=2), encoding="utf-8")
        print("[test-live] SKIPPED — 未授权真实测试。")
        return 0
    if not is_ai_live_configured():
        OUT.write_text(json.dumps({"status": "SKIPPED", "reason": "真实模式配置不完整"}, ensure_ascii=False, indent=2), encoding="utf-8")
        print("[test-live] SKIPPED — 配置不完整。")
        return 0

    email = "live.test@onlyphoto.local"
    user = query_one("SELECT id FROM users WHERE email = ?", (email,))
    if user is None:
        user_id = new_id()
        execute(
            "INSERT INTO users (id, email, password_hash, nickname, is_demo, created_at) VALUES (?, ?, ?, ?, 1, ?)",
            (user_id, email, hash_password("live-test-not-for-login"), "真实测试用户", now_ms()),
        )
    else:
        user_id = user["id"]

    demo_dir = ROOT / "app" / "static" / "demo"
    results = []
    for filename, scene in SAMPLES:
        source = demo_dir / filename
        if not source.exists():
            results.append({"file": filename, "status": "skipped", "reason": "缺少示例图片"})
            continue
        photo_id = new_id()
        ingested = ingest_image(user_id, photo_id, filename, source.read_bytes())
        execute(
            """
            INSERT INTO photos (id, owner_id, storage_key, original_name, mime_type, width, height, bytes,
                                content_hash, privacy, is_demo, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', 1, ?)
            """,
            (photo_id, user_id, ingested["storage_key"], filename, ingested["mime_type"],
             ingested["width"], ingested["height"], ingested["bytes"], ingested["content_hash"], now_ms()),
        )
        # The development-run ledger is enforced here (agent-side testing), not in the app.
        try:
            consume_budget(1)
        except BudgetExceededError as exc:
            print(f"[test-live] 预算不足，停止：{exc}")
            break

        started = time.time()
        result = run_analysis(
            user_id=user_id,
            photo_id=photo_id,
            content_hash=ingested["content_hash"],
            image_base64=ingested["ai_input_base64"],
            mime_type=ingested["ai_input_mime_type"],
            scene=scene,
            goals=["highlight_subject"],
            force=True,
        )
        latency = int((time.time() - started) * 1000)
        analysis = result.get("analysis") or {}
        results.append(
            {
                "file": filename,
                "scene": scene,
                "status": result["status"],
                "latencyMs": latency,
                "reused": result.get("reused", False),
                "error": result.get("error"),
                "summary": analysis.get("summary"),
                "counts": {
                    "strengths": len(analysis.get("strengths", [])),
                    "improvements": len(analysis.get("improvements", [])),
                    "reshoot": len(analysis.get("reshootSuggestions", [])),
                    "editing": len(analysis.get("editingSuggestions", [])),
                    "uncertainties": len(analysis.get("uncertainties", [])),
                }
                if analysis
                else None,
                "receipt": result.get("receipt"),
                "budget": get_budget(),
            }
        )
        print(f"[test-live] {filename} -> {result['status']} in {latency}ms")

    report = {
        "status": "COMPLETED" if any(r.get("status") == "succeeded" for r in results) else "FAILED",
        "provider": settings.ai.base_url,
        "model": settings.ai.vision_model,
        "budget": get_budget(),
        "generatedAt": __import__("datetime").datetime.now().isoformat(),
        "results": results,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[test-live] 完成，预算：", json.dumps(get_budget()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())