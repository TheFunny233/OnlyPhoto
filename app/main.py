from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import run_migrations
from .errors import (
    ApiError,
    api_error_handler,
    unhandled_error_handler,
    validation_error_handler,
)
from .routers import (
    admin,
    analysis,
    auth,
    collections,
    comments,
    health,
    me,
    media,
    notifications,
    pages,
    photos,
    recipes,
    reports,
    spots,
    users,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    yield


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.middleware('http')
async def static_revalidate(request, call_next):
    """Always revalidate static assets.

    Without a Cache-Control header browsers apply heuristic freshness and may keep serving an
    old app.css/app.js for a long time after we change them (which made a new UI look
    "not working" until a hard refresh). `no-cache` still allows a cache but forces ETag
    revalidation, so changed files are picked up on a normal reload.
    """
    response = await call_next(request)
    if request.url.path.startswith('/static/'):
        response.headers['cache-control'] = 'no-cache, must-revalidate'
    elif 'text/html' in (response.headers.get('content-type') or ''):
        # Pages are cheap here; revalidating avoids "my new UI isn't there" after a deploy.
        response.headers['cache-control'] = 'no-cache, must-revalidate'
    return response


app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(photos.router)
app.include_router(media.router)
app.include_router(analysis.router)
app.include_router(recipes.router)
app.include_router(spots.router)
app.include_router(comments.router)
app.include_router(reports.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(collections.router)
app.include_router(notifications.router)
app.include_router(me.router)
app.include_router(pages.router)