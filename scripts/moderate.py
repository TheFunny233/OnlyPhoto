"""Minimal maintenance CLI for reported content (same duties as scripts/moderate.ts)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import run_migrations  # noqa: E402
from app.services.spots import list_reports, resolve_report  # noqa: E402


def main() -> int:
    run_migrations()
    args = sys.argv[1:]
    action = args[0] if args else "list"

    if action == "list":
        reports = list_reports()
        if not reports:
            print("[moderate] 没有举报记录。")
        for report in reports:
            print(f"#{report['id']} [{report['status']}] {report['targetType']}:{report['targetId']} — {report['reason']} ({report['createdAt']})")
        return 0

    if action in {"resolve", "hide"}:
        if len(args) < 2:
            print("[moderate] 用法：uv run python scripts/moderate.py <resolve|hide> <reportId>")
            return 1
        print(f"[moderate] 已处理 {args[1]}：{resolve_report(args[1], action)}")
        return 0

    print("[moderate] 未知动作。可用：list | resolve <id> | hide <id>")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())