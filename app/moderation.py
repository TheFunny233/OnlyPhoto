"""Lightweight content moderation: configurable sensitive-word gate."""

from __future__ import annotations

from .config import settings
from .errors import ApiError


def ensure_clean(text: str, field: str = "内容") -> str:
    """Reject text containing a configured sensitive word (case-insensitive)."""
    if not text:
        return text
    lowered = text.lower()
    for word in settings.sensitive_words:
        if word.lower() in lowered:
            raise ApiError(400, "sensitive_content", f"{field}包含不允许的词语，请修改后重试")
    return text