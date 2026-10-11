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
from ..services.recommend import recommend_spots
from ..services.spots import (
    get_spot,
    list_cities,
    list_comments,
    list_spots,
    list_topics,
    record_view,
    related_spots,
    user_profile,
)
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
    user = _user(request)
    try:
        spots = list_spots(limit=3)["spots"]
    except Exception:
        spots = []
    try:
        recommended = recommend_spots(user["id"] if user else None, limit=3)
    except Exception:
        recommended = []
    return templates.TemplateResponse(
        request,
        "index.html",
        {
            "user": user,
            "active": "home",
            "spots": spots,
            "recommended": recommended,
            "features": FEATURES,
        },
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
    from ..db import query_one

    pref_row = query_one("SELECT score_preference FROM users WHERE id = ?", (user["id"],))
    context["score_preference"] = (pref_row["score_preference"] if pref_row else None) or "balanced"

    # ?compare=<photoId> shows the previous version's score next to the current one.
    compare_photo_id = request.query_params.get("compare") or ""
    comparison = None
    if compare_photo_id and compare_photo_id != photo_id:
        from ..services.photos import get_analysis_history

        try:
            history = get_analysis_history(compare_photo_id, user["id"], limit=1)
            if history and history[0].get("overall") is not None:
                comparison = {
                    "photoId": compare_photo_id,
                    "overall": history[0]["overall"],
                    "createdAt": history[0]["createdAt"],
                }
        except ApiError:
            comparison = None
    context["comparison"] = comparison
    return templates.TemplateResponse(request, "workbench.html", context)


@router.get("/explore", response_class=HTMLResponse)
def explore_page(request: Request):
    user = _user(request)
    params = request.query_params
    near = None
    if params.get("near") == "1" and params.get("lat") and params.get("lng"):
        try:
            near = (float(params["lat"]), float(params["lng"]))
        except ValueError:
            near = None
    sort = params.get("sort") or "latest"
    if sort not in {"latest", "hot", "commented", "near"}:
        sort = "latest"
    feed = params.get("feed") or ""
    result = list_spots(
        city=params.get("city") or None,
        subject=params.get("subject") or None,
        q=params.get("q") or None,
        author=params.get("author") or None,
        viewer_id=user["id"] if user else None,
        favorites_of=user["id"] if (params.get("favorites") == "1" and user) else None,
        feed_following_of=user["id"] if (feed == "following" and user) else None,
        sort=sort,
        near=near,
        limit=24,
    )
    return templates.TemplateResponse(
        request,
        "explore.html",
        {
            "user": user,
            "active": "explore",
            "spots": result["spots"],
            "total": result["total"],
            "has_more": result["hasMore"],
            "cities": list_cities(),
            "subjects": SUBJECT_OPTIONS,
            "filters": {
                "city": params.get("city") or "",
                "subject": params.get("subject") or "",
                "q": params.get("q") or "",
                "author": params.get("author") or "",
                "sort": sort,
                "favorites": params.get("favorites") == "1",
                "near": params.get("near") == "1",
                "feed": feed,
            },
            "following_count": _following_count(user["id"]) if user else 0,
            "topics": list_topics(user["id"] if user else None)[:10],
            "recommended": recommend_spots(user["id"] if user else None, limit=4),
        },
    )


def _following_count(user_id: str) -> int:
    from ..db import query_one

    row = query_one("SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?", (user_id,))
    return int(row["c"]) if row else 0


@router.get("/me/collections", response_class=HTMLResponse)
def collections_page(request: Request):
    from ..services.collections import list_collections

    user = _user(request)
    if user is None:
        return templates.TemplateResponse(
            request,
            "login_required.html",
            {"user": None, "active": "", "reason": "登录后即可查看与管理你自己的内容。"},
        )
    return templates.TemplateResponse(
        request,
        "collections.html",
        {"user": user, "active": "me", "collections": list_collections(user["id"])},
    )


@router.get("/me/collections/{collection_id}", response_class=HTMLResponse)
def collection_detail_page(collection_id: str, request: Request):
    from ..services.collections import get_collection
    from ..services.spots import list_spots

    user = _user(request)
    if user is None:
        return templates.TemplateResponse(
            request,
            "login_required.html",
            {"user": None, "active": "", "reason": "登录后即可查看与管理你自己的内容。"},
        )
    try:
        collection = get_collection(collection_id, user["id"], user["id"])
    except ApiError:
        return templates.TemplateResponse(
            request,
            "message.html",
            {
                "user": user,
                "active": "",
                "title": "收藏夹不存在",
                "message": "它可能已被删除，或不属于你。",
                "back_href": "/me/collections",
                "back_label": "返回收藏夹",
            },
        )
    favorites = list_spots(favorites_of=user["id"], viewer_id=user["id"], limit=100)["spots"]
    in_collection = {spot["id"] for spot in collection["spots"]}
    return templates.TemplateResponse(
        request,
        "collection_detail.html",
        {
            "user": user,
            "active": "me",
            "collection": collection,
            "favorites": [spot for spot in favorites if spot["id"] not in in_collection],
        },
    )


@router.get("/me/favorites", response_class=HTMLResponse)
def favorites_page(request: Request):
    user = _user(request)
    if user is None:
        return templates.TemplateResponse(
            request,
            "login_required.html",
            {"user": None, "active": "", "reason": "登录后即可查看与管理你自己的内容。"},
        )
    result = list_spots(favorites_of=user["id"], viewer_id=user["id"], limit=100)
    return templates.TemplateResponse(
        request,
        "favorites.html",
        {"user": user, "active": "me", "spots": result["spots"], "total": result["total"]},
    )


@router.get("/spots/{spot_id}", response_class=HTMLResponse)
def spot_page(spot_id: str, request: Request):
    user = _user(request)
    viewer_id = user["id"] if user else None
    try:
        spot = get_spot(spot_id, viewer_id)
    except ApiError:
        return templates.TemplateResponse(
            request, "spot_missing.html", {"user": user, "active": "explore"}
        )
    try:
        record_view(spot_id, viewer_id or _client_key(request))
        spot = get_spot(spot_id, viewer_id)
    except ApiError:
        pass
    return templates.TemplateResponse(
        request,
        "spot.html",
        {
            "user": user,
            "active": "explore",
            "spot": spot,
            "comments": list_comments(
                spot_id,
                viewer_id,
                "hot" if request.query_params.get("csort") == "hot" else "new",
            ),
            "csort": "hot" if request.query_params.get("csort") == "hot" else "new",
            "recommended": recommend_spots(viewer_id, limit=4, exclude_spot_id=spot_id),
            "related": related_spots(spot_id, viewer_id, limit=4),
            "light_source_label": LIGHT_SOURCE_LABEL,
            "precision_label": PRECISION_LABEL,
            "subjects": SUBJECT_OPTIONS,
        },
    )


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anonymous"


@router.get("/u/{user_id}", response_class=HTMLResponse)
def user_page(user_id: str, request: Request):
    user = _user(request)
    try:
        profile = user_profile(user_id, user["id"] if user else None)
    except ApiError:
        return templates.TemplateResponse(
            request, "spot_missing.html", {"user": user, "active": "explore"}
        )
    return templates.TemplateResponse(
        request,
        "user.html",
        {"user": user, "active": "", "profile": profile},
    )


@router.get("/topics", response_class=HTMLResponse)
def topics_page(request: Request):
    from ..services.spots import list_topics

    user = _user(request)
    return templates.TemplateResponse(
        request,
        "topics.html",
        {"user": user, "active": "", "topics": list_topics(user["id"] if user else None)},
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


@router.get("/admin/reports", response_class=HTMLResponse)
def admin_reports_page(request: Request):
    """Maintenance UI shell. The token is entered in the browser and kept in memory only."""
    return templates.TemplateResponse(
        request,
        "admin_reports.html",
        {"user": _user(request), "active": ""},
    )


@router.get("/notifications", response_class=HTMLResponse)
def notifications_page(request: Request):
    user = _user(request)
    if user is None:
        return templates.TemplateResponse(
            request,
            "login_required.html",
            {"user": None, "active": "", "reason": "登录后即可查看与管理你自己的内容。"},
        )
    from ..services.notifications import list_notifications, unread_count

    return templates.TemplateResponse(
        request,
        "notifications.html",
        {
            "user": user,
            "active": "",
            "items": list_notifications(user["id"]),
            "unread": unread_count(user["id"]),
        },
    )


@router.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request):
    return templates.TemplateResponse(request, "settings.html", {"user": _user(request), "active": ""})


@router.get("/scoring-guide", response_class=HTMLResponse)
def scoring_guide_page(request: Request):
    return templates.TemplateResponse(request, "scoring_guide.html", {"user": _user(request), "active": ""})


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