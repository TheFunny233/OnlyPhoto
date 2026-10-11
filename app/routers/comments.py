from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..security import require_same_origin, require_user
from ..services.spots import delete_own_comment, toggle_comment_like, update_comment

router = APIRouter()


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1, max_length=600)


@router.patch("/api/comments/{comment_id}")
def patch(comment_id: str, payload: CommentUpdate, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"comment": update_comment(comment_id, user["id"], payload.body)}


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