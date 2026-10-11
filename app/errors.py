from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """Application error rendered as {"error": {"code", "message"}} (same shape as the reference)."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def api_error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return api_error_response(exc.status, exc.code, exc.message)


async def unhandled_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    import traceback

    traceback.print_exc()
    return api_error_response(500, "internal_error", "服务器内部错误")


async def validation_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    issues = getattr(exc, "errors", lambda: [])()
    first = issues[0] if issues else {}
    message = first.get("msg") or "输入不合法"
    return api_error_response(400, "invalid_input", str(message))