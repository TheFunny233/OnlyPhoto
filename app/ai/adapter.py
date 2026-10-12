from __future__ import annotations

import time
from typing import Any
from urllib.parse import urlparse

import httpx

from ..config import settings
from .prompts import SYSTEM_PROMPT, build_repair_prompt, build_user_prompt
from .schemas import extract_json_object


class ProviderError(Exception):
    def __init__(self, kind: str, message: str, *, status: int | None = None, retryable: bool = False) -> None:
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.status = status
        self.retryable = retryable


def validate_base_url(raw: str) -> str:
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        raise ProviderError("config", "AI_BASE_URL 不是合法 URL")
    is_local = parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme != "https" and not is_local:
        raise ProviderError("config", "AI_BASE_URL 必须使用 https（本地开发除外）")
    return raw.rstrip("/")


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and isinstance(part.get("text"), str):
                parts.append(part["text"])
        return "".join(parts)
    return ""


def _call_once(
    client: httpx.Client,
    endpoint: str,
    image_base64: str,
    mime_type: str,
    prompt_text: str,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": settings.ai.vision_model,
        "max_tokens": settings.ai.max_output_tokens,
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}},
                ],
            },
        ],
    }
    if settings.ai.disable_thinking:
        payload["enable_thinking"] = False

    try:
        response = client.post(
            endpoint,
            json=payload,
            headers={"authorization": f"Bearer {settings.ai.api_key}", "content-type": "application/json"},
        )
    except httpx.TimeoutException:
        raise ProviderError("timeout", f"请求超时（{settings.ai.request_timeout_ms}ms）", retryable=True)
    except httpx.RequestError as exc:
        raise ProviderError("network", f"网络请求失败：{exc}", retryable=True)

    request_id = response.headers.get("x-request-id") or response.headers.get("x-dashscope-request-id")
    text = response.text

    if response.status_code >= 400:
        lower = text.lower()
        if response.status_code in (401, 403):
            raise ProviderError("auth", f"鉴权失败（HTTP {response.status_code}）", status=response.status_code)
        if response.status_code == 429:
            retry_after = response.headers.get("retry-after")
            suffix = f"，建议等待 {retry_after}s" if retry_after else ""
            raise ProviderError("rate_limit", f"触发限流（HTTP 429）{suffix}", status=429, retryable=True)
        if response.status_code >= 500:
            raise ProviderError("server", f"供应商服务错误（HTTP {response.status_code}）", status=response.status_code, retryable=True)
        if "image" in lower and any(word in lower for word in ("support", "not supported", "invalid")):
            raise ProviderError("unsupported_image", "该模型可能不支持图像输入", status=response.status_code)
        raise ProviderError("invalid_response", f"供应商返回错误（HTTP {response.status_code}）：{text[:300]}", status=response.status_code)

    try:
        body = response.json()
    except ValueError:
        raise ProviderError("invalid_response", "供应商返回的响应不是 JSON")

    choices = body.get("choices") or []
    message = (choices[0] or {}).get("message") if choices else None
    content_text = _content_text((message or {}).get("content"))
    if not content_text.strip():
        raise ProviderError("invalid_response", "供应商返回了空内容")

    try:
        raw = extract_json_object(content_text)
    except ValueError as exc:
        raise ProviderError("invalid_response", str(exc))

    usage = body.get("usage") or {}
    return {
        "raw": raw,
        # Kept (truncated) so parsing problems can be diagnosed later without another call.
        "raw_text": content_text[:4000],
        "provider_request_id": request_id or body.get("id"),
        "input_tokens": usage.get("prompt_tokens"),
        "output_tokens": usage.get("completion_tokens"),
        "model": settings.ai.vision_model,
    }


def analyze_with_provider(image_base64: str, mime_type: str, scene: str, goals: list[str]) -> dict[str, Any]:
    ai = settings.ai
    if not ai.base_url:
        raise ProviderError("config", "未配置 AI_BASE_URL")
    if not ai.api_key:
        raise ProviderError("config", "未配置 AI_API_KEY")
    if not ai.vision_model:
        raise ProviderError("config", "未配置 AI_VISION_MODEL")

    endpoint = validate_base_url(ai.base_url) + "/chat/completions"
    user_prompt = build_user_prompt(scene, goals)
    timeout = httpx.Timeout(ai.request_timeout_ms / 1000)

    with httpx.Client(timeout=timeout) as client:
        last_error: Exception | None = None
        attempts = ai.max_retries + 1
        for attempt in range(attempts):
            try:
                return _call_once(client, endpoint, image_base64, mime_type, user_prompt)
            except ProviderError as exc:
                last_error = exc
                if not exc.retryable:
                    break
                if attempt < attempts - 1:
                    time.sleep(0.5 * (attempt + 1))

        if isinstance(last_error, ProviderError) and last_error.kind == "invalid_response":
            # one bounded repair attempt for malformed JSON
            try:
                return _call_once(client, endpoint, image_base64, mime_type, build_repair_prompt())
            except ProviderError as exc:
                raise exc
        assert last_error is not None
        raise last_error