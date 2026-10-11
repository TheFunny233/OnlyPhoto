from __future__ import annotations

from fastapi import APIRouter, Request

from ..security import get_current_user, require_same_origin, require_user
from ..services.recommend import recommend_spots
from ..services.spots import toggle_follow, user_profile

router = APIRouter()


@router.get("/api/users/{user_id}")
def profile(user_id: str, request: Request) -> dict:
    viewer = get_current_user(request)
    return {"user": user_profile(user_id, viewer["id"] if viewer else None)}


@router.post("/api/users/{user_id}/follow")
def follow(user_id: str, request: Request) -> dict:
    require_same_origin(request)
    viewer = require_user(request)
    return toggle_follow(user_id, viewer["id"])


@router.get("/api/recommendations")
def recommendations(request: Request) -> dict:
    viewer = get_current_user(request)
    limit = int(request.query_params.get("limit") or 8)
    exclude = request.query_params.get("exclude") or None
    return {"spots": recommend_spots(viewer["id"] if viewer else None, limit=limit, exclude_spot_id=exclude)}