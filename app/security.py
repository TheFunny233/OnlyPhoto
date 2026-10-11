from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from typing import Any

from fastapi import Request
from starlette.responses import Response

from .config import settings
from .db import execute, query_one
from .errors import ApiError
from .utils import now_ms

SESSION_COOKIE = "pm_session"
SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

# Identical format to the reference implementation: scrypt$N$r$p$salt$key (standard base64),
# so password hashes are interchangeable between the two versions.
_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 64
_SCRYPT_MAXMEM = 64 * 1024 * 1024


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
        maxmem=_SCRYPT_MAXMEM,
    )
    return "scrypt${}${}${}${}${}".format(
        _SCRYPT_N,
        _SCRYPT_R,
        _SCRYPT_P,
        base64.b64encode(salt).decode("ascii"),
        base64.b64encode(derived).decode("ascii"),
    )


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) != 6 or parts[0] != "scrypt":
        return False
    try:
        n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
        salt = base64.b64decode(parts[4])
        expected = base64.b64decode(parts[5])
    except (ValueError, TypeError):
        return False
    try:
        derived = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=len(expected),
            maxmem=_SCRYPT_MAXMEM,
        )
    except ValueError:
        return False
    return hmac.compare_digest(derived, expected)


def use_secure_cookies() -> bool:
    if os.getenv("ALLOW_INSECURE_COOKIES") == "true":
        return False
    return settings.app_url.startswith("https://")


def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    now = now_ms()
    execute(
        "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now, now + SESSION_TTL_MS),
    )
    return token


def delete_session(token: str) -> None:
    execute("DELETE FROM sessions WHERE id = ?", (token,))


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=SESSION_TTL_MS // 1000,
        httponly=True,
        samesite="lax",
        secure=use_secure_cookies(),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def get_current_user(request: Request) -> dict[str, Any] | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    row = query_one("SELECT * FROM sessions WHERE id = ?", (token,))
    if row is None:
        return None
    if row["expires_at"] < now_ms():
        delete_session(token)
        return None
    user = query_one("SELECT id, email, nickname, is_demo FROM users WHERE id = ?", (row["user_id"],))
    if user is None:
        return None
    return {
        "id": user["id"],
        "email": user["email"],
        "nickname": user["nickname"],
        "is_demo": bool(user["is_demo"]),
    }


def require_user(request: Request) -> dict[str, Any]:
    user = get_current_user(request)
    if user is None:
        raise ApiError(401, "unauthenticated", "请先登录")
    return user


def require_same_origin(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    origin = request.headers.get("origin")
    if not origin:
        return
    from urllib.parse import urlparse

    allowed = urlparse(settings.app_url)
    given = urlparse(origin)
    if allowed.hostname == given.hostname and allowed.port == given.port:
        return
    host = request.headers.get("host", "")
    if given.netloc == host:
        return
    raise ApiError(403, "origin_not_allowed", "请求来源不被允许")


def require_maintenance(request: Request) -> None:
    if not settings.maintenance_token:
        raise ApiError(403, "maintenance_disabled", "未配置 MAINTENANCE_TOKEN，维护入口已禁用")
    if request.headers.get("x-maintenance-token") != settings.maintenance_token:
        raise ApiError(401, "unauthorized", "维护令牌不正确")