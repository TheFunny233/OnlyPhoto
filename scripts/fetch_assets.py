"""Fetch demo images into app/static/demo (idempotent). Mirrors scripts/fetch-assets.mjs."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMO = ROOT / "app" / "static" / "demo"

ITEMS = [
    "hero",
    "city-skyline",
    "street-portrait",
    "lake-reflection",
    "old-town-bridge",
    "night-market",
    "coast-boardwalk",
    "city-observation",
    "mountain-mist",
]


def main() -> int:
    DEMO.mkdir(parents=True, exist_ok=True)
    sources = []
    for name in ITEMS:
        target = DEMO / f"{name}.jpg"
        if target.exists():
            sources.append({"name": name, "status": "existing"})
            print(name, "existing")
            continue
        url = f"https://picsum.photos/seed/photomaster-{name}/1280/854"
        try:
            with urllib.request.urlopen(url, timeout=30) as response:  # noqa: S310
                data = response.read()
            if data:
                target.write_bytes(data)
                sources.append({"name": name, "status": "downloaded"})
                print(name, "downloaded")
                continue
        except Exception as exc:  # noqa: BLE001
            print(name, "failed:", exc)
        sources.append({"name": name, "status": "missing"})

    (ROOT / "artifacts").mkdir(exist_ok=True)
    (ROOT / "artifacts" / "assets.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding="utf-8")
    print("done")
    return 0


if __name__ == "__main__":
    sys.exit(main())