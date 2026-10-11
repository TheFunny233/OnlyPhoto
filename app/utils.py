from __future__ import annotations

import json
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

_WS = re.compile(r"\s+")


def now_ms() -> int:
    return int(time.time() * 1000)


def new_id() -> str:
    return str(uuid.uuid4())


def iso_from_ms(epoch_ms: int | None) -> str | None:
    if epoch_ms is None:
        return None
    return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).isoformat()


def localize_ms(value: int | str | None, fmt: str = "%Y-%m-%d %H:%M") -> str:
    """Format either an epoch-millisecond integer or an ISO-8601 string (local time)."""
    if value is None or value == "":
        return "—"
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return value
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone()
        return parsed.strftime(fmt)
    return datetime.fromtimestamp(value / 1000).strftime(fmt)


def dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def loads(value: str | None, default: Any = None) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default


def clean_text(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    return _WS.sub(" ", value).strip()[:max_len]


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def truncate(value: str, max_len: int) -> str:
    return value[:max_len]


def page_dict(**kwargs: Any) -> dict[str, Any]:
    return kwargs