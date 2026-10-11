from __future__ import annotations

from typing import Any

from ..db import query_all
from ..utils import iso_from_ms, loads
from .photos import list_photos


def get_score_overview(user_id: str, limit: int = 20) -> dict[str, Any]:
    """Aggregate the user's latest score per photo (newest analysis wins)."""
    rows = query_all(
        """
        SELECT p.id AS photo_id, p.original_name, j.finished_at, j.created_at, r.data
          FROM photos p
          JOIN analysis_jobs j ON j.photo_id = p.id AND j.status = 'succeeded'
          JOIN analysis_results r ON r.job_id = j.id
         WHERE p.owner_id = ?
         ORDER BY COALESCE(j.finished_at, j.created_at) DESC
        """,
        (user_id,),
    )
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        if row["photo_id"] in latest:
            continue
        data = loads(row["data"]) or {}
        score = (data.get("score") or {}).get("overall")
        if score is None:
            continue
        latest[row["photo_id"]] = {
            "photoId": row["photo_id"],
            "originalName": row["original_name"],
            "overall": score,
            "at": iso_from_ms(row["finished_at"] or row["created_at"]),
        }
    scored = list(latest.values())
    if not scored:
        return {"count": 0, "average": None, "best": [], "recent": []}

    ranked = sorted(scored, key=lambda item: item["overall"], reverse=True)
    average = round(sum(item["overall"] for item in scored) / len(scored))
    return {
        "count": len(scored),
        "average": average,
        "best": ranked[:3],
        "recent": sorted(scored, key=lambda item: item["at"] or "", reverse=True)[:limit],
    }


def get_me_summary(user_id: str) -> dict[str, Any]:
    photos = list_photos(user_id)
    my_spots = query_all(
        "SELECT id, title, city, status, created_at FROM spots WHERE owner_id = ? ORDER BY created_at DESC",
        (user_id,),
    )
    favorite_rows = query_all(
        "SELECT spot_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    )
    favorite_spots: list[dict[str, Any]] = []
    for row in favorite_rows:
        spot = query_all("SELECT id, title, city, status FROM spots WHERE id = ?", (row["spot_id"],))
        if spot:
            favorite_spots.append(
                {"id": spot[0]["id"], "title": spot[0]["title"], "city": spot[0]["city"], "status": spot[0]["status"]}
            )
    recipes = query_all(
        "SELECT photo_id, recipe, updated_at FROM edit_recipes WHERE owner_id = ? ORDER BY updated_at DESC",
        (user_id,),
    )
    followers = query_all("SELECT COUNT(*) AS c FROM follows WHERE followee_id = ?", (user_id,))
    following = query_all("SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?", (user_id,))
    my_comments = query_all(
        """
        SELECT c.id, c.body, c.created_at, c.spot_id, s.title AS spot_title
          FROM comments c LEFT JOIN spots s ON s.id = c.spot_id
         WHERE c.user_id = ? AND c.status = 'visible'
         ORDER BY c.created_at DESC
         LIMIT 20
        """,
        (user_id,),
    )
    return {
        "scoreOverview": get_score_overview(user_id),
        "counts": {
            "photos": len(photos),
            "analyses": len([p for p in photos if p["analysisStatus"] == "succeeded"]),
            "spots": len(my_spots),
            "favorites": len(favorite_spots),
            "edits": len(recipes),
            "followers": int(followers[0]["c"]) if followers else 0,
            "following": int(following[0]["c"]) if following else 0,
        },
        "photos": photos,
        "spots": [
            {"id": s["id"], "title": s["title"], "city": s["city"], "status": s["status"], "createdAt": iso_from_ms(s["created_at"])}
            for s in my_spots
        ],
        "favoriteSpots": favorite_spots,
        "recentEdits": [
            {"photoId": r["photo_id"], "updatedAt": iso_from_ms(r["updated_at"]), "recipe": loads(r["recipe"])}
            for r in recipes
        ],
        "comments": [
            {
                "id": r["id"],
                "body": r["body"],
                "createdAt": iso_from_ms(r["created_at"]),
                "spotId": r["spot_id"],
                "spotTitle": r["spot_title"] or "（已删除的机位）",
            }
            for r in my_comments
        ],
    }