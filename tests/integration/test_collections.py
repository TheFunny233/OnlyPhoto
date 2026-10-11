from __future__ import annotations

import pytest

from app.errors import ApiError
from app.services.collections import (
    add_to_collection,
    create_collection,
    delete_collection,
    get_collection,
    list_collections,
    remove_from_collection,
    rename_collection,
)
from app.services.spots import create_spot
from app.services.users import create_user
from app.utils import new_id


def make_user(nickname: str = "收藏夹用户") -> str:
    return create_user(f"collections-{new_id()}@example.com", nickname, "password123")


def make_spot(user_id: str, title: str, city: str = "收藏夹市") -> dict:
    return create_spot(
        user_id,
        {"title": title, "city": city, "lat": 31.2, "lng": 121.4, "precision": "approximate", "subjects": ["风景"]},
    )


def test_create_rename_delete_collection():
    user = make_user()
    collection = create_collection(user, "周末想去")
    assert collection["name"] == "周末想去"
    assert collection["count"] == 0

    renamed = rename_collection(collection["id"], user, "夜景练习")
    assert renamed["name"] == "夜景练习"

    names = [item["name"] for item in list_collections(user)]
    assert "夜景练习" in names

    delete_collection(collection["id"], user)
    assert all(item["id"] != collection["id"] for item in list_collections(user))


def test_collection_requires_owner():
    owner = make_user("夹主")
    other = make_user("他人")
    collection = create_collection(owner, "私有夹")
    with pytest.raises(ApiError):
        rename_collection(collection["id"], other, "改名")
    with pytest.raises(ApiError):
        delete_collection(collection["id"], other)
    with pytest.raises(ApiError):
        get_collection(collection["id"], other, other)


def test_add_and_remove_spots_and_dedupe():
    user = make_user()
    spot = make_spot(user, "收藏夹机位")
    collection = create_collection(user, "主题")

    added = add_to_collection(collection["id"], user, spot["id"], user)
    assert added["count"] == 1
    assert added["spots"][0]["id"] == spot["id"]

    # Duplicate add must not double count (primary key).
    again = add_to_collection(collection["id"], user, spot["id"], user)
    assert again["count"] == 1

    removed = remove_from_collection(collection["id"], user, spot["id"], user)
    assert removed["count"] == 0


def test_add_unknown_spot_rejected():
    user = make_user()
    collection = create_collection(user, "空夹")
    with pytest.raises(ApiError):
        add_to_collection(collection["id"], user, "missing-spot", user)


def test_collection_list_reports_counts():
    user = make_user()
    first = make_spot(user, "机位一")
    second = make_spot(user, "机位二")
    collection = create_collection(user, "两个")
    add_to_collection(collection["id"], user, first["id"], user)
    add_to_collection(collection["id"], user, second["id"], user)

    listed = [item for item in list_collections(user) if item["id"] == collection["id"]][0]
    assert listed["count"] == 2
    assert len(listed["spotIds"]) == 2