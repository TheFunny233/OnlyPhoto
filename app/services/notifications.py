"""In-app notifications: like / favorite / comment / reply / follow."""

from __future__ import annotations

from typing import Any

from ..db import execute, query_all, query_one
from ..errors import ApiError
from ..utils import iso_from_ms, new_id, now_ms

TYPES = {"like", "favorite", "comment", "reply", "follow"}

TYPE_LABEL = {
    "like": "赞了你的机位",
    "favorite": "收藏了你的机位",
    "comment": "评论了你的机位",
    "reply": "回复了你的评论",
    "follow": "关注了你",
}


def notify(
    user_id: str,
    actor_id: str,
    type_: str,
    target_type: str,
    target_id: str,
    spot_id: str | None = None,
) -> None:
    """Create a notification, merging repeats from the same actor/target."""
    if not user_id or user_id == actor_id:
        return  # never notify yourself
    existing = query_one(
        """
        SELECT id FROM notifications
         WHERE user_id = ? AND actor_id = ? AND type = ? AND target_id = ?
        """,
        (user_id, actor_id, type_, target_id),
    )
    if existing:
        execute(
            "UPDATE notifications SET is_read = 0, created_at = ? WHERE id = ?",
            (now_ms(), existing["id"]),
        )
        return
    execute(
        """
        INSERT INTO notifications (id, user_id, actor_id, type, target_type, target_id, spot_id, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (new_id(), user_id, actor_id, type_, target_type, target_id, spot_id, now_ms()),
    )


def list_notifications(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    type_filter: str | None = None,
) -> list[dict[str, Any]]:
    sql = """
        SELECT n.*, u.nickname AS actor_name
          FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
         WHERE n.user_id = ?
    """
    params: list[Any] = [user_id]
    if type_filter in TYPES:
        sql += " AND n.type = ?"
        params.append(type_filter)
    sql += " ORDER BY n.created_at DESC LIMIT ? OFFSET ?"
    params.append(max(1, min(limit, 100)))
    params.append(max(0, offset))
    rows = query_all(sql, tuple(params))
    result = []
    for row in rows:
        result.append(
            {
                "id": row["id"],
                "type": row["type"],
                "label": TYPE_LABEL.get(row["type"], row["type"]),
                "actorId": row["actor_id"],
                "actorName": row["actor_name"] or "用户",
                "targetType": row["target_type"],
                "targetId": row["target_id"],
                "spotId": row["spot_id"],
                "read": bool(row["is_read"]),
                "createdAt": iso_from_ms(row["created_at"]),
            }
        )
    return result


def unread_count(user_id: str) -> int:
    row = query_one("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0", (user_id,))
    return int(row["c"]) if row else 0


def count_notifications(user_id: str, type_filter: str | None = None) -> int:
    sql = "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ?"
    params: list[Any] = [user_id]
    if type_filter in TYPES:
        sql += " AND type = ?"
        params.append(type_filter)
    row = query_one(sql, tuple(params))
    return int(row["c"]) if row else 0


def clear_read_notifications(user_id: str) -> int:
    cursor = execute("DELETE FROM notifications WHERE user_id = ? AND is_read = 1", (user_id,))
    return cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else 0


def mark_all_read(user_id: str) -> int:
    execute("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", (user_id,))
    return unread_count(user_id)


def mark_read(user_id: str, notification_id: str) -> int:
    row = query_one("SELECT id FROM notifications WHERE id = ? AND user_id = ?", (notification_id, user_id))
    if row is None:
        raise ApiError(404, "not_found", "通知不存在")
    execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notification_id,))
    return unread_count(user_id)