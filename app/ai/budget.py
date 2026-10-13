from __future__ import annotations

from ..config import settings
from ..db import execute, query_one
from ..utils import now_ms

RUN_TASK_ID = "onlyphoto-dev-run"


class BudgetExceededError(Exception):
    def __init__(self, used: int, limit: int) -> None:
        super().__init__(f"真实请求预算已用尽（{used}/{limit}）")
        self.used = used
        self.limit = limit


def _ensure_ledger() -> tuple[int, int]:
    row = query_one('SELECT used, "limit" AS lim FROM live_budget WHERE id = ?', (RUN_TASK_ID,))
    if row is not None:
        return int(row["used"]), int(row["lim"])
    execute(
        "INSERT INTO live_budget (id, task_id, used, \"limit\", updated_at) VALUES (?, ?, 0, ?, ?)",
        (RUN_TASK_ID, RUN_TASK_ID, settings.live_max_requests, now_ms()),
    )
    return 0, settings.live_max_requests


def get_budget() -> dict[str, int]:
    used, limit = _ensure_ledger()
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}


def consume_budget(count: int = 1) -> dict[str, int]:
    used, limit = _ensure_ledger()
    if used + count > limit:
        raise BudgetExceededError(used, limit)
    execute(
        "UPDATE live_budget SET used = ?, updated_at = ? WHERE id = ?",
        (used + count, now_ms(), RUN_TASK_ID),
    )
    return {"used": used + count, "limit": limit, "remaining": max(0, limit - used - count)}