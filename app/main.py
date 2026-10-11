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
    comments,
    health,
    me,
    media,
    pages,
    photos,
    recipes,
    reports,
    spots,
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
app.include_router(me.router)
app.include_router(pages.router)