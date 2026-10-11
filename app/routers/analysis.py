from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..ai.analyze import run_analysis
from ..constants import GOAL_VALUES, SCENE_VALUES
from ..errors import ApiError
from ..imaging import read_ai_input_base64
from ..security import require_same_origin, require_user
from ..services.photos import get_owned_photo

router = APIRouter()


class AnalysisIn(BaseModel):
    scene: str = Field(default="auto", max_length=30)
    goals: list[str] = Field(default_factory=list, max_length=10)
    force: bool = False


@router.post("/api/photos/{photo_id}/analysis")
def analyze(photo_id: str, payload: AnalysisIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    photo = get_owned_photo(photo_id, user["id"])
    if photo is None:
        raise ApiError(404, "not_found", "照片不存在或无权访问")

    scene = payload.scene if payload.scene in SCENE_VALUES else "auto"
    goals = [g for g in payload.goals if g in GOAL_VALUES]

    image_base64 = read_ai_input_base64(photo_id)
    if not image_base64:
        raise ApiError(500, "ai_input_missing", "分析用的图片副本缺失，请重新上传")

    return run_analysis(
        user_id=user["id"],
        photo_id=photo_id,
        content_hash=photo["content_hash"],
        image_base64=image_base64,
        mime_type="image/jpeg",
        scene=scene,
        goals=goals,
        force=payload.force,
    )