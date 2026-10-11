from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from ..security import require_maintenance, require_same_origin
from ..services.spots import list_reports, resolve_report

router = APIRouter()


class ResolveIn(BaseModel):
    reportId: str
    action: str


@router.get("/api/admin/reports")
def index(request: Request) -> dict:
    require_maintenance(request)
    return {"reports": list_reports()}


@router.post("/api/admin/reports")
def resolve(payload: ResolveIn, request: Request) -> dict:
    require_same_origin(request)
    require_maintenance(request)
    if payload.action not in {"resolve", "hide"}:
        from ..errors import ApiError

        raise ApiError(400, "invalid_input", "请求不合法")
    return resolve_report(payload.reportId, payload.action)