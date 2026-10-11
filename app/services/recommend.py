"""“猜你喜欢” recommendation.

Signed-in users get topic/city/author affinity boosts learned from their own
likes, favorites and comments; guests (and cold-start users) fall back to
community heat. Both paths are diversified so one author or city cannot fill
the whole list.
"""

from __future__ import annotations

from collections import Counter
from typing import Any

from ..db import query_all
from .spots import list_spots


def _interacted_spot_ids(user_id: str) -> set[str]:
    ids: set[str] = set()
    for table in ("likes", "favorites"):
        ids |= {row["spot_id"] for row in query_all(f"SELECT spot_id FROM {table} WHERE user_id = ?", (user_id,))}
    ids |= {
        row["spot_id"]
        for row in query_all("SELECT DISTINCT spot_id FROM comments WHERE user_id = ?", (user_id,))
    }
    return ids


def recommend_spots(
    viewer_id: str | None,
    *,
    limit: int = 8,
    exclude_spot_id: str | None = None,
) -> list[dict[str, Any]]:
    pool = list_spots(viewer_id=viewer_id, sort="hot", limit=200)["spots"]
    if not pool:
        return []

    interacted: set[str] = set()
    subject_weight: Counter[str] = Counter()
    city_weight: Counter[str] = Counter()
    author_weight: Counter[str] = Counter()

    if viewer_id:
        interacted = _interacted_spot_ids(viewer_id)
        for spot in pool:
            if spot["id"] in interacted:
                for subject in spot["subjects"]:
                    subject_weight[subject] += 1
                if spot["city"]:
                    city_weight[spot["city"]] += 1
                author_weight[spot["ownerId"]] += 1

    scored: list[tuple[float, dict[str, Any]]] = []
    for spot in pool:
        if spot["id"] in interacted or spot["id"] == exclude_spot_id:
            continue
        score = float(spot["hotScore"])
        if viewer_id:
            score += 6.0 * sum(subject_weight.get(s, 0) for s in spot["subjects"])
            score += 4.0 * city_weight.get(spot["city"], 0)
            score += 3.0 * author_weight.get(spot["ownerId"], 0)
        scored.append((score, spot))

    scored.sort(key=lambda item: item[0], reverse=True)

    # Diversify: at most 2 per author and 3 per city.
    picked: list[dict[str, Any]] = []
    per_author: Counter[str] = Counter()
    per_city: Counter[str] = Counter()
    for _, spot in scored:
        if per_author[spot["ownerId"]] >= 2:
            continue
        if spot["city"] and per_city[spot["city"]] >= 3:
            continue
        picked.append(spot)
        per_author[spot["ownerId"]] += 1
        if spot["city"]:
            per_city[spot["city"]] += 1
        if len(picked) >= max(1, min(limit, 24)):
            break

    # Top up with heat if diversification left the list short.
    target = max(1, min(limit, 24))
    if len(picked) < target:
        chosen = {s["id"] for s in picked}
        for _, spot in scored:
            if spot["id"] in chosen:
                continue
            picked.append(spot)
            chosen.add(spot["id"])
            if len(picked) >= target:
                break

    # Last resort (e.g. a brand-new site, or the viewer interacted with everything):
    # fall back to the hottest spots so the section is never empty.
    if len(picked) < target:
        chosen = {s["id"] for s in picked}
        for spot in sorted(pool, key=lambda s: s["hotScore"], reverse=True):
            if spot["id"] in chosen or spot["id"] == exclude_spot_id:
                continue
            picked.append(spot)
            chosen.add(spot["id"])
            if len(picked) >= target:
                break
    return picked