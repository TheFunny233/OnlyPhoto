from __future__ import annotations

from fastapi import APIRouter, Request

from ..security import require_user
from ..services.me import get_me_summary

router = APIRouter()


@router.get("/api/me")
def me(request: Request) -> dict:
    user = require_user(request)
    return get_me_summary(user["id"])