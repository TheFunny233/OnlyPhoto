from __future__ import annotations

from fastapi import APIRouter, Request

from ..security import require_same_origin, require_user
from ..services.notifications import list_notifications, mark_all_read, mark_read, unread_count

router = APIRouter()


@router.get("/api/notifications")
def index(request: Request) -> dict:
    user = require_user(request)
    if request.query_params.get("unread") == "1":
        return {"unread": unread_count(user["id"])}
    return {"notifications": list_notifications(user["id"]), "unread": unread_count(user["id"])}


@router.post("/api/notifications/read")
def read_all(request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"unread": mark_all_read(user["id"])}


@router.post("/api/notifications/{notification_id}/read")
def read_one(notification_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"unread": mark_read(user["id"], notification_id)}