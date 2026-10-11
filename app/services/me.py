from __future__ import annotations

from typing import Any

from ..db import query_all
from ..utils import iso_from_ms, loads
from .photos import list_photos


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