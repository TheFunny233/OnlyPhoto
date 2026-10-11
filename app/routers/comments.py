from __future__ import annotations

from fastapi import APIRouter, Request

from ..security import require_same_origin, require_user
from ..services.spots import delete_own_comment, toggle_comment_like

router = APIRouter()


@router.delete("/api/comments/{comment_id}")
def remove(comment_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    delete_own_comment(comment_id, user["id"])
    return {"ok": True}


@router.post("/api/comments/{comment_id}/like")
def like(comment_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return toggle_comment_like(comment_id, user["id"])