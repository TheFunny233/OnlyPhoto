from __future__ import annotations

import time
from threading import Lock

_buckets: dict[str, tuple[int, float]] = {}
_lock = Lock()


def rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    """Simple in-process sliding bucket. Returns True when the call is allowed."""
    now = time.time()
    with _lock:
        count, reset_at = _buckets.get(key, (0, 0.0))
        if reset_at < now:
            _buckets[key] = (1, now + window_seconds)
            return True
        if count >= limit:
            return False
        _buckets[key] = (count + 1, reset_at)
        return True


def reset_rate_limits() -> None:
    with _lock:
        _buckets.clear()