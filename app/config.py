from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent

# Same environment files as the reference implementation.
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

AI_PROMPT_VERSION = "pm-analysis-v1"


def _bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return value.strip().lower() in {"true", "1", "yes", "on"}


def _int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _str(name: str, default: str) -> str:
    value = os.getenv(name)
    return default if value is None or value == "" else value


@dataclass
class AiSettings:
    mode: str
    protocol: str
    base_url: str
    api_key: str
    vision_model: str
    request_timeout_ms: int
    max_output_tokens: int
    max_retries: int
    max_image_edge: int
    max_image_bytes: int
    user_daily_request_limit: int
    disable_thinking: bool


@dataclass
class Settings:
    app_name: str
    app_url: str
    demo_mode: bool
    database_url: str
    upload_dir: str
    session_secret: str
    registration_open: bool
    maintenance_token: str
    ai: AiSettings
    live_run: bool
    live_max_requests: int
    map_tile_url: str
    map_attribution: str
    map_copyright_url: str
    map_provider: str
    amap_js_key: str
    amap_security_code: str
    sensitive_words: tuple[str, ...]
    upload_max_bytes: int
    upload_max_pixels: int
    port: int


def load_settings() -> Settings:
    env = os.environ
    amap_key = env.get("AMAP_JS_KEY", "")
    explicit_provider = env.get("MAP_PROVIDER", "").strip().lower()
    if explicit_provider in {"amap", "osm"}:
        map_provider = explicit_provider
    else:
        map_provider = "amap" if amap_key else "osm"
    return Settings(
        app_name=_str("APP_NAME", "OnlyPhoto"),
        app_url=_str("APP_URL", "http://localhost:8000"),
        demo_mode=_bool("APP_DEMO_MODE", True),
        database_url=_str("DATABASE_URL", "file:./data/onlyphoto.db"),
        upload_dir=_str("UPLOAD_DIR", "./data/uploads"),
        session_secret=env.get("SESSION_SECRET", ""),
        registration_open=_bool("REGISTRATION_OPEN", True),
        maintenance_token=env.get("MAINTENANCE_TOKEN", ""),
        ai=AiSettings(
            mode="live" if _str("AI_MODE", "mock") == "live" else "mock",
            protocol=_str("AI_PROTOCOL", "chat_completions"),
            base_url=env.get("AI_BASE_URL", ""),
            api_key=env.get("AI_API_KEY", ""),
            vision_model=env.get("AI_VISION_MODEL", ""),
            request_timeout_ms=_int("AI_REQUEST_TIMEOUT_MS", 45_000),
            max_output_tokens=_int("AI_MAX_OUTPUT_TOKENS", 1800),
            max_retries=_int("AI_MAX_RETRIES", 1),
            max_image_edge=_int("AI_MAX_IMAGE_EDGE", 1600),
            max_image_bytes=_int("AI_MAX_IMAGE_BYTES", 3_000_000),
            user_daily_request_limit=_int("AI_USER_DAILY_REQUEST_LIMIT", 10),
            disable_thinking=_bool("AI_DISABLE_THINKING", False),
        ),
        live_run=_bool("RUN_LIVE_AI_TESTS", False),
        live_max_requests=_int("LIVE_TEST_MAX_REQUESTS", 12),
        map_tile_url=_str(
            "NEXT_PUBLIC_MAP_TILE_URL", "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        ),
        map_attribution=_str("NEXT_PUBLIC_MAP_ATTRIBUTION", "OpenStreetMap contributors"),
        map_copyright_url="https://www.openstreetmap.org/copyright",
        map_provider=map_provider,
        amap_js_key=amap_key,
        amap_security_code=env.get("AMAP_SECURITY_CODE", ""),
        sensitive_words=tuple(
            word.strip() for word in env.get("SENSITIVE_WORDS", "").split(",") if word.strip()
        ),
        upload_max_bytes=15 * 1024 * 1024,
        upload_max_pixels=40_000_000,
        port=_int("PORT", 8000),
    )


settings = load_settings()

ACCEPTED_MIME = {"image/jpeg", "image/png", "image/webp"}


def amap_effective_key() -> str:
    """The key actually usable by the browser (empty when falling back to OSM)."""
    return settings.amap_js_key if settings.map_provider == "amap" else ""


def is_ai_live_configured() -> bool:
    ai = settings.ai
    return bool(ai.mode == "live" and ai.base_url and ai.api_key and ai.vision_model)