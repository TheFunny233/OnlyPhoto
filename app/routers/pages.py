from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from ..constants import (
    CATEGORY_LABEL,
    GOAL_OPTIONS,
    LIGHT_SOURCE_LABEL,
    PRECISION_LABEL,
    PRIORITY_LABEL,
    PRIORITY_TONE,
    SCENE_OPTIONS,
    SUBJECT_OPTIONS,
)
from ..security import get_current_user
from ..services.me import get_me_summary
from ..services.photos import get_photo_detail, list_photos
from ..services.spots import get_spot, list_cities, list_comments, list_spots
from ..templating import templates
from ..errors import ApiError

router = APIRouter()

FEATURES = [
    {
        "title": "说得具体",
        "body": "指出画面依据，告诉你可以先做什么，而不是泛泛夸赞或审美打分。",
        "icon": '<path d="M12 3v4M12 17v4M4.5 12h4M15.5 12h4M6.7 6.7l2.8 2.8M14.5 14.5l2.8 2.8M17.3 6.7l-2.8 2.8M9.5 14.5l-2.8 2.8"/>',
    },
    {
        "title": "改得明白",
        "body": "区分“原图可修”和“需要重拍”，只对已经实现的处理提供一键预览与导出。",
        "icon": '<path d="M5 8h14M5 16h14"/><circle cx="9" cy="8" r="2"/><circle cx="15" cy="16" r="2"/>',
    },
    {
        "title": "去得有据",
        "body": "机位不是一句地名，而是样张、站位、方向、条件和来源的组合。",
        "icon": '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
    },
]


def _user(request: Request):
    return get_current_user(request)


@router.get("/", response_class=HTMLResponse)
def home(request: Request):
    try:
        spots = list_spots(limit=3)
    except Exception:
        spots = []
    return templates.TemplateResponse(
        request,
        "index.html",
        {"user": _user(request), "active": "home", "spots": spots, "features": FEATURES},
    )


@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html", {"user": _user(request), "active": ""})


@router.get("/register", response_class=HTMLResponse)
def register_page(request: Request):
    return templates.TemplateResponse(request, "register.html", {"user": _user(request), "active": ""})


@router.get("/studio", response_class=HTMLResponse)
def studio_page(request: Request):
    user = _user(request)
    photos = list_photos(user["id"]) if user else []
    return templates.TemplateResponse(
        request, "studio.html", {"user": user, "active": "studio", "photos": photos}
    )


@router.get("/studio/{photo_id}", response_class=HTMLResponse)
def workbench_page(photo_id: str, request: Request):
    user = _user(request)
    context = {
        "user": user,
        "active": "studio",
        "scene_options": SCENE_OPTIONS,
        "goal_options": GOAL_OPTIONS,
        "category_label": CATEGORY_LABEL,
        "priority_label": PRIORITY_LABEL,
        "priority_tone": PRIORITY_TONE,
        "photo_id": photo_id,
        "detail": None,
        "not_found": False,
    }
    if user is None:
        return templates.TemplateResponse(request, "workbench.html", context)
    try:
        context["detail"] = get_photo_detail(photo_id, user["id"])
    except ApiError:
        context["not_found"] = True
    return templates.TemplateResponse(request, "workbench.html", context)


@router.get("/explore", response_class=HTMLResponse)
def explore_page(request: Request):
    user = _user(request)
    spots = list_spots(viewer_id=user["id"] if user else None)
    return templates.TemplateResponse(
        request,
        "explore.html",
        {
            "user": user,
            "active": "explore",
            "spots": spots,
            "cities": list_cities(),
            "subjects": SUBJECT_OPTIONS,
        },
    )


@router.get("/spots/{spot_id}", response_class=HTMLResponse)
def spot_page(spot_id: str, request: Request):
    user = _user(request)
    try:
        spot = get_spot(spot_id, user["id"] if user else None)
    except ApiError:
        return templates.TemplateResponse(
            request, "spot_missing.html", {"user": user, "active": "explore"}
        )
    return templates.TemplateResponse(
        request,
        "spot.html",
        {
            "user": user,
            "active": "explore",
            "spot": spot,
            "comments": list_comments(spot_id),
            "light_source_label": LIGHT_SOURCE_LABEL,
            "precision_label": PRECISION_LABEL,
            "subjects": SUBJECT_OPTIONS,
        },
    )


@router.get("/publish", response_class=HTMLResponse)
def publish_page(request: Request):
    user = _user(request)
    photos = list_photos(user["id"]) if user else []
    return templates.TemplateResponse(
        request,
        "publish.html",
        {
            "user": user,
            "active": "publish",
            "photos": photos,
            "subjects": SUBJECT_OPTIONS,
            "preselect": request.query_params.get("photoId") or "",
        },
    )


@router.get("/me", response_class=HTMLResponse)
def me_page(request: Request):
    user = _user(request)
    summary = get_me_summary(user["id"]) if user else None
    return templates.TemplateResponse(request, "me.html", {"user": user, "active": "me", "summary": summary})


@router.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    return templates.TemplateResponse(request, "settings.html", {"user": _user(request), "active": ""})


@router.get("/privacy", response_class=HTMLResponse)
def privacy_page(request: Request):
    from ..config import settings

    return templates.TemplateResponse(
        request,
        "privacy.html",
        {"user": _user(request), "active": "", "ai_mode": settings.ai.mode, "demo_mode": settings.demo_mode},
    )


@router.get("/about", response_class=HTMLResponse)
def about_page(request: Request):
    return templates.TemplateResponse(request, "about.html", {"user": _user(request), "active": ""})