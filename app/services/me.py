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
    return {
        "counts": {
            "photos": len(photos),
            "analyses": len([p for p in photos if p["analysisStatus"] == "succeeded"]),
            "spots": len(my_spots),
            "favorites": len(favorite_spots),
            "edits": len(recipes),
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
    }