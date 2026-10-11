from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ..security import require_same_origin, require_user
from ..services.collections import (
    add_to_collection,
    create_collection,
    delete_collection,
    get_collection,
    list_collections,
    remove_from_collection,
    rename_collection,
)

router = APIRouter()


class CollectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)


class CollectionItemIn(BaseModel):
    spotId: str = Field(min_length=1, max_length=60)


@router.get("/api/collections")
def index(request: Request) -> dict:
    user = require_user(request)
    return {"collections": list_collections(user["id"])}


@router.post("/api/collections")
def create(payload: CollectionIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"collection": create_collection(user["id"], payload.name)}


@router.get("/api/collections/{collection_id}")
def detail(collection_id: str, request: Request) -> dict:
    user = require_user(request)
    return {"collection": get_collection(collection_id, user["id"], user["id"])}


@router.patch("/api/collections/{collection_id}")
def rename(collection_id: str, payload: CollectionIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"collection": rename_collection(collection_id, user["id"], payload.name)}


@router.delete("/api/collections/{collection_id}")
def remove(collection_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return delete_collection(collection_id, user["id"])


@router.post("/api/collections/{collection_id}/spots")
def add_item(collection_id: str, payload: CollectionItemIn, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"collection": add_to_collection(collection_id, user["id"], payload.spotId, user["id"])}


@router.delete("/api/collections/{collection_id}/spots/{spot_id}")
def remove_item(collection_id: str, spot_id: str, request: Request) -> dict:
    require_same_origin(request)
    user = require_user(request)
    return {"collection": remove_from_collection(collection_id, user["id"], spot_id, user["id"])}