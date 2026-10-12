from __future__ import annotations

import hashlib
from typing import Any

from ..config import AI_PROMPT_VERSION, is_ai_live_configured, settings
from ..db import execute, query_all, query_one
from ..utils import dumps, iso_from_ms, loads, new_id, now_ms
from .adapter import ProviderError, analyze_with_provider

from .mock import mock_analysis
from .schemas import parse_analysis

STALE_MS = settings.ai.request_timeout_ms * 2 + 30_000
_DAY_MS = 24 * 60 * 60 * 1000


def reap_stale_jobs() -> None:
    cutoff = now_ms() - STALE_MS
    execute(
        """
        UPDATE analysis_jobs
           SET status = 'failed', error_type = 'stale', error = ?, finished_at = ?
         WHERE status = 'processing' AND (started_at IS NULL OR started_at < ?)
        """,
        ("任务在服务重启或超时后中断，可重试", now_ms(), cutoff),
    )


def _compute_key(content_hash: str, scene: str, goals: list[str], mode: str, provider: str, model: str) -> str:
    parts = [content_hash, scene, ",".join(sorted(goals)), mode, provider, model, AI_PROMPT_VERSION]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def _load_result(job_id: str) -> dict[str, Any] | None:
    row = query_one("SELECT data, receipt FROM analysis_results WHERE job_id = ?", (job_id,))
    if row is None:
        return None
    return {"analysis": loads(row["data"]), "receipt": loads(row["receipt"])}


def _live_usage_last_24h(user_id: str) -> int:
    row = query_one(
        "SELECT COUNT(*) AS c FROM api_usage WHERE user_id = ? AND mode = 'live' AND created_at >= ?",
        (user_id, now_ms() - _DAY_MS),
    )
    return int(row["c"]) if row else 0


def _record_usage(**entry: Any) -> None:
    execute(
        """
        INSERT INTO api_usage
            (id, user_id, photo_id, mode, provider, model, status, error_type, input_tokens, output_tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id(),
            entry.get("user_id"),
            entry.get("photo_id"),
            entry.get("mode"),
            entry.get("provider", ""),
            entry.get("model"),
            entry.get("status"),
            entry.get("error_type"),
            entry.get("input_tokens"),
            entry.get("output_tokens"),
            now_ms(),
        ),
    )


def run_analysis(
    *,
    user_id: str,
    photo_id: str,
    content_hash: str,
    image_base64: str,
    mime_type: str,
    scene: str,
    goals: list[str],
    force: bool = False,
) -> dict[str, Any]:
    reap_stale_jobs()

    mode = settings.ai.mode
    if mode == "live" and not is_ai_live_configured():
        return {
            "jobId": "",
            "status": "failed",
            "reused": False,
            "error": {
                "type": "config",
                "message": "live 模式未正确配置 AI_BASE_URL / AI_API_KEY / AI_VISION_MODEL，请检查服务端配置。",
            },
        }

    provider = "mock"
    if mode == "live":
        from urllib.parse import urlparse

        try:
            provider = urlparse(settings.ai.base_url).netloc or "mock"
        except ValueError:
            provider = "mock"
    model = settings.ai.vision_model if mode == "live" else "mock"

    idempotency_key = _compute_key(content_hash, scene, goals, mode, provider, model)
    existing = query_one("SELECT * FROM analysis_jobs WHERE idempotency_key = ?", (idempotency_key,))

    if existing and not force:
        if existing["status"] == "succeeded":
            loaded = _load_result(existing["id"])
            if loaded:
                if existing["photo_id"] == photo_id:
                    return {"jobId": existing["id"], "status": "succeeded", "reused": True, **loaded}
                # A different upload with identical content was analysed before: clone the
                # job/result so the current photo has its own analysis record.
                clone_id = new_id()
                clone_now = now_ms()
                execute(
                    """
                    INSERT INTO analysis_jobs
                        (id, photo_id, owner_id, status, idempotency_key, mode, provider, model,
                         prompt_version, scene, goals, attempts, created_at, started_at, finished_at)
                    VALUES (?, ?, ?, 'succeeded', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                    """,
                    (
                        clone_id,
                        photo_id,
                        user_id,
                        f"{idempotency_key}#{photo_id}",
                        existing["mode"],
                        existing["provider"],
                        existing["model"],
                        existing["prompt_version"],
                        existing["scene"],
                        existing["goals"],
                        clone_now,
                        clone_now,
                        clone_now,
                    ),
                )
                execute(
                    """
                    INSERT INTO analysis_results (id, job_id, photo_id, owner_id, data, receipt, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id(),
                        clone_id,
                        photo_id,
                        user_id,
                        dumps(loaded["analysis"]),
                        dumps(loaded["receipt"]),
                        clone_now,
                    ),
                )
                return {"jobId": clone_id, "status": "succeeded", "reused": True, **loaded}
        if existing["status"] == "processing" and existing["started_at"] and now_ms() - existing["started_at"] < STALE_MS:
            return {"jobId": existing["id"], "status": "processing", "reused": True}

    now = now_ms()
    if existing and not force:
        # Retry of a failed job: reuse the record so retries do not spam history.
        job_id = existing["id"]
        execute(
            """
            UPDATE analysis_jobs
               SET status = 'processing', error = NULL, error_type = NULL, attempts = attempts + 1,
                   started_at = ?, finished_at = NULL, mode = ?, provider = ?, model = ?
             WHERE id = ?
            """,
            (now, mode, provider, model, job_id),
        )
    else:
        # First run, or a forced re-analysis: always create a new job so the score
        # history is preserved (users want to see whether a change improved things).
        job_id = new_id()
        job_key = idempotency_key if existing is None else f"{idempotency_key}#{job_id}"
        execute(
            """
            INSERT INTO analysis_jobs
                (id, photo_id, owner_id, status, idempotency_key, mode, provider, model,
                 prompt_version, scene, goals, attempts, created_at, started_at)
            VALUES (?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                job_id,
                photo_id,
                user_id,
                job_key,
                mode,
                provider,
                model,
                AI_PROMPT_VERSION,
                scene,
                dumps(goals),
                now,
                now,
            ),
        )

    if mode == "live" and _live_usage_last_24h(user_id) >= settings.ai.user_daily_request_limit:
        # Only a per-user daily safety limit applies to real product usage.
        # The development-run ledger (LIVE_TEST_MAX_REQUESTS) is deliberately NOT applied
        # here -- it constrains the agent's own live test calls, not end users analysing
        # their photos. (See .agent/DECISIONS.md.) Budget is tracked by scripts/test_live.py.
        message = f"今日真实分析次数已达上限（{settings.ai.user_daily_request_limit} 次），请稍后再试或调整 AI_USER_DAILY_REQUEST_LIMIT"
        execute(
            "UPDATE analysis_jobs SET status='failed', error_type='rate_limit', error=?, finished_at=? WHERE id=?",
            (message, now_ms(), job_id),
        )
        return {"jobId": job_id, "status": "failed", "reused": False, "error": {"type": "rate_limit", "message": message}}

    try:
        if mode == "live":
            provider_result = analyze_with_provider(image_base64, mime_type, scene, goals)
        else:
            provider_result = mock_analysis(scene, goals, content_hash)

        # Store a truncated copy of what the provider returned so a parsing problem can be
        # diagnosed later without spending another request.
        excerpt = provider_result.get("raw_text") or dumps(provider_result.get("raw"))
        execute(
            "UPDATE analysis_jobs SET raw_excerpt = ? WHERE id = ?",
            ((excerpt or "")[:4000], job_id),
        )

        parsed = parse_analysis(provider_result["raw"])
        if not parsed["ok"]:
            message = f"模型输出未通过校验：{'; '.join(parsed['errors'][:3])}"
            _record_usage(
                user_id=user_id, photo_id=photo_id, mode=mode, provider=provider, model=model,
                status="error", error_type="schema",
                input_tokens=provider_result.get("input_tokens"), output_tokens=provider_result.get("output_tokens"),
            )
            execute(
                "UPDATE analysis_jobs SET status='failed', error_type='schema', error=?, finished_at=? WHERE id=?",
                (message, now_ms(), job_id),
            )
            return {"jobId": job_id, "status": "failed", "reused": False, "error": {"type": "schema", "message": message}}

        receipt = {
            "mode": mode,
            "provider": provider,
            "model": settings.ai.vision_model if mode == "live" else "mock",
            "promptVersion": AI_PROMPT_VERSION,
            "providerRequestId": provider_result.get("provider_request_id"),
            "inputTokens": provider_result.get("input_tokens"),
            "outputTokens": provider_result.get("output_tokens"),
            "imageHash": content_hash,
            "generatedAt": iso_from_ms(now_ms()),
        }

        execute(
            """
            INSERT INTO analysis_results (id, job_id, photo_id, owner_id, data, receipt, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (new_id(), job_id, photo_id, user_id, dumps(parsed["value"]), dumps(receipt), now_ms()),
        )
        execute(
            "UPDATE analysis_jobs SET status='succeeded', finished_at=?, error=NULL, error_type=NULL WHERE id=?",
            (now_ms(), job_id),
        )
        _record_usage(
            user_id=user_id, photo_id=photo_id, mode=mode, provider=provider, model=model, status="success",
            input_tokens=provider_result.get("input_tokens"), output_tokens=provider_result.get("output_tokens"),
        )
        return {"jobId": job_id, "status": "succeeded", "reused": False, "analysis": parsed["value"], "receipt": receipt}
    except ProviderError as exc:
        _record_usage(
            user_id=user_id, photo_id=photo_id, mode=mode, provider=provider, model=model,
            status="error", error_type=exc.kind,
        )
        execute(
            "UPDATE analysis_jobs SET status='failed', error_type=?, error=?, finished_at=? WHERE id=?",
            (exc.kind, exc.message, now_ms(), job_id),
        )
        return {"jobId": job_id, "status": "failed", "reused": False, "error": {"type": exc.kind, "message": exc.message}}


def get_latest_succeeded_analysis(photo_id: str) -> dict[str, Any] | None:
    job = query_one(
        "SELECT id FROM analysis_jobs WHERE photo_id = ? AND status = 'succeeded' ORDER BY finished_at DESC LIMIT 1",
        (photo_id,),
    )
    if job is None:
        return None
    loaded = _load_result(job["id"])
    if loaded is None:
        return None
    return {"jobId": job["id"], **loaded}


def list_jobs_for_photo(photo_id: str) -> list[dict[str, Any]]:
    rows = query_all(
        "SELECT id, status, error, error_type, created_at, started_at, finished_at FROM analysis_jobs WHERE photo_id = ? ORDER BY created_at DESC",
        (photo_id,),
    )
    return [dict(row) for row in rows]