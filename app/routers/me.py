from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..db import execute, query_one
from ..security import require_same_origin, require_user
from ..services.me import get_me_summary

router = APIRouter()

VALID_PREFERENCES = {"balanced", "composition", "light", "color", "subject"}


class PreferencesIn(BaseModel):
    scorePreference: str = Field(min_length=1, max_length=20)


@router.get("/api/me")
def me(request: Request) -> dict:
    user = require_user(request)
    return get_me_summary(user["id"])


@router.get("/api/me/preferences")
def get_preferences(request: Request) -> dict:
    user = require_user(request)
    row = query_one("SELECT score_preference FROM users WHERE id = ?", (user["id"],))
    value = (row["score_preference"] if row else None) or "balanced"
    return {"scorePreference": value}


@router.put("/api/me/preferences")
def put_preferences(payload: PreferencesIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    value = payload.scorePreference if payload.scorePreference in VALID_PREFERENCES else "balanced"
    execute("UPDATE users SET score_preference = ? WHERE id = ?", (value, user["id"]))
    return {"scorePreference": value}