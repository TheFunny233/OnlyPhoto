from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..db import execute, query_all, query_one, upload_dir
from ..errors import ApiError
from ..imaging import make_public_derivative
from ..utils import clean_text, dumps, iso_from_ms, loads, new_id, now_ms
from .photos import get_owned_photo


def _count(table: str, spot_id: str) -> int:
    row = query_one(f"SELECT COUNT(*) AS c FROM {table} WHERE spot_id = ?", (spot_id,))
    return int(row["c"]) if row else 0


def serialize_spot(spot: Any, viewer_id: str | None) -> dict[str, Any]:
    owner = query_one("SELECT nickname FROM users WHERE id = ?", (spot["owner_id"],))
    liked = False
    favorited = False
    if viewer_id:
        liked = query_one("SELECT 1 FROM likes WHERE spot_id = ? AND user_id = ?", (spot["id"], viewer_id)) is not None
        favorited = (
            query_one("SELECT 1 FROM favorites WHERE spot_id = ? AND user_id = ?", (spot["id"], viewer_id)) is not None
        )
    media = query_all(
        "SELECT id FROM spot_media WHERE spot_id = ? ORDER BY sort", (spot["id"],)
    )
    return {
        "id": spot["id"],
        "ownerId": spot["owner_id"],
        "ownerName": owner["nickname"] if owner else "未知用户",
        "title": spot["title"],
        "city": spot["city"],
        "area": spot["area"],
        "lat": spot["lat"],
        "lng": spot["lng"],
        "coordSystem": spot["coord_system"],
        "precision": spot["precision"],
        "subjects": loads(spot["subjects"], []) or [],
        "description": spot["description"],
        "howToStand": spot["how_to_stand"],
        "direction": spot["direction"],
        "bestLight": spot["best_light"],
        "lightSource": spot["light_source"],
        "gear": spot["gear"],
        "safety": spot["safety"],
        "status": spot["status"],
        "isDemo": bool(spot["is_demo"]),
        "verifiedAt": iso_from_ms(spot["verified_at"]),
        "createdAt": iso_from_ms(spot["created_at"]),
        "updatedAt": iso_from_ms(spot["updated_at"]),
        "likeCount": _count("likes", spot["id"]),
        "favoriteCount": _count("favorites", spot["id"]),
        "commentCount": _count("comments", spot["id"]),
        "likedByViewer": liked,
        "favoritedByViewer": favorited,
        "isOwner": viewer_id == spot["owner_id"],
        "media": [{"id": m["id"], "url": f"/api/spots/{spot['id']}/media/{m['id']}"} for m in media],
    }


def list_spots(
    *,
    city: str | None = None,
    subject: str | None = None,
    q: str | None = None,
    favorites_of: str | None = None,
    viewer_id: str | None = None,
    include_hidden: bool = False,
    limit: int = 200,
) -> list[dict[str, Any]]:
    rows = query_all("SELECT * FROM spots ORDER BY created_at DESC")
    if not include_hidden:
        rows = [r for r in rows if r["status"] == "published"]
    if city:
        rows = [r for r in rows if r["city"] == city]
    if subject:
        rows = [r for r in rows if subject in (loads(r["subjects"], []) or [])]
    if q:
        needle = q.lower()
        rows = [
            r
            for r in rows
            if needle in r["title"].lower()
            or needle in r["city"].lower()
            or needle in r["description"].lower()
            or needle in (r["subjects"] or "").lower()
        ]
    if favorites_of:
        fav_ids = {
            row["spot_id"] for row in query_all("SELECT spot_id FROM favorites WHERE user_id = ?", (favorites_of,))
        }
        rows = [r for r in rows if r["id"] in fav_ids]
    return [serialize_spot(row, viewer_id) for row in rows[: min(limit, 300)]]


def get_spot(spot_id: str, viewer_id: str | None) -> dict[str, Any]:
    spot = query_one("SELECT * FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["status"] != "published" and viewer_id != spot["owner_id"]:
        raise ApiError(404, "not_found", "机位不存在")
    return serialize_spot(spot, viewer_id)


def list_comments(spot_id: str) -> list[dict[str, Any]]:
    rows = query_all(
        """
        SELECT c.*, u.nickname AS nickname
          FROM comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.spot_id = ? AND c.status = 'visible'
         ORDER BY c.created_at DESC, c.rowid DESC
        """,
        (spot_id,),
    )
    return [
        {
            "id": r["id"],
            "body": r["body"],
            "userId": r["user_id"],
            "nickname": r["nickname"] or "用户",
            "createdAt": iso_from_ms(r["created_at"]),
        }
        for r in rows
    ]


def create_spot(owner_id: str, data: dict[str, Any]) -> dict[str, Any]:
    spot_id = new_id()
    now = now_ms()
    execute(
        """
        INSERT INTO spots
            (id, owner_id, title, city, area, lat, lng, coord_system, precision, subjects,
             description, how_to_stand, direction, best_light, light_source, gear, safety,
             status, is_demo, verified_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        """,
        (
            spot_id,
            owner_id,
            data["title"],
            data["city"],
            data.get("area", ""),
            data["lat"],
            data["lng"],
            data.get("coordSystem", "WGS84"),
            data["precision"],
            dumps(data.get("subjects", [])),
            data.get("description", ""),
            data.get("howToStand", ""),
            data.get("direction", ""),
            data.get("bestLight", ""),
            data.get("lightSource", "unconfirmed"),
            data.get("gear", ""),
            data.get("safety", ""),
            data.get("status", "published"),
            now if data.get("status", "published") == "published" else None,
            now,
            now,
        ),
    )
    photo_id = data.get("photoId")
    if photo_id:
        attach_photo_to_spot(spot_id, owner_id, photo_id)
    return get_spot(spot_id, owner_id)


def attach_photo_to_spot(spot_id: str, owner_id: str, photo_id: str) -> None:
    photo = get_owned_photo(photo_id, owner_id)
    if photo is None:
        raise ApiError(400, "photo_not_owned", "选择的照片不存在或不属于你")
    media_id = new_id()
    target_key = f"public/{spot_id}/{media_id}.jpg"
    target_abs = upload_dir() / "public" / spot_id / f"{media_id}.jpg"
    meta = make_public_derivative(photo["storage_key"], target_abs)
    execute(
        """
        INSERT INTO spot_media
            (id, spot_id, owner_id, photo_id, storage_key, width, height, bytes, sort, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
        """,
        (media_id, spot_id, owner_id, photo_id, target_key, meta["width"], meta["height"], meta["bytes"], now_ms()),
    )


def update_spot(spot_id: str, owner_id: str, data: dict[str, Any]) -> dict[str, Any]:
    spot = query_one("SELECT * FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["owner_id"] != owner_id:
        raise ApiError(403, "forbidden", "只能编辑自己的机位")

    def pick(key: str, column: str) -> Any:
        return data[key] if key in data and data[key] is not None else spot[column]

    execute(
        """
        UPDATE spots SET
            title = ?, city = ?, area = ?, lat = ?, lng = ?, coord_system = ?, precision = ?,
            subjects = ?, description = ?, how_to_stand = ?, direction = ?, best_light = ?,
            light_source = ?, gear = ?, safety = ?, status = ?, updated_at = ?
         WHERE id = ?
        """,
        (
            pick("title", "title"),
            pick("city", "city"),
            pick("area", "area"),
            pick("lat", "lat"),
            pick("lng", "lng"),
            pick("coordSystem", "coord_system"),
            pick("precision", "precision"),
            dumps(data["subjects"]) if data.get("subjects") else spot["subjects"],
            pick("description", "description"),
            pick("howToStand", "how_to_stand"),
            pick("direction", "direction"),
            pick("bestLight", "best_light"),
            pick("lightSource", "light_source"),
            pick("gear", "gear"),
            pick("safety", "safety"),
            pick("status", "status"),
            now_ms(),
            spot_id,
        ),
    )
    return get_spot(spot_id, owner_id)


def delete_spot(spot_id: str, owner_id: str) -> None:
    spot = query_one("SELECT * FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["owner_id"] != owner_id:
        raise ApiError(403, "forbidden", "只能删除自己的机位")
    media = query_all("SELECT storage_key FROM spot_media WHERE spot_id = ?", (spot_id,))
    execute("DELETE FROM spots WHERE id = ?", (spot_id,))
    root = upload_dir()
    for item in media:
        try:
            (root / item["storage_key"]).unlink(missing_ok=True)
        except OSError:
            pass


def _require_published(spot_id: str) -> None:
    spot = query_one("SELECT status FROM spots WHERE id = ?", (spot_id,))
    if spot is None or spot["status"] != "published":
        raise ApiError(404, "not_found", "机位不存在")


def toggle_like(spot_id: str, user_id: str) -> dict[str, Any]:
    _require_published(spot_id)
    existing = query_one("SELECT 1 FROM likes WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    if existing:
        execute("DELETE FROM likes WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    else:
        execute(
            "INSERT OR IGNORE INTO likes (spot_id, user_id, created_at) VALUES (?, ?, ?)",
            (spot_id, user_id, now_ms()),
        )
    return {"liked": existing is None, "count": _count("likes", spot_id)}


def toggle_favorite(spot_id: str, user_id: str) -> dict[str, Any]:
    _require_published(spot_id)
    existing = query_one("SELECT 1 FROM favorites WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    if existing:
        execute("DELETE FROM favorites WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    else:
        execute(
            "INSERT OR IGNORE INTO favorites (spot_id, user_id, created_at) VALUES (?, ?, ?)",
            (spot_id, user_id, now_ms()),
        )
    return {"favorited": existing is None, "count": _count("favorites", spot_id)}


def add_comment(spot_id: str, user_id: str, body: str) -> dict[str, Any]:
    _require_published(spot_id)
    text = clean_text(body, 600)
    if not text:
        raise ApiError(400, "empty_comment", "评论不能为空")
    comment_id = new_id()
    now = now_ms()
    execute(
        "INSERT INTO comments (id, spot_id, user_id, body, status, created_at) VALUES (?, ?, ?, ?, 'visible', ?)",
        (comment_id, spot_id, user_id, text, now),
    )
    user = query_one("SELECT nickname FROM users WHERE id = ?", (user_id,))
    return {
        "id": comment_id,
        "body": text,
        "userId": user_id,
        "nickname": user["nickname"] if user else "用户",
        "createdAt": iso_from_ms(now),
    }


def delete_own_comment(comment_id: str, user_id: str) -> None:
    comment = query_one("SELECT * FROM comments WHERE id = ?", (comment_id,))
    if comment is None:
        raise ApiError(404, "not_found", "评论不存在")
    if comment["user_id"] != user_id:
        raise ApiError(403, "forbidden", "只能删除自己的评论")
    execute("DELETE FROM comments WHERE id = ?", (comment_id,))


def create_report(reporter_id: str, target_type: str, target_id: str, reason: str) -> dict[str, Any]:
    if target_type not in {"spot", "comment"}:
        raise ApiError(400, "bad_target", "举报对象类型不正确")
    text = clean_text(reason, 500)
    if not text:
        raise ApiError(400, "empty_reason", "请填写举报原因")
    report_id = new_id()
    execute(
        "INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'open', ?)",
        (report_id, reporter_id, target_type, target_id, text, now_ms()),
    )
    return {"id": report_id}


def list_reports() -> list[dict[str, Any]]:
    rows = query_all("SELECT * FROM reports ORDER BY created_at DESC")
    return [
        {
            "id": r["id"],
            "targetType": r["target_type"],
            "targetId": r["target_id"],
            "reason": r["reason"],
            "status": r["status"],
            "createdAt": iso_from_ms(r["created_at"]),
        }
        for r in rows
    ]


def resolve_report(report_id: str, action: str) -> dict[str, Any]:
    report = query_one("SELECT * FROM reports WHERE id = ?", (report_id,))
    if report is None:
        raise ApiError(404, "not_found", "举报不存在")
    if action == "hide":
        if report["target_type"] == "spot":
            execute("UPDATE spots SET status = 'hidden' WHERE id = ?", (report["target_id"],))
        else:
            execute("UPDATE comments SET status = 'hidden' WHERE id = ?", (report["target_id"],))
    execute("UPDATE reports SET status = 'resolved' WHERE id = ?", (report_id,))
    return {"ok": True}


def list_cities() -> list[str]:
    rows = query_all("SELECT DISTINCT city FROM spots WHERE status = 'published' AND city != '' ORDER BY city")
    return [row["city"] for row in rows]