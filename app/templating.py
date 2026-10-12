from __future__ import annotations

from pathlib import Path

from fastapi.templating import Jinja2Templates

from .config import settings
from .constants import goal_label, scene_label
from .utils import localize_ms

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
templates.env.filters["ts"] = localize_ms
NAV_LINKS = [
    {"href": "/studio", "label": "工作台", "key": "studio", "short": "工作台"},
    {"href": "/explore", "label": "发现机位", "key": "explore", "short": "发现"},
    {"href": "/academy", "label": "摄影课堂", "key": "academy", "short": "课堂"},
    {"href": "/publish", "label": "发布机位", "key": "publish", "short": "发布"},
]

templates.env.filters["goal_label"] = goal_label
templates.env.filters["scene_label"] = scene_label

templates.env.globals.update(
    app_name=settings.app_name,
    demo_mode=settings.demo_mode,
    tile_url=settings.map_tile_url,
    map_attribution=settings.map_attribution,
    map_copyright_url=settings.map_copyright_url,
    map_provider=settings.map_provider,
    amap_key=settings.amap_js_key,
    amap_security_code=settings.amap_security_code,
    nav_links=NAV_LINKS,
    scene_label=scene_label,
    goal_label=goal_label,
)