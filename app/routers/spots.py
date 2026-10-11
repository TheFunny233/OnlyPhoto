from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..errors import ApiError
from ..security import get_current_user, require_same_origin, require_user
from ..services.spots import (
    add_comment,
    create_spot,
    delete_spot,
    get_spot,
    list_cities,
    list_comments,
    list_spots,
    toggle_favorite,
    toggle_like,
    update_spot,
)

router = APIRouter()


class SpotIn(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    city: str = Field(min_length=1, max_length=60)
    area: str = Field(default="", max_length=120)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    coordSystem: str = Field(default="WGS84", max_length=20)
    precision: str
    subjects: list[str] = Field(default_factory=list, max_length=10)
    description: str = Field(default="", max_length=2000)
    howToStand: str = Field(default="", max_length=2000)
    direction: str = Field(default="", max_length=120)
    bestLight: str = Field(default="", max_length=500)
    lightSource: str = "unconfirmed"
    gear: str = Field(default="", max_length=300)
    safety: str = Field(default="", max_length=500)
    status: str = "published"
    photoId: str | None = None


class SpotPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=80)
    city: str | None = Field(default=None, min_length=1, max_length=60)
    area: str | None = Field(default=None, max_length=120)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    precision: str | None = None
    subjects: list[str] | None = Field(default=None, max_length=10)
    description: str | None = Field(default=None, max_length=2000)
    howToStand: str | None = Field(default=None, max_length=2000)
    direction: str | None = Field(default=None, max_length=120)
    bestLight: str | None = Field(default=None, max_length=500)
    lightSource: str | None = None
    gear: str | None = Field(default=None, max_length=300)
    safety: str | None = Field(default=None, max_length=500)
    status: str | None = None


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=600)


@router.get("/api/spots")
def index(request: Request) -> dict:
    user = get_current_user(request)
    params = request.query_params
    only_favorites = params.get("favorites") == "1"
    spots = list_spots(
        city=params.get("city") or None,
        subject=params.get("subject") or None,
        q=params.get("q") or None,
        viewer_id=user["id"] if user else None,
        favorites_of=user["id"] if (only_favorites and user) else None,
        limit=int(params.get("limit") or 200),
    )
    return {"spots": spots, "cities": list_cities()}


@router.post("/api/spots")
def create(payload: SpotIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    if payload.precision not in {"exact", "approximate"}:
        raise ApiError(400, "invalid_input", "位置精度不合法")
    if payload.lightSource not in {"author_experience", "external", "unconfirmed"}:
        payload.lightSource = "unconfirmed"
    if payload.status not in {"draft", "published"}:
        payload.status = "published"
    spot = create_spot(user["id"], payload.model_dump())
    return {"spot": spot}


@router.get("/api/spots/{spot_id}")
def detail(spot_id: str, request: Request) -> dict:
    user = get_current_user(request)
    return {"spot": get_spot(spot_id, user["id"] if user else None)}


@router.patch("/api/spots/{spot_id}")
def patch(spot_id: str, payload: SpotPatch, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    data: dict[str, Any] = {k: v for k, v in payload.model_dump().items() if v is not None}
    return {"spot": update_spot(spot_id, user["id"], data)}


@router.delete("/api/spots/{spot_id}")
def remove(spot_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    delete_spot(spot_id, user["id"])
    return {"ok": True}


@router.post("/api/spots/{spot_id}/like")
def like(spot_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return toggle_like(spot_id, user["id"])


@router.post("/api/spots/{spot_id}/favorite")
def favorite(spot_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return toggle_favorite(spot_id, user["id"])


@router.get("/api/spots/{spot_id}/comments")
def comments(spot_id: str, request: Request) -> dict:
    user = get_current_user(request)
    get_spot(spot_id, user["id"] if user else None)
    return {"comments": list_comments(spot_id)}


@router.post("/api/spots/{spot_id}/comments")
def post_comment(spot_id: str, payload: CommentIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"comment": add_comment(spot_id, user["id"], payload.body)}