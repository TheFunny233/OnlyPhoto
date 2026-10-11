from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..security import require_same_origin, require_user
from ..services.spots import create_report

router = APIRouter()


class ReportIn(BaseModel):
    targetType: str
    targetId: str = Field(min_length=1, max_length=60)
    reason: str = Field(min_length=1, max_length=500)


@router.post("/api/reports")
def create(payload: ReportIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return create_report(user["id"], payload.targetType, payload.targetId, payload.reason)