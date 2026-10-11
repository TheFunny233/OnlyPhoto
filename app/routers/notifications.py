from __future__ import annotations

from fastapi import APIRouter, Request

from ..security import require_same_origin, require_user
from ..services.notifications import (
    clear_read_notifications,
    count_notifications,
    list_notifications,
    mark_all_read,
    mark_read,
    unread_count,
)

router = APIRouter()


@router.get("/api/notifications")
def index(request: Request) -> dict:
    user = require_user(request)
    params = request.query_params
    if params.get("unread") == "1":
        return {"unread": unread_count(user["id"])}
    type_filter = params.get("type") or None
    offset = int(params.get("offset") or 0)
    limit = int(params.get("limit") or 30)
    items = list_notifications(user["id"], limit=limit, offset=offset, type_filter=type_filter)
    return {
        "notifications": items,
        "unread": unread_count(user["id"]),
        "total": count_notifications(user["id"], type_filter),
        "hasMore": offset + len(items) < count_notifications(user["id"], type_filter),
    }


@router.post("/api/notifications/read")
def read_all(request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"unread": mark_all_read(user["id"])}


@router.post("/api/notifications/clear-read")
def clear_read(request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    removed = clear_read_notifications(user["id"])
    return {"removed": removed, "unread": unread_count(user["id"])}


@router.post("/api/notifications/{notification_id}/read")
def read_one(notification_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"unread": mark_read(user["id"], notification_id)}