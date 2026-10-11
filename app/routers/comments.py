from __future__ import annotations

from fastapi import APIRouter, Request

from ..security import require_same_origin, require_user
from ..services.spots import delete_own_comment

router = APIRouter()


@router.delete("/api/comments/{comment_id}")
def remove(comment_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    delete_own_comment(comment_id, user["id"])
    return {"ok": True}