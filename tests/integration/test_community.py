from __future__ import annotations

import pytest

from app.errors import ApiError
from app.services.recommend import recommend_spots
from app.db import execute
from app.services.spots import (
    add_comment,
    add_spot_media,
    delete_spot_media,
    create_spot,
    list_comments,
    list_spots,
    record_view,
    toggle_comment_like,
    toggle_favorite,
    toggle_follow,
    toggle_like,
    user_profile,
)
from app.services.users import create_user
from app.utils import new_id


def make_user(nickname: str = "社区用户") -> str:
    return create_user(f"community-{new_id()}@example.com", nickname, "password123")


def make_spot(user_id: str, title: str, *, city: str = "测试市", lat: float = 31.2, lng: float = 121.4, subjects=None):
    return create_spot(
        user_id,
        {
            "title": title,
            "city": city,
            "lat": lat,
            "lng": lng,
            "precision": "approximate",
            "subjects": subjects or ["风景"],
        },
    )


def test_comment_reply_nesting_and_ordering():
    author = make_user("作者")
    replier = make_user("回复者")
    spot = make_spot(author, "评论树机位")
    parent = add_comment(spot["id"], author, "第一层评论")
    add_comment(spot["id"], replier, "回复内容", parent_id=parent["id"])

    comments = list_comments(spot["id"])
    assert len(comments) == 1
    assert comments[0]["body"] == "第一层评论"
    assert len(comments[0]["replies"]) == 1
    assert comments[0]["replies"][0]["body"] == "回复内容"
    assert comments[0]["replies"][0]["parentId"] == parent["id"]


def test_reply_must_belong_to_same_spot():
    user = make_user()
    spot_a = make_spot(user, "机位A")
    spot_b = make_spot(user, "机位B")
    parent = add_comment(spot_a["id"], user, "A 的评论")
    with pytest.raises(ApiError):
        add_comment(spot_b["id"], user, "错位回复", parent_id=parent["id"])


def test_comment_like_toggle_and_count():
    user = make_user()
    liker = make_user("点赞者")
    spot = make_spot(user, "评论点赞机位")
    comment = add_comment(spot["id"], user, "被点赞的评论")

    first = toggle_comment_like(comment["id"], liker)
    assert first == {"liked": True, "count": 1}
    assert toggle_comment_like(comment["id"], liker) == {"liked": False, "count": 0}

    # duplicate insert must not double count
    toggle_comment_like(comment["id"], liker)
    toggle_comment_like(comment["id"], liker)
    listed = list_comments(spot["id"], liker)
    assert listed[0]["likeCount"] == 0
    assert listed[0]["likedByViewer"] is False


def test_follow_toggle_and_profile_counts():
    author = make_user("被关注者")
    follower = make_user("关注者")
    spot = make_spot(author, "关注机位")
    toggle_like(spot["id"], follower)

    assert toggle_follow(author, follower) == {"following": True, "followers": 1}
    profile = user_profile(author, follower)
    assert profile["followers"] == 1
    assert profile["followedByViewer"] is True
    assert profile["spotCount"] == 1
    assert profile["likeCount"] == 1

    assert toggle_follow(author, follower) == {"following": False, "followers": 0}

    with pytest.raises(ApiError):
        toggle_follow(follower, follower)


def test_view_counter_is_deduplicated():
    user = make_user()
    spot = make_spot(user, "浏览量机位")
    assert record_view(spot["id"], "viewer-1") == 1
    assert record_view(spot["id"], "viewer-1") == 1  # same viewer, not double counted
    assert record_view(spot["id"], "viewer-2") == 2


def test_hot_sort_orders_by_interactions():
    user = make_user()
    quiet = make_spot(user, "冷门机位")
    hot = make_spot(user, "热门机位")
    for _ in range(3):
        toggle_like(hot["id"], make_user())

    result = list_spots(sort="hot", limit=50)
    titles = [spot["title"] for spot in result["spots"]]
    assert titles.index("热门机位") < titles.index("冷门机位")
    assert result["spots"][0]["hotScore"] > 0


def test_search_by_author_and_keyword():
    user = make_user("搜索作者")
    make_spot(user, "海边栈道", city="搜索市")
    by_author = list_spots(author="搜索作者", limit=10)
    assert by_author["total"] >= 1
    by_keyword = list_spots(q="海边栈道", limit=10)
    assert any(spot["title"] == "海边栈道" for spot in by_keyword["spots"])


def test_near_sorting_and_distance():
    user = make_user()
    # Use coordinates away from the shared fixture points so the assertion is unambiguous.
    make_spot(user, "独特的近距离机位", lat=10.0, lng=100.0)
    make_spot(user, "独特的远距离机位", lat=40.0, lng=100.0)

    result = list_spots(near=(10.0, 100.0), limit=100)
    by_title = {spot["title"]: spot["distanceKm"] for spot in result["spots"]}
    assert by_title["独特的近距离机位"] == 0.0
    assert by_title["独特的远距离机位"] > 1000
    # Distance sorting puts the nearest first.
    assert result["spots"][0]["distanceKm"] <= result["spots"][-1]["distanceKm"]


def test_recommendations_are_never_empty_and_skip_viewed():
    author = make_user("推荐作者")
    viewer = make_user("推荐访客")
    seen = make_spot(author, "看过的机位")
    make_spot(author, "未看的机位")

    toggle_like(seen["id"], viewer)
    picked = recommend_spots(viewer, limit=5)
    assert picked, "推荐不应为空（含兜底）"
    if len(picked) > 1:
        assert picked[0]["id"] != seen["id"], "优先推荐未看过的机位"

    # cold start (anonymous) still returns something
    assert recommend_spots(None, limit=3)


def make_real_photo(user_id: str) -> str:
    """Create a real image file on disk plus its photos row (needed by public derivatives)."""
    import io

    from PIL import Image

    from app.imaging import ingest_image
    from app.utils import now_ms

    buffer = io.BytesIO()
    Image.new("RGB", (120, 90), (120, 140, 160)).save(buffer, format="JPEG")
    photo_id = new_id()
    ingested = ingest_image(user_id, photo_id, "album.jpg", buffer.getvalue())
    execute(
        """
        INSERT INTO photos (id, owner_id, storage_key, original_name, mime_type, width, height, bytes,
                            content_hash, privacy, is_demo, created_at)
        VALUES (?, ?, ?, 'album.jpg', ?, ?, ?, ?, ?, 'private', 0, ?)
        """,
        (
            photo_id,
            user_id,
            ingested["storage_key"],
            ingested["mime_type"],
            ingested["width"],
            ingested["height"],
            ingested["bytes"],
            ingested["content_hash"],
            now_ms(),
        ),
    )
    return photo_id


def test_spot_media_add_and_delete_permissions():
    owner = make_user("相册作者")
    other = make_user("相册他人")
    spot = make_spot(owner, "相册机位")
    assert spot["media"] == []

    photo_id = make_real_photo(owner)
    updated = add_spot_media(spot["id"], owner, photo_id)
    assert len(updated["media"]) == 1

    with pytest.raises(ApiError):
        add_spot_media(spot["id"], other, photo_id)

    media_id = updated["media"][0]["id"]
    with pytest.raises(ApiError):
        delete_spot_media(spot["id"], media_id, other)

    after = delete_spot_media(spot["id"], media_id, owner)
    assert after["media"] == []


def test_sensitive_words_are_blocked(monkeypatch):
    from app import config

    monkeypatch.setattr(config.settings, "sensitive_words", ("测试违禁词",))
    user = make_user("治理用户")
    spot = make_spot(user, "治理机位")

    with pytest.raises(ApiError):
        add_comment(spot["id"], user, "这里包含测试违禁词")
    with pytest.raises(ApiError):
        make_spot(user, "含测试违禁词的标题")

    # Clean content still works.
    add_comment(spot["id"], user, "这是正常评论")
    assert len(list_comments(spot["id"])) == 1


def test_topics_aggregate_by_subject():
    from app.services.spots import list_topics

    user = make_user()
    make_spot(user, "话题风景机位", subjects=["风景"])
    make_spot(user, "话题建筑机位", subjects=["建筑"])

    topics = {t["subject"]: t for t in list_topics()}
    assert "风景" in topics and topics["风景"]["count"] >= 1
    assert "建筑" in topics and topics["建筑"]["count"] >= 1
    assert set(topics["风景"]).issuperset({"subject", "count", "hot", "cityCount"})


def test_comment_sort_hot_puts_liked_first():
    author = make_user("排序作者")
    spot = make_spot(author, "评论排序机位")
    plain = add_comment(spot["id"], author, "普通评论")
    liked = add_comment(spot["id"], author, "被点赞的评论")
    liker = make_user("排序点赞者")
    toggle_comment_like(liked["id"], liker)

    hot_first = list_comments(spot["id"], sort="hot")
    assert hot_first[0]["body"] == "被点赞的评论"

    newest_first = list_comments(spot["id"], sort="new")
    assert newest_first[0]["body"] == "被点赞的评论"  # also the newest one here
    assert any(item["id"] == plain["id"] for item in newest_first)


def test_edit_own_comment_only():
    from app.services.spots import update_comment

    author = make_user("编辑作者")
    other = make_user("编辑他人")
    spot = make_spot(author, "编辑评论机位")
    comment = add_comment(spot["id"], author, "原始内容")

    updated = update_comment(comment["id"], author, "修改后的内容")
    assert updated["body"] == "修改后的内容"
    assert list_comments(spot["id"])[0]["body"] == "修改后的内容"

    with pytest.raises(ApiError):
        update_comment(comment["id"], other, "越权修改")


def test_near_hot_prefers_close_and_popular():
    user = make_user()
    make_spot(user, "近处冷门", lat=20.0, lng=110.0)
    hot_near = make_spot(user, "近处热门", lat=20.01, lng=110.01)
    hot_far = make_spot(user, "远处热门", lat=20.5, lng=110.5)
    for _ in range(3):
        toggle_like(hot_near["id"], make_user())
    for _ in range(4):
        toggle_like(hot_far["id"], make_user())

    result = list_spots(near=(20.0, 110.0), sort="near_hot", limit=3)
    assert result["spots"][0]["title"] == "近处热门", [s["title"] for s in result["spots"]]


def test_notifications_cover_all_interaction_types():
    from app.services.notifications import list_notifications, mark_all_read, unread_count

    author = make_user("通知作者")
    actor = make_user("通知触发者")
    spot = make_spot(author, "通知机位")

    toggle_like(spot["id"], actor)
    toggle_favorite(spot["id"], actor)
    add_comment(spot["id"], actor, "一级评论")
    author_comment = add_comment(spot["id"], author, "作者的评论")
    add_comment(spot["id"], actor, "回复", parent_id=author_comment["id"])
    toggle_follow(author, actor)

    items = list_notifications(author)
    types = {item["type"] for item in items}
    assert {"like", "favorite", "comment", "reply", "follow"} <= types
    assert unread_count(author) == len(items)

    mark_all_read(author)
    assert unread_count(author) == 0


def test_notification_filter_and_clear_read():
    from app.services.notifications import (
        clear_read_notifications,
        count_notifications,
        list_notifications,
        mark_all_read,
    )

    author = make_user("通知筛选作者")
    actor = make_user("通知筛选触发")
    spot = make_spot(author, "通知筛选机位")
    toggle_like(spot["id"], actor)
    toggle_follow(author, actor)

    only_like = list_notifications(author, type_filter="like")
    assert only_like and all(item["type"] == "like" for item in only_like)
    assert count_notifications(author, "like") >= 1

    mark_all_read(author)
    removed = clear_read_notifications(author)
    assert removed >= 2
    assert list_notifications(author) == []


def test_related_spots_prefer_same_subject():
    from app.services.spots import related_spots

    user = make_user("相关机位作者")
    base = make_spot(user, "相关基准机位", subjects=["夜景"])
    same = make_spot(user, "同题材机位", subjects=["夜景"])
    other = make_spot(user, "别的题材机位", subjects=["美食"])

    related = related_spots(base["id"], None, limit=5)
    ids = [item["id"] for item in related]
    assert base["id"] not in ids
    assert same["id"] in ids
    if other["id"] in ids:
        assert ids.index(same["id"]) < ids.index(other["id"])


def test_self_interactions_do_not_notify():
    from app.services.notifications import unread_count

    user = make_user("自恋用户")
    spot = make_spot(user, "自己的机位")
    toggle_like(spot["id"], user)
    toggle_favorite(spot["id"], user)
    add_comment(spot["id"], user, "自我评论")
    assert unread_count(user) == 0


def test_pagination_reports_total_and_has_more():
    user = make_user()
    for index in range(5):
        make_spot(user, f"分页机位 {index}")
    page = list_spots(limit=2)
    assert len(page["spots"]) == 2
    assert page["total"] >= 5
    assert page["hasMore"] is True

    last = list_spots(limit=2, offset=page["total"])
    assert last["spots"] == []
    assert last["hasMore"] is False