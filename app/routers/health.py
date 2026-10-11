from __future__ import annotations

from fastapi import APIRouter

from ..config import is_ai_live_configured, settings
from ..utils import iso_from_ms, now_ms

router = APIRouter()


@router.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "app": settings.app_name,
        "demoMode": settings.demo_mode,
        "aiMode": settings.ai.mode,
        "aiLiveConfigured": is_ai_live_configured(),
        "mapConfigured": bool(settings.map_tile_url),
        "time": iso_from_ms(now_ms()),
    }