from __future__ import annotations

from typing import Any

from ..db import execute, query_all, query_one
from ..errors import ApiError
from ..imaging import delete_photo_files, ingest_image, photo_thumb_key
from ..utils import iso_from_ms, new_id, now_ms


def _photo_dto(photo: Any) -> dict[str, Any]:
    job = query_one(
        "SELECT status FROM analysis_jobs WHERE photo_id = ? ORDER BY created_at DESC LIMIT 1",
        (photo["id"],),
    )
    if job is None:
        analysis_status = "none"
    elif job["status"] == "succeeded":
        analysis_status = "succeeded"
    elif job["status"] == "failed":
        analysis_status = "failed"
    elif job["status"] in {"processing", "queued"}:
        analysis_status = "processing"
    else:
        analysis_status = "none"
    return {
        "id": photo["id"],
        "originalName": photo["original_name"],
        "mimeType": photo["mime_type"],
        "width": photo["width"],
        "height": photo["height"],
        "bytes": photo["bytes"],
        "privacy": photo["privacy"],
        "createdAt": iso_from_ms(photo["created_at"]),
        "analysisStatus": analysis_status,
        "mediaUrl": f"/api/photos/{photo['id']}/media",
        "thumbUrl": f"/api/photos/{photo['id']}/media?thumb=1",
    }


def list_photos(owner_id: str) -> list[dict[str, Any]]:
    rows = query_all("SELECT * FROM photos WHERE owner_id = ? ORDER BY created_at DESC", (owner_id,))
    return [_photo_dto(row) for row in rows]


def get_owned_photo(photo_id: str, owner_id: str):
    return query_one("SELECT * FROM photos WHERE id = ? AND owner_id = ?", (photo_id, owner_id))


def create_photo_from_upload(owner_id: str, filename: str, buffer: bytes) -> dict[str, Any]:
    original_name = filename or "upload"
    if not buffer:
        raise ApiError(400, "empty_file", "请选择要上传的图片")
    photo_id = new_id()
    ingested = ingest_image(owner_id, photo_id, original_name, buffer)
    execute(
        """
        INSERT INTO photos
            (id, owner_id, storage_key, original_name, mime_type, width, height, bytes,
             content_hash, privacy, is_demo, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', false, ?)
        """,
        (
            photo_id,
            owner_id,
            ingested["storage_key"],
            original_name,
            ingested["mime_type"],
            ingested["width"],
            ingested["height"],
            ingested["bytes"],
            ingested["content_hash"],
            now_ms(),
        ),
    )
    photo = query_one("SELECT * FROM photos WHERE id = ?", (photo_id,))
    return {"photo": photo, "content_hash": ingested["content_hash"]}


def delete_photo(photo_id: str, owner_id: str) -> None:
    photo = get_owned_photo(photo_id, owner_id)
    if photo is None:
        raise ApiError(404, "not_found", "照片不存在")
    execute("DELETE FROM photos WHERE id = ?", (photo_id,))
    delete_photo_files(
        [
            photo["storage_key"],
            photo_thumb_key(photo["storage_key"], photo["id"]),
            f"ai/{photo['id']}.jpg",
        ]
    )


def get_photo_detail(photo_id: str, owner_id: str) -> dict[str, Any]:
    from ..ai.analyze import get_latest_succeeded_analysis
    from ..utils import loads

    photo = get_owned_photo(photo_id, owner_id)
    if photo is None:
        raise ApiError(404, "not_found", "照片不存在或无权访问")
    analysis = get_latest_succeeded_analysis(photo_id)
    recipe_row = query_one("SELECT recipe FROM edit_recipes WHERE photo_id = ?", (photo_id,))
    return {
        "photo": _photo_dto(photo),
        "analysis": analysis["analysis"] if analysis else None,
        "receipt": analysis["receipt"] if analysis else None,
        "jobId": analysis["jobId"] if analysis else None,
        "recipe": loads(recipe_row["recipe"]) if recipe_row else None,
    }