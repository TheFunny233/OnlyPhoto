from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse

from ..db import query_one, upload_dir
from ..imaging import photo_thumb_key
from ..security import get_current_user
from ..services.photos import get_owned_photo

router = APIRouter()


def _not_found(message: str) -> JSONResponse:
    return JSONResponse(status_code=404, content={"error": {"code": "not_found", "message": message}})


@router.get("/api/photos/{photo_id}/media")
def photo_media(photo_id: str, request: Request):
    user = get_current_user(request)
    if user is None:
        return JSONResponse(status_code=401, content={"error": {"code": "unauthenticated", "message": "请先登录"}})
    photo = get_owned_photo(photo_id, user["id"])
    if photo is None:
        return _not_found("照片不存在或无权访问")

    want_thumb = request.query_params.get("thumb") == "1"
    key = photo_thumb_key(photo["storage_key"], photo["id"]) if want_thumb else photo["storage_key"]
    path = upload_dir() / key
    if not path.exists():
        return _not_found("文件不存在")
    media_type = "image/jpeg" if want_thumb else photo["mime_type"]
    return FileResponse(path, media_type=media_type, headers={"cache-control": "private, max-age=60"})


@router.get("/api/spots/{spot_id}/media/{media_id}")
def spot_media(spot_id: str, media_id: str):
    spot = query_one("SELECT status FROM spots WHERE id = ?", (spot_id,))
    if spot is None or spot["status"] != "published":
        return _not_found("图片不存在")
    media = query_one("SELECT storage_key FROM spot_media WHERE id = ? AND spot_id = ?", (media_id, spot_id))
    if media is None:
        return _not_found("图片不存在")
    path = upload_dir() / media["storage_key"]
    if not path.exists():
        return _not_found("图片文件不存在")
    return FileResponse(path, media_type="image/jpeg", headers={"cache-control": "public, max-age=300"})