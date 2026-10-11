from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..db import execute, query_one
from ..editmath import normalize_recipe
from ..errors import ApiError
from ..security import require_same_origin, require_user
from ..services.photos import get_owned_photo
from ..utils import dumps, loads, new_id, now_ms

router = APIRouter()


class RecipeIn(BaseModel):
    crop: dict[str, Any] | None = None
    exposureEv: float | None = None
    contrast: float | None = None
    saturation: float | None = None
    warmth: float | None = None


@router.get("/api/photos/{photo_id}/recipe")
def get_recipe(photo_id: str, request: Request) -> dict:
    user = require_user(request)
    if get_owned_photo(photo_id, user["id"]) is None:
        raise ApiError(404, "not_found", "照片不存在")
    row = query_one("SELECT recipe FROM edit_recipes WHERE photo_id = ?", (photo_id,))
    return {"recipe": loads(row["recipe"]) if row else None}


@router.put("/api/photos/{photo_id}/recipe")
def put_recipe(photo_id: str, payload: RecipeIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    if get_owned_photo(photo_id, user["id"]) is None:
        raise ApiError(404, "not_found", "照片不存在或无权访问")
    recipe = normalize_recipe(payload.model_dump())
    existing = query_one("SELECT id FROM edit_recipes WHERE photo_id = ?", (photo_id,))
    if existing:
        execute(
            "UPDATE edit_recipes SET recipe = ?, updated_at = ? WHERE photo_id = ?",
            (dumps(recipe), now_ms(), photo_id),
        )
    else:
        execute(
            "INSERT INTO edit_recipes (id, photo_id, owner_id, recipe, updated_at) VALUES (?, ?, ?, ?, ?)",
            (new_id(), photo_id, user["id"], dumps(recipe), now_ms()),
        )
    return {"recipe": recipe}