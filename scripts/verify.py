"""Run the local quality gates and write artifacts/verification.json."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

STEPS = [
    ("test:unit", [sys.executable, "-m", "pytest", "tests/unit", "-q"]),
    ("test:integration", [sys.executable, "-m", "pytest", "tests/integration", "-q"]),
    ("test:e2e", [sys.executable, "-m", "pytest", "tests/e2e", "-q"]),
]

results = []
for name, command in STEPS:
    print(f"\n===== {name} =====")
    start = time.time()
    completed = subprocess.run(command, cwd=ROOT)
    duration = int((time.time() - start) * 1000)
    results.append({"name": name, "exitCode": completed.returncode, "passed": completed.returncode == 0, "durationMs": duration})
    print(f"----- {name}: {'PASS' if completed.returncode == 0 else 'FAIL'} ({duration // 1000}s) -----")

live_path = ROOT / "artifacts" / "test-results" / "live-ai.json"
report = {
    "generatedAt": __import__("datetime").datetime.now().isoformat(),
    "platform": sys.platform,
    "python": sys.version.split()[0],
    "allPassed": all(r["passed"] for r in results),
    "results": results,
    "liveAi": json.loads(live_path.read_text(encoding="utf-8")) if live_path.exists() else {"status": "NOT_RUN"},
}
(ROOT / "artifacts").mkdir(exist_ok=True)
(ROOT / "artifacts" / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n[verify] {'全部本地质量门槛通过' if report['allPassed'] else '存在未通过项'}。报告：artifacts/verification.json")
raise SystemExit(0 if report["allPassed"] else 1)