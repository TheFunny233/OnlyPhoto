"""Personal collections (groups of spots)."""

from __future__ import annotations

from typing import Any

from ..db import execute, query_all, query_one
from ..errors import ApiError
from ..utils import clean_text, iso_from_ms, new_id, now_ms


def _owned(collection_id: str, user_id: str):
    row = query_one("SELECT * FROM collections WHERE id = ?", (collection_id,))
    if row is None:
        raise ApiError(404, "not_found", "收藏夹不存在")
    if row["user_id"] != user_id:
        raise ApiError(403, "forbidden", "只能操作自己的收藏夹")
    return row


def list_collections(user_id: str) -> list[dict[str, Any]]:
    rows = query_all("SELECT * FROM collections WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    result: list[dict[str, Any]] = []
    for row in rows:
        items = query_all(
            """
            SELECT ci.spot_id, s.title, s.city,
                   (SELECT id FROM spot_media m WHERE m.spot_id = s.id ORDER BY m.sort LIMIT 1) AS media_id
              FROM collection_items ci LEFT JOIN spots s ON s.id = ci.spot_id
             WHERE ci.collection_id = ?
             ORDER BY ci.created_at DESC
            """,
            (row["id"],),
        )
        cover = None
        for item in items:
            if item["media_id"]:
                cover = f"/api/spots/{item['spot_id']}/media/{item['media_id']}"
                break
        result.append(
            {
                "id": row["id"],
                "name": row["name"],
                "count": len(items),
                "createdAt": iso_from_ms(row["created_at"]),
                "coverUrl": cover,
                "spotIds": [item["spot_id"] for item in items],
            }
        )
    return result


def create_collection(user_id: str, name: str) -> dict[str, Any]:
    clean = clean_text(name, 40)
    if not clean:
        raise ApiError(400, "invalid_input", "请填写收藏夹名称")
    count = query_one("SELECT COUNT(*) AS c FROM collections WHERE user_id = ?", (user_id,))
    if count and int(count["c"]) >= 30:
        raise ApiError(400, "too_many", "收藏夹数量已达上限（30）")
    collection_id = new_id()
    execute(
        "INSERT INTO collections (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
        (collection_id, user_id, clean, now_ms()),
    )
    return {"id": collection_id, "name": clean, "count": 0, "coverUrl": None, "spotIds": []}


def rename_collection(collection_id: str, user_id: str, name: str) -> dict[str, Any]:
    _owned(collection_id, user_id)
    clean = clean_text(name, 40)
    if not clean:
        raise ApiError(400, "invalid_input", "请填写收藏夹名称")
    execute("UPDATE collections SET name = ? WHERE id = ?", (clean, collection_id))
    return {"id": collection_id, "name": clean}


def delete_collection(collection_id: str, user_id: str) -> dict[str, Any]:
    _owned(collection_id, user_id)
    execute("DELETE FROM collections WHERE id = ?", (collection_id,))
    return {"ok": True}


def get_collection(collection_id: str, user_id: str, viewer_id: str | None = None) -> dict[str, Any]:
    from .spots import serialize_spot

    row = _owned(collection_id, user_id)
    items = query_all(
        "SELECT spot_id FROM collection_items WHERE collection_id = ? ORDER BY created_at DESC",
        (collection_id,),
    )
    spots = []
    for item in items:
        spot = query_one("SELECT * FROM spots WHERE id = ?", (item["spot_id"],))
        if spot is not None and spot["status"] == "published":
            spots.append(serialize_spot(spot, viewer_id))
    return {
        "id": row["id"],
        "name": row["name"],
        "createdAt": iso_from_ms(row["created_at"]),
        "count": len(spots),
        "spots": spots,
    }


def add_to_collection(collection_id: str, user_id: str, spot_id: str, viewer_id: str | None = None) -> dict[str, Any]:
    _owned(collection_id, user_id)
    spot = query_one("SELECT id, status FROM spots WHERE id = ?", (spot_id,))
    if spot is None or spot["status"] != "published":
        raise ApiError(404, "not_found", "机位不存在")
    execute(
        "INSERT OR IGNORE INTO collection_items (collection_id, spot_id, created_at) VALUES (?, ?, ?)",
        (collection_id, spot_id, now_ms()),
    )
    return get_collection(collection_id, user_id, viewer_id)


def remove_from_collection(collection_id: str, user_id: str, spot_id: str, viewer_id: str | None = None) -> dict[str, Any]:
    _owned(collection_id, user_id)
    execute(
        "DELETE FROM collection_items WHERE collection_id = ? AND spot_id = ?",
        (collection_id, spot_id),
    )
    return get_collection(collection_id, user_id, viewer_id)