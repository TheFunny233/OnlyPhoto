from __future__ import annotations

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field, field_validator

from ..config import settings
from ..errors import ApiError
from ..security import (
    create_session,
    delete_session,
    get_current_user,
    require_same_origin,
    set_session_cookie,
    clear_session_cookie,
    verify_password,
)
from ..services.users import create_user, get_by_email
from ..ratelimit import rate_limit

router = APIRouter()

EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class RegisterIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(min_length=8, max_length=200)
    nickname: str = Field(min_length=1, max_length=40)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        import re

        if not re.match(EMAIL_RE, value):
            raise ValueError("邮箱格式不正确")
        return value


class LoginIn(BaseModel):
    email: str = Field(max_length=200)
    password: str = Field(min_length=1, max_length=200)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.headers.get("x-real-ip") or (request.client.host if request.client else "unknown")


@router.post("/api/auth/register")
def register(payload: RegisterIn, request: Request, response: Response) -> dict:
    require_same_origin(request)
    if not settings.registration_open:
        raise ApiError(403, "registration_closed", "当前未开放注册")
    if not rate_limit(f"register:{_client_ip(request)}", 10, 10 * 60):
        raise ApiError(429, "rate_limited", "注册过于频繁，请稍后再试")

    email = payload.email.strip().lower()
    if get_by_email(email) is not None:
        raise ApiError(409, "email_taken", "该邮箱已注册")
    nickname = payload.nickname.strip()
    user_id = create_user(email, nickname, payload.password)
    token = create_session(user_id)
    set_session_cookie(response, token)
    return {"user": {"id": user_id, "email": email, "nickname": nickname}}


@router.post("/api/auth/login")
def login(payload: LoginIn, request: Request, response: Response) -> dict:
    require_same_origin(request)
    if not rate_limit(f"login:{_client_ip(request)}", 20, 10 * 60):
        raise ApiError(429, "rate_limited", "登录尝试过于频繁，请稍后再试")
    email = payload.email.strip().lower()
    user = get_by_email(email)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise ApiError(401, "invalid_credentials", "邮箱或密码不正确")
    token = create_session(user["id"])
    set_session_cookie(response, token)
    return {"user": {"id": user["id"], "email": user["email"], "nickname": user["nickname"]}}


@router.post("/api/auth/logout")
def logout(request: Request, response: Response) -> dict:
    require_same_origin(request)
    token = request.cookies.get("pm_session")
    if token:
        delete_session(token)
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/api/auth/session")
def session(request: Request) -> dict:
    return {"user": get_current_user(request)}