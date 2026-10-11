from __future__ import annotations

from fastapi import APIRouter, Request
from starlette.datastructures import UploadFile

from ..errors import ApiError
from ..ratelimit import rate_limit
from ..security import require_same_origin, require_user
from ..services.photos import create_photo_from_upload, delete_photo, get_photo_detail, list_photos

router = APIRouter()


@router.get("/api/photos")
def index(request: Request) -> dict:
    user = require_user(request)
    return {"photos": list_photos(user["id"])}


@router.post("/api/photos")
async def upload(request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    if not rate_limit(f"upload:{user['id']}", 30, 10 * 60):
        raise ApiError(429, "rate_limited", "上传过于频繁，请稍后再试")

    form = await request.form()
    file = form.get("file")
    if not isinstance(file, UploadFile):
        raise ApiError(400, "no_file", "请选择要上传的图片文件")
    buffer = await file.read()
    result = create_photo_from_upload(user["id"], file.filename or "upload", buffer)
    return {"photo": {"id": result["photo"]["id"]}}


@router.get("/api/photos/{photo_id}")
def detail(photo_id: str, request: Request) -> dict:
    user = require_user(request)
    return get_photo_detail(photo_id, user["id"])


@router.delete("/api/photos/{photo_id}")
def remove(photo_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    delete_photo(photo_id, user["id"])
    return {"ok": True}