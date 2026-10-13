"""Apply database migrations (idempotent)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import database_path, run_migrations  # noqa: E402


def main() -> int:
    run_migrations()
    print(f"[onlyphoto] migrations applied to {database_path()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())