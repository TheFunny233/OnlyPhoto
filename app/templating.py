from __future__ import annotations

from pathlib import Path

from fastapi.templating import Jinja2Templates

from .config import settings
from .utils import localize_ms

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
templates.env.filters["ts"] = localize_ms
NAV_LINKS = [
    {"href": "/studio", "label": "工作台", "key": "studio"},
    {"href": "/explore", "label": "发现机位", "key": "explore"},
    {"href": "/publish", "label": "发布机位", "key": "publish"},
]

templates.env.globals.update(
    app_name=settings.app_name,
    demo_mode=settings.demo_mode,
    tile_url=settings.map_tile_url,
    map_attribution=settings.map_attribution,
    map_copyright_url=settings.map_copyright_url,
    nav_links=NAV_LINKS,
)