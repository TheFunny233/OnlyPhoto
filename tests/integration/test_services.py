from __future__ import annotations

import sqlite3

import pytest

from app.ai.analyze import run_analysis
from app.ai.budget import consume_budget, get_budget
from app.db import execute, query_all, query_one
from app.services.spots import (
    add_comment,
    create_spot,
    delete_spot,
    list_comments,
    toggle_favorite,
    toggle_like,
)
from app.services.users import create_user
from app.utils import new_id, now_ms


def make_user(nickname: str = "测试用户") -> str:
    return create_user(f"user-{new_id()}@example.com", nickname, "password123")


def spot_payload(title: str = "测试机位") -> dict:
    return {
        "title": title,
        "city": "测试市",
        "lat": 31.2,
        "lng": 121.4,
        "precision": "approximate",
        "subjects": ["风景"],
    }


def make_photo(user_id: str) -> tuple[str, str]:
    photo_id = new_id()
    content_hash = f"hash-{new_id()}"
    execute(
        """
        INSERT INTO photos (id, owner_id, storage_key, original_name, mime_type, width, height, bytes,
                            content_hash, privacy, is_demo, created_at)
        VALUES (?, ?, 'x/y.jpg', 'a.jpg', 'image/jpeg', 100, 100, 1000, ?, 'private', 0, ?)
        """,
        (photo_id, user_id, content_hash, now_ms()),
    )
    return photo_id, content_hash


def test_like_toggles_and_stays_unique():
    user = make_user()
    spot = create_spot(user, spot_payload("点赞机位"))
    assert toggle_like(spot["id"], user) == {"liked": True, "count": 1}
    execute("INSERT OR IGNORE INTO likes (user_id, spot_id, created_at) VALUES (?, ?, ?)", (user, spot["id"], now_ms()))
    assert toggle_like(spot["id"], user)["liked"] is False
    assert toggle_like(spot["id"], user) == {"liked": True, "count": 1}


def test_favorite_toggles():
    user = make_user()
    spot = create_spot(user, spot_payload("收藏机位"))
    assert toggle_favorite(spot["id"], user)["favorited"] is True
    assert toggle_favorite(spot["id"], user)["favorited"] is False


def test_deleting_spot_cascades():
    user = make_user()
    spot = create_spot(user, spot_payload("级联机位"))
    toggle_like(spot["id"], user)
    add_comment(spot["id"], user, "一条评论")
    delete_spot(spot["id"], user)
    assert query_all("SELECT 1 FROM likes WHERE spot_id = ?", (spot["id"],)) == []
    assert query_all("SELECT 1 FROM comments WHERE spot_id = ?", (spot["id"],)) == []


def test_analysis_is_idempotent_for_mock():
    user = make_user("分析用户")
    photo_id, content_hash = make_photo(user)
    params = dict(
        user_id=user,
        photo_id=photo_id,
        content_hash=content_hash,
        image_base64="AAAA",
        mime_type="image/jpeg",
        scene="landscape",
        goals=["improve_color"],
    )
    first = run_analysis(**params)
    assert first["status"] == "succeeded"
    assert first["analysis"]["schemaVersion"] == "1"

    second = run_analysis(**params)
    assert second["status"] == "succeeded" and second["reused"] is True
    assert len(query_all("SELECT 1 FROM analysis_results WHERE photo_id = ?", (photo_id,))) == 1


def test_forced_reanalysis_keeps_score_history():
    from app.services.photos import get_analysis_history

    user = make_user("历史用户")
    photo_id, content_hash = make_photo(user)
    params = dict(
        user_id=user,
        photo_id=photo_id,
        content_hash=content_hash,
        image_base64="AAAA",
        mime_type="image/jpeg",
        scene="auto",
        goals=[],
    )

    first = run_analysis(**params)
    assert first["status"] == "succeeded"
    assert len(get_analysis_history(photo_id, user)) == 1

    # Non-forced repeat reuses the same job (no new history entry).
    reused = run_analysis(**params)
    assert reused["reused"] is True
    assert len(get_analysis_history(photo_id, user)) == 1

    # Forced re-analysis creates a new record so the change is visible over time.
    forced = run_analysis(**params, force=True)
    assert forced["status"] == "succeeded"
    history = get_analysis_history(photo_id, user)
    assert len(history) == 2
    assert all(item["status"] == "succeeded" for item in history)
    # Mock mode never fabricates a score.
    assert all(item["overall"] is None for item in history)


def test_analysis_history_requires_ownership():
    from app.errors import ApiError
    from app.services.photos import get_analysis_history

    owner = make_user("历史作者")
    other = make_user("历史他人")
    photo_id, _ = make_photo(owner)
    with pytest.raises(ApiError):
        get_analysis_history(photo_id, other)


def test_live_is_not_silently_mocked(monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings.ai, "base_url", "", raising=False)
    monkeypatch.setattr(config.settings.ai, "api_key", "", raising=False)
    monkeypatch.setattr(config.settings.ai, "vision_model", "", raising=False)
    monkeypatch.setattr(config.settings.ai, "mode", "live", raising=False)

    user = make_user("真实用户")
    photo_id, content_hash = make_photo(user)
    result = run_analysis(
        user_id=user,
        photo_id=photo_id,
        content_hash=content_hash,
        image_base64="AAAA",
        mime_type="image/jpeg",
        scene="auto",
        goals=[],
        force=True,
    )
    assert result["status"] == "failed"
    assert result["error"]["type"] == "config"


def test_comment_ordering_and_visibility():
    user = make_user("评论用户")
    spot = create_spot(user, spot_payload("评论机位"))
    add_comment(spot["id"], user, "第一条")
    add_comment(spot["id"], user, "第二条")
    comments = list_comments(spot["id"])
    assert [c["body"] for c in comments] == ["第二条", "第一条"]

    execute("UPDATE comments SET status = 'hidden' WHERE spot_id = ?", (spot["id"],))
    assert list_comments(spot["id"]) == []


def test_budget_ledger_persists_across_connections():
    from app.ai.budget import RUN_TASK_ID

    get_budget()  # ensure the row exists, then make the test independent of run order
    execute('UPDATE live_budget SET used = 0, "limit" = 12 WHERE id = ?', (RUN_TASK_ID,))
    before = get_budget()["used"]
    consume_budget(1)
    after = get_budget()["used"]
    assert after == before + 1

    from app.db import database_path

    raw = sqlite3.connect(database_path())
    row = raw.execute('SELECT used FROM live_budget WHERE id = ?', ("photomaster-dev-run",)).fetchone()
    raw.close()
    assert row is not None and row[0] == after


def test_spot_persists_on_disk():
    user = make_user("持久化用户")
    spot = create_spot(user, spot_payload("持久化机位"))
    from app.db import database_path

    raw = sqlite3.connect(database_path())
    row = raw.execute("SELECT title FROM spots WHERE id = ?", (spot["id"],)).fetchone()
    raw.close()
    assert row is not None and row[0] == "持久化机位"


def test_spot_not_found_raises():
    with pytest.raises(Exception):
        toggle_like("missing-spot", "nobody")