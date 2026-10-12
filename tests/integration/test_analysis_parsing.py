"""End-to-end parsing checks with a fake provider.

Regression for the reported bug: a Chinese-keyed provider response used to be silently
dropped, so every section (优点/可改进处/重拍建议/修图建议) showed as empty even though the
model had produced content. These tests run the real orchestration + validation path with a
fake provider, so no live quota is consumed.
"""

from __future__ import annotations

import json

import pytest

from app import config
from app.ai import analyze as analyze_mod
from app.db import execute, query_one
from app.services.photos import get_analysis_history
from app.services.users import create_user
from app.utils import new_id, now_ms

CHINESE_RESPONSE = {
    "总览": "街景随拍，元素较多但缺少视觉重心。",
    "优点": [{"类别": "构图", "标题": "线条引导", "现象": "道路标线形成纵深", "建议": "保持", "优先级": "高"}],
    "可改进处": [{"类型": "背景", "标题": "路牌抢眼", "现象": "右侧路牌比主体更亮", "建议": "裁去右侧少量区域"}],
    "重拍建议": [{"text": "向左移动让路牌避开主体"}],
    "修图建议": ["降低整体饱和度"],
    "先做这一件事": "先裁掉右侧路牌",
    "不确定": ["无法确定拍摄时间"],
    "评分": {"dims": [{"维度": "构图", "分值": 70}, {"维度": "色彩", "分值": 50}]},
}


def make_user(nickname: str) -> str:
    return create_user(f"parse-{new_id()}@example.com", nickname, "password123")


def make_photo(user_id: str) -> tuple[str, str]:
    photo_id = new_id()
    content_hash = f"hash-{new_id()}"
    execute(
        """
        INSERT INTO photos (id, owner_id, storage_key, original_name, mime_type, width, height, bytes,
                            content_hash, privacy, is_demo, created_at)
        VALUES (?, ?, 'x/y.jpg', 'a.jpg', 'image/jpeg', 10, 10, 10, ?, 'private', 0, ?)
        """,
        (photo_id, user_id, content_hash, now_ms()),
    )
    return photo_id, content_hash


@pytest.fixture()
def live_mode(monkeypatch):
    """Pretend live mode is configured, and make the (already exhausted) run budget a no-op."""
    monkeypatch.setattr(config.settings.ai, "mode", "live")
    monkeypatch.setattr(config.settings.ai, "base_url", "https://example.com/v1")
    monkeypatch.setattr(config.settings.ai, "api_key", "fake-key")
    monkeypatch.setattr(config.settings.ai, "vision_model", "fake-model")
    monkeypatch.setattr(analyze_mod, "consume_budget", lambda count=1: {"used": 0, "limit": 12, "remaining": 12})
    yield


def test_chinese_keyed_provider_output_is_kept_end_to_end(monkeypatch, live_mode):
    def fake_provider(image_base64, mime_type, scene, goals):
        return {
            "raw": CHINESE_RESPONSE,
            "raw_text": json.dumps(CHINESE_RESPONSE, ensure_ascii=False),
            "provider_request_id": "fake-req-1",
            "input_tokens": 123,
            "output_tokens": 456,
            "model": "fake-model",
        }

    monkeypatch.setattr(analyze_mod, "analyze_with_provider", fake_provider)

    user = make_user("中文键用户")
    photo_id, content_hash = make_photo(user)
    result = analyze_mod.run_analysis(
        user_id=user,
        photo_id=photo_id,
        content_hash=content_hash,
        image_base64="AAAA",
        mime_type="image/jpeg",
        scene="landscape",
        goals=[],
    )

    assert result["status"] == "succeeded", result.get("error")
    analysis = result["analysis"]
    assert len(analysis["strengths"]) == 1
    assert analysis["strengths"][0]["category"] == "composition"
    assert analysis["strengths"][0]["priority"] == "high"
    assert len(analysis["improvements"]) == 1
    assert analysis["improvements"][0]["category"] == "background"
    assert analysis["reshootSuggestions"] == ["向左移动让路牌避开主体"]
    assert analysis["editingSuggestions"] == ["降低整体饱和度"]
    assert analysis["firstAction"] == "先裁掉右侧路牌"
    assert analysis["uncertainties"] == ["无法确定拍摄时间"]
    assert analysis["score"]["overall"] == 62
    assert result["receipt"]["providerRequestId"] == "fake-req-1"

    # The raw provider output is retained for later diagnosis.
    excerpt = query_one("SELECT raw_excerpt FROM analysis_jobs WHERE photo_id = ?", (photo_id,))
    assert excerpt and excerpt["raw_excerpt"] and "线条引导" in excerpt["raw_excerpt"]

    # Response is persisted, so a page reload shows the same content.
    history = get_analysis_history(photo_id, user)
    assert history[0]["overall"] == 62


def test_unusable_provider_output_fails_clearly(monkeypatch, live_mode):
    def empty_provider(image_base64, mime_type, scene, goals):
        return {
            "raw": {"summary": ""},
            "raw_text": '{"summary": ""}',
            "provider_request_id": "fake-req-2",
            "input_tokens": 1,
            "output_tokens": 1,
            "model": "fake-model",
        }

    monkeypatch.setattr(analyze_mod, "analyze_with_provider", empty_provider)

    user = make_user("空输出用户")
    photo_id, content_hash = make_photo(user)
    result = analyze_mod.run_analysis(
        user_id=user,
        photo_id=photo_id,
        content_hash=content_hash,
        image_base64="AAAA",
        mime_type="image/jpeg",
        scene="auto",
        goals=[],
    )
    # Must fail loudly (not silently return an empty-but-"successful" report).
    assert result["status"] == "failed"
    assert result["error"]["type"] == "schema"