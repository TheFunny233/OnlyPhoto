from __future__ import annotations

import pytest

from app.errors import ApiError
from app.services.recommend import recommend_spots
from app.services.spots import (
    add_comment,
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