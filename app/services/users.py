from __future__ import annotations

from typing import Any

from ..db import execute, query_one
from ..security import hash_password
from ..utils import new_id, now_ms


def get_by_email(email: str):
    return query_one("SELECT * FROM users WHERE email = ?", (email,))


def get_by_id(user_id: str):
    return query_one("SELECT id, email, nickname, is_demo FROM users WHERE id = ?", (user_id,))


def create_user(email: str, nickname: str, password: str, *, is_demo: bool = False) -> str:
    user_id = new_id()
    execute(
        "INSERT INTO users (id, email, password_hash, nickname, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, email, hash_password(password), nickname, 1 if is_demo else 0, now_ms()),
    )
    return user_id


def public_user(user_id: str) -> dict[str, Any] | None:
    row = get_by_id(user_id)
    if row is None:
        return None
    return {"id": row["id"], "nickname": row["nickname"], "isDemo": bool(row["is_demo"])}