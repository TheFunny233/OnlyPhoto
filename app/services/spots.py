from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ..db import execute, query_all, query_one, upload_dir
from ..errors import ApiError
from ..imaging import make_public_derivative
from ..moderation import ensure_clean
from ..utils import clean_text, dumps, iso_from_ms, loads, new_id, now_ms
from .notifications import notify
from .photos import get_owned_photo


def _count(table: str, spot_id: str) -> int:
    row = query_one(f"SELECT COUNT(*) AS c FROM {table} WHERE spot_id = ?", (spot_id,))
    return int(row["c"]) if row else 0


def _views(spot_id: str) -> int:
    row = query_one("SELECT COUNT(*) AS c FROM spot_views WHERE spot_id = ?", (spot_id,))
    return int(row["c"]) if row else 0


def hot_score(likes: int, favorites: int, comments: int, views: int) -> int:
    """Simple community heat: interactions weigh more than passive views."""
    return likes * 3 + favorites * 4 + comments * 2 + views


def serialize_spot(spot: Any, viewer_id: str | None) -> dict[str, Any]:
    owner = query_one("SELECT nickname FROM users WHERE id = ?", (spot["owner_id"],))
    liked = False
    favorited = False
    followed = False
    if viewer_id:
        liked = query_one("SELECT 1 FROM likes WHERE spot_id = ? AND user_id = ?", (spot["id"], viewer_id)) is not None
        favorited = (
            query_one("SELECT 1 FROM favorites WHERE spot_id = ? AND user_id = ?", (spot["id"], viewer_id)) is not None
        )
        if viewer_id != spot["owner_id"]:
            followed = (
                query_one(
                    "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?",
                    (viewer_id, spot["owner_id"]),
                )
                is not None
            )
    media = query_all(
        "SELECT id FROM spot_media WHERE spot_id = ? ORDER BY sort", (spot["id"],)
    )
    likes = _count("likes", spot["id"])
    favorites = _count("favorites", spot["id"])
    comments = _count("comments", spot["id"])
    views = _views(spot["id"])
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
        "likeCount": likes,
        "favoriteCount": favorites,
        "commentCount": comments,
        "viewCount": views,
        "hotScore": hot_score(likes, favorites, comments, views),
        "likedByViewer": liked,
        "favoritedByViewer": favorited,
        "followedByViewer": followed,
        "isOwner": viewer_id == spot["owner_id"],
        "media": [{"id": m["id"], "url": f"/api/spots/{spot['id']}/media/{m['id']}"} for m in media],
    }


def list_spots(
    *,
    city: str | None = None,
    subject: str | None = None,
    q: str | None = None,
    author: str | None = None,
    owner_id: str | None = None,
    feed_following_of: str | None = None,
    favorites_of: str | None = None,
    viewer_id: str | None = None,
    sort: str = "latest",
    near: tuple[float, float] | None = None,
    offset: int = 0,
    include_hidden: bool = False,
    limit: int = 24,
) -> dict[str, Any]:
    """Return {"spots", "total", "hasMore"}. `near` is (lat, lng) in WGS84."""
    rows = query_all("SELECT * FROM spots ORDER BY created_at DESC")
    if not include_hidden:
        rows = [r for r in rows if r["status"] == "published"]
    if city:
        rows = [r for r in rows if r["city"] == city]
    if owner_id:
        rows = [r for r in rows if r["owner_id"] == owner_id]
    if subject:
        rows = [r for r in rows if subject in (loads(r["subjects"], []) or [])]
    if author:
        owner_ids = {
            row["id"]
            for row in query_all("SELECT id FROM users WHERE nickname LIKE ?", (f"%{author}%",))
        }
        rows = [r for r in rows if r["owner_id"] in owner_ids]
    if q:
        needle = q.lower()
        rows = [
            r
            for r in rows
            if needle in r["title"].lower()
            or needle in r["city"].lower()
            or needle in r["area"].lower()
            or needle in r["description"].lower()
            or needle in (r["subjects"] or "").lower()
            or needle in r["how_to_stand"].lower()
        ]
    if favorites_of:
        fav_ids = {
            row["spot_id"] for row in query_all("SELECT spot_id FROM favorites WHERE user_id = ?", (favorites_of,))
        }
        rows = [r for r in rows if r["id"] in fav_ids]
    if feed_following_of:
        followed_ids = {
            row["followee_id"]
            for row in query_all("SELECT followee_id FROM follows WHERE follower_id = ?", (feed_following_of,))
        }
        rows = [r for r in rows if r["owner_id"] in followed_ids]

    serialized = [serialize_spot(row, viewer_id) for row in rows]

    if near is not None:
        from ..geo import haversine_km

        for spot in serialized:
            spot["distanceKm"] = round(haversine_km(near[0], near[1], spot["lat"], spot["lng"]), 2)
        serialized.sort(key=lambda s: s["distanceKm"])

    if sort == "near_hot" and near is not None:
        # Heat with a distance penalty: nearby-popular ranks above far-popular.
        serialized.sort(
            key=lambda s: (s["hotScore"] / (1.0 + s["distanceKm"]), -s["distanceKm"]),
            reverse=True,
        )
    elif sort in {"hot", "near_hot"}:
        serialized.sort(key=lambda s: s["hotScore"], reverse=True)
    elif sort == "commented":
        serialized.sort(key=lambda s: s["commentCount"], reverse=True)

    total = len(serialized)
    page_limit = max(1, min(limit, 100))
    start = max(0, offset)
    page = serialized[start : start + page_limit]
    return {"spots": page, "total": total, "hasMore": start + page_limit < total}


def get_spot(spot_id: str, viewer_id: str | None) -> dict[str, Any]:
    spot = query_one("SELECT * FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["status"] != "published" and viewer_id != spot["owner_id"]:
        raise ApiError(404, "not_found", "机位不存在")
    return serialize_spot(spot, viewer_id)


def list_comments(spot_id: str, viewer_id: str | None = None, sort: str = "new") -> list[dict[str, Any]]:
    """Top-level comments with their replies. `sort` is "new" or "hot"."""
    rows = query_all(
        """
        SELECT c.*, u.nickname AS nickname,
               (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) AS like_count
          FROM comments c LEFT JOIN users u ON u.id = c.user_id
         WHERE c.spot_id = ? AND c.status = 'visible'
         ORDER BY c.created_at ASC, c.rowid ASC
        """,
        (spot_id,),
    )

    def shape(row: Any) -> dict[str, Any]:
        liked = False
        if viewer_id:
            liked = (
                query_one(
                    "SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?",
                    (row["id"], viewer_id),
                )
                is not None
            )
        return {
            "id": row["id"],
            "body": row["body"],
            "userId": row["user_id"],
            "nickname": row["nickname"] or "用户",
            "createdAt": iso_from_ms(row["created_at"]),
            "parentId": row["parent_id"],
            "likeCount": int(row["like_count"] or 0),
            "likedByViewer": liked,
            "replies": [],
        }

    items = {row["id"]: shape(row) for row in rows}
    top: list[dict[str, Any]] = []
    for row in rows:
        item = items[row["id"]]
        parent_id = row["parent_id"]
        if parent_id and parent_id in items:
            items[parent_id]["replies"].append(item)
        elif not parent_id:
            top.append(item)
    if sort == "hot":
        top.sort(key=lambda item: (item["likeCount"], len(item["replies"])), reverse=True)
    else:
        top.reverse()  # newest top-level first
    return top


def update_comment(comment_id: str, user_id: str, body: str) -> dict[str, Any]:
    comment = query_one("SELECT * FROM comments WHERE id = ?", (comment_id,))
    if comment is None or comment["status"] != "visible":
        raise ApiError(404, "not_found", "评论不存在")
    if comment["user_id"] != user_id:
        raise ApiError(403, "forbidden", "只能编辑自己的评论")
    text = clean_text(body, 600)
    if not text:
        raise ApiError(400, "empty_comment", "评论不能为空")
    ensure_clean(text, "评论")
    execute("UPDATE comments SET body = ? WHERE id = ?", (text, comment_id))
    return {"id": comment_id, "body": text}


def related_spots(spot_id: str, viewer_id: str | None = None, limit: int = 4) -> list[dict[str, Any]]:
    """Spots sharing subjects / city with the given spot (for "相关机位")."""
    spot = query_one("SELECT * FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        return []
    subjects = set(loads(spot["subjects"], []) or [])
    pool = list_spots(viewer_id=viewer_id, limit=200)["spots"]

    def score(item: dict[str, Any]) -> tuple[int, int]:
        overlap = len(set(item["subjects"]) & subjects)
        same_city = 1 if item["city"] and item["city"] == spot["city"] else 0
        return (overlap * 3 + same_city * 2, item["hotScore"])

    ranked = sorted((item for item in pool if item["id"] != spot_id), key=score, reverse=True)
    ranked = [item for item in ranked if score(item)[0] > 0] or ranked
    return ranked[:limit]


def list_topics(viewer_id: str | None = None) -> list[dict[str, Any]]:
    """Aggregate published spots by subject (题材) for topic browsing."""
    rows = query_all(
        """
        SELECT s.id, s.subjects, s.city, s.title,
               (SELECT COUNT(*) FROM likes l WHERE l.spot_id = s.id) AS likes,
               (SELECT COUNT(*) FROM favorites f WHERE f.spot_id = s.id) AS favorites,
               (SELECT COUNT(*) FROM comments c WHERE c.spot_id = s.id) AS comments,
               (SELECT COUNT(*) FROM spot_views v WHERE v.spot_id = s.id) AS views,
               (SELECT COUNT(*) FROM spot_media m WHERE m.spot_id = s.id) AS media_count
          FROM spots s
         WHERE s.status = 'published'
        """
    )
    buckets: dict[str, dict[str, Any]] = {}
    for row in rows:
        subjects = loads(row["subjects"], []) or []
        score = hot_score(int(row["likes"]), int(row["favorites"]), int(row["comments"]), int(row["views"]))
        for subject in subjects:
            bucket = buckets.setdefault(
                subject,
                {"subject": subject, "count": 0, "hot": 0, "cities": set(), "coverSpotId": None, "coverUrl": None, "_best": -1},
            )
            bucket["count"] += 1
            bucket["hot"] += score
            if row["city"]:
                bucket["cities"].add(row["city"])
            if score > bucket["_best"] and int(row["media_count"]) > 0:
                media = query_one("SELECT id FROM spot_media WHERE spot_id = ? ORDER BY sort LIMIT 1", (row["id"],))
                if media:
                    bucket["_best"] = score
                    bucket["coverSpotId"] = row["id"]
                    bucket["coverUrl"] = f"/api/spots/{row['id']}/media/{media['id']}"

    topics = []
    for bucket in buckets.values():
        bucket.pop("_best", None)
        bucket["cityCount"] = len(bucket["cities"])
        bucket.pop("cities", None)
        topics.append(bucket)
    topics.sort(key=lambda t: (t["count"], t["hot"]), reverse=True)
    return topics


def toggle_comment_like(comment_id: str, user_id: str) -> dict[str, Any]:
    comment = query_one("SELECT id, status FROM comments WHERE id = ?", (comment_id,))
    if comment is None or comment["status"] != "visible":
        raise ApiError(404, "not_found", "评论不存在")
    existing = query_one(
        "SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?", (comment_id, user_id)
    )
    if existing:
        execute("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?", (comment_id, user_id))
    else:
        execute(
            "INSERT OR IGNORE INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)",
            (comment_id, user_id, now_ms()),
        )
    count = query_one("SELECT COUNT(*) AS c FROM comment_likes WHERE comment_id = ?", (comment_id,))
    return {"liked": existing is None, "count": int(count["c"]) if count else 0}


def record_view(spot_id: str, viewer_key: str) -> int:
    """Deduplicated view counter; returns the current total."""
    spot = query_one("SELECT status FROM spots WHERE id = ?", (spot_id,))
    if spot is None or spot["status"] != "published":
        raise ApiError(404, "not_found", "机位不存在")
    execute(
        "INSERT OR IGNORE INTO spot_views (spot_id, viewer_key, created_at) VALUES (?, ?, ?)",
        (spot_id, viewer_key[:120], now_ms()),
    )
    return _views(spot_id)


def create_spot(owner_id: str, data: dict[str, Any]) -> dict[str, Any]:
    ensure_clean(str(data.get("title", "")), "标题")
    ensure_clean(str(data.get("description", "")), "描述")
    ensure_clean(str(data.get("howToStand", "")), "站位说明")
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
    last = query_one("SELECT MAX(sort) AS m FROM spot_media WHERE spot_id = ?", (spot_id,))
    next_sort = (int(last["m"]) + 1) if last and last["m"] is not None else 0
    execute(
        """
        INSERT INTO spot_media
            (id, spot_id, owner_id, photo_id, storage_key, width, height, bytes, sort, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        """,
        (
            media_id,
            spot_id,
            owner_id,
            photo_id,
            target_key,
            meta["width"],
            meta["height"],
            meta["bytes"],
            next_sort,
            now_ms(),
        ),
    )


def add_spot_media(spot_id: str, owner_id: str, photo_id: str) -> dict[str, Any]:
    spot = query_one("SELECT owner_id, status FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["owner_id"] != owner_id:
        raise ApiError(403, "forbidden", "只能为自己的机位添加样张")
    count = query_one("SELECT COUNT(*) AS c FROM spot_media WHERE spot_id = ?", (spot_id,))
    if count and int(count["c"]) >= 9:
        raise ApiError(400, "too_many_media", "一个机位最多 9 张样张")
    attach_photo_to_spot(spot_id, owner_id, photo_id)
    return get_spot(spot_id, owner_id)


def delete_spot_media(spot_id: str, media_id: str, owner_id: str) -> dict[str, Any]:
    spot = query_one("SELECT owner_id FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["owner_id"] != owner_id:
        raise ApiError(403, "forbidden", "只能删除自己机位的样张")
    media = query_one("SELECT * FROM spot_media WHERE id = ? AND spot_id = ?", (media_id, spot_id))
    if media is None:
        raise ApiError(404, "not_found", "样张不存在")
    execute("DELETE FROM spot_media WHERE id = ?", (media_id,))
    try:
        (upload_dir() / media["storage_key"]).unlink(missing_ok=True)
    except OSError:
        pass
    return get_spot(spot_id, owner_id)


def update_spot(spot_id: str, owner_id: str, data: dict[str, Any]) -> dict[str, Any]:
    spot = query_one("SELECT * FROM spots WHERE id = ?", (spot_id,))
    if spot is None:
        raise ApiError(404, "not_found", "机位不存在")
    if spot["owner_id"] != owner_id:
        raise ApiError(403, "forbidden", "只能编辑自己的机位")

    for key, field in (("title", "标题"), ("description", "描述"), ("howToStand", "站位说明")):
        if data.get(key):
            ensure_clean(str(data[key]), field)

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


def _require_published(spot_id: str):
    spot = query_one("SELECT id, owner_id, status FROM spots WHERE id = ?", (spot_id,))
    if spot is None or spot["status"] != "published":
        raise ApiError(404, "not_found", "机位不存在")
    return spot


def toggle_like(spot_id: str, user_id: str) -> dict[str, Any]:
    spot = _require_published(spot_id)
    existing = query_one("SELECT 1 FROM likes WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    if existing:
        execute("DELETE FROM likes WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    else:
        execute(
            "INSERT OR IGNORE INTO likes (spot_id, user_id, created_at) VALUES (?, ?, ?)",
            (spot_id, user_id, now_ms()),
        )
        notify(spot["owner_id"], user_id, "like", "spot", spot_id, spot_id)
    return {"liked": existing is None, "count": _count("likes", spot_id)}


def toggle_favorite(spot_id: str, user_id: str) -> dict[str, Any]:
    spot = _require_published(spot_id)
    existing = query_one("SELECT 1 FROM favorites WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    if existing:
        execute("DELETE FROM favorites WHERE spot_id = ? AND user_id = ?", (spot_id, user_id))
    else:
        execute(
            "INSERT OR IGNORE INTO favorites (spot_id, user_id, created_at) VALUES (?, ?, ?)",
            (spot_id, user_id, now_ms()),
        )
        notify(spot["owner_id"], user_id, "favorite", "spot", spot_id, spot_id)
    return {"favorited": existing is None, "count": _count("favorites", spot_id)}


def add_comment(spot_id: str, user_id: str, body: str, parent_id: str | None = None) -> dict[str, Any]:
    spot = _require_published(spot_id)
    text = clean_text(body, 600)
    if not text:
        raise ApiError(400, "empty_comment", "评论不能为空")
    ensure_clean(text, "评论")
    if parent_id:
        parent = query_one("SELECT spot_id, status, user_id FROM comments WHERE id = ?", (parent_id,))
        if parent is None or parent["spot_id"] != spot_id or parent["status"] != "visible":
            raise ApiError(400, "bad_parent", "回复的评论不存在")
    comment_id = new_id()
    now = now_ms()
    execute(
        """
        INSERT INTO comments (id, spot_id, user_id, body, status, created_at, parent_id)
        VALUES (?, ?, ?, ?, 'visible', ?, ?)
        """,
        (comment_id, spot_id, user_id, text, now, parent_id),
    )
    if parent_id:
        notify(parent["user_id"], user_id, "reply", "comment", parent_id, spot_id)
    else:
        notify(spot["owner_id"], user_id, "comment", "spot", spot_id, spot_id)
    user = query_one("SELECT nickname FROM users WHERE id = ?", (user_id,))
    return {
        "id": comment_id,
        "body": text,
        "userId": user_id,
        "nickname": user["nickname"] if user else "用户",
        "createdAt": iso_from_ms(now),
        "parentId": parent_id,
        "likeCount": 0,
        "likedByViewer": False,
        "replies": [],
    }


def user_profile(user_id: str, viewer_id: str | None = None) -> dict[str, Any]:
    user = query_one("SELECT id, nickname, is_demo, created_at FROM users WHERE id = ?", (user_id,))
    if user is None:
        raise ApiError(404, "not_found", "用户不存在")
    spots = list_spots(owner_id=user_id, viewer_id=viewer_id, limit=100)["spots"]
    likes_received = sum(s["likeCount"] for s in spots)
    favorites_received = sum(s["favoriteCount"] for s in spots)
    followers = query_one("SELECT COUNT(*) AS c FROM follows WHERE followee_id = ?", (user_id,))
    following = query_one("SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?", (user_id,))
    followed = False
    if viewer_id and viewer_id != user_id:
        followed = (
            query_one(
                "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?", (viewer_id, user_id)
            )
            is not None
        )
    return {
        "id": user["id"],
        "nickname": user["nickname"],
        "isDemo": bool(user["is_demo"]),
        "joinedAt": iso_from_ms(user["created_at"]),
        "spotCount": len(spots),
        "likeCount": likes_received,
        "favoriteCount": favorites_received,
        "followers": int(followers["c"]) if followers else 0,
        "following": int(following["c"]) if following else 0,
        "followedByViewer": followed,
        "isSelf": viewer_id == user_id,
        "spots": spots,
    }


def toggle_follow(followee_id: str, follower_id: str) -> dict[str, Any]:
    if followee_id == follower_id:
        raise ApiError(400, "self_follow", "不能关注自己")
    target = query_one("SELECT id FROM users WHERE id = ?", (followee_id,))
    if target is None:
        raise ApiError(404, "not_found", "用户不存在")
    existing = query_one(
        "SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?", (follower_id, followee_id)
    )
    if existing:
        execute("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", (follower_id, followee_id))
    else:
        execute(
            "INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)",
            (follower_id, followee_id, now_ms()),
        )
        notify(followee_id, follower_id, "follow", "user", followee_id, None)
    count = query_one("SELECT COUNT(*) AS c FROM follows WHERE followee_id = ?", (followee_id,))
    return {"following": existing is None, "followers": int(count["c"]) if count else 0}


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