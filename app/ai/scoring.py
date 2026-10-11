"""Score weighting.

The stored overall score always uses the default weights (stable, reproducible).
A user's *preference* re-weights the same dimension scores for display; this module
is the single server-side source of that mapping so API consumers and the UI agree.

Keep in sync with `PREFERENCE_WEIGHTS` in `app/static/js/workbench.js`.
"""

from __future__ import annotations

from typing import Any

from ..utils import clamp

DEFAULT_WEIGHTS: dict[str, float] = {
    "composition": 0.25,
    "light": 0.25,
    "color": 0.15,
    "subject": 0.20,
    "background": 0.15,
}

PREFERENCE_WEIGHTS: dict[str, dict[str, float]] = {
    "balanced": DEFAULT_WEIGHTS,
    "composition": {"composition": 0.40, "light": 0.20, "color": 0.10, "subject": 0.20, "background": 0.10},
    "light": {"composition": 0.20, "light": 0.40, "color": 0.10, "subject": 0.20, "background": 0.10},
    "color": {"composition": 0.20, "light": 0.20, "color": 0.40, "subject": 0.10, "background": 0.10},
    "subject": {"composition": 0.20, "light": 0.15, "color": 0.10, "subject": 0.45, "background": 0.10},
}

PREFERENCE_LABELS: dict[str, str] = {
    "balanced": "均衡",
    "composition": "更看重构图",
    "light": "更看重光线",
    "color": "更看重色彩",
    "subject": "更看重主体",
}


def normalise_preference(value: str | None) -> str:
    return value if value in PREFERENCE_WEIGHTS else "balanced"


def weighted_overall(dimensions: Any, preference: str | None = None) -> int | None:
    """Re-weight dimension scores with the given preference (weights renormalised)."""
    if not isinstance(dimensions, list) or not dimensions:
        return None
    weights = PREFERENCE_WEIGHTS[normalise_preference(preference)]
    weighted = 0.0
    total = 0.0
    for item in dimensions:
        if not isinstance(item, dict):
            continue
        try:
            score = float(item.get("score"))
        except (TypeError, ValueError):
            continue
        key = item.get("key")
        weight = weights.get(key if isinstance(key, str) else "", item.get("weight"))
        try:
            weight = float(weight)
        except (TypeError, ValueError):
            continue
        if weight <= 0:
            continue
        weighted += score * weight
        total += weight
    if total <= 0:
        return None
    return int(round(clamp(weighted / total, 0, 100)))


def apply_preference_to_score(score: Any, preference: str | None) -> Any:
    """Return a copy of the score dict with `overallPreference` filled in."""
    if not isinstance(score, dict):
        return score
    pref = normalise_preference(preference)
    enriched = dict(score)
    enriched["preference"] = pref
    enriched["preferenceLabel"] = PREFERENCE_LABELS[pref]
    enriched["overallPreference"] = weighted_overall(score.get("dimensions"), pref)
    return enriched