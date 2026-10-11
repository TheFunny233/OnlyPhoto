from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.ai.scoring import (
    DEFAULT_WEIGHTS,
    PREFERENCE_WEIGHTS,
    apply_preference_to_score,
    normalise_preference,
    weighted_overall,
)

ROOT = Path(__file__).resolve().parent.parent.parent

DIMS = [
    {"key": "composition", "score": 80},
    {"key": "light", "score": 40},
    {"key": "color", "score": 90},
    {"key": "subject", "score": 60},
    {"key": "background", "score": 70},
]


def test_default_weights_cover_all_dimensions_and_sum_to_one():
    assert set(DEFAULT_WEIGHTS) == {"composition", "light", "color", "subject", "background"}
    assert sum(DEFAULT_WEIGHTS.values()) == pytest.approx(1.0)


def test_every_preference_covers_all_dimensions_and_sums_to_one():
    for name, weights in PREFERENCE_WEIGHTS.items():
        assert set(weights) == set(DEFAULT_WEIGHTS), name
        assert sum(weights.values()) == pytest.approx(1.0), name


def test_balanced_matches_default_weighting():
    balanced = weighted_overall(DIMS, "balanced")
    from app.ai.schemas import _compute_overall

    default_view = [{"score": d["score"], "weight": DEFAULT_WEIGHTS[d["key"]]} for d in DIMS]
    assert balanced == _compute_overall(default_view)


def test_light_preference_lowers_score_when_light_is_weak():
    balanced = weighted_overall(DIMS, "balanced")
    light_focus = weighted_overall(DIMS, "light")
    # light=40 is the weakest dimension, so emphasising it must reduce the overall.
    assert light_focus < balanced


def test_color_preference_raises_score_when_color_is_strong():
    balanced = weighted_overall(DIMS, "balanced")
    color_focus = weighted_overall(DIMS, "color")
    assert color_focus > balanced


def test_unknown_preference_falls_back_to_balanced():
    assert normalise_preference("nonsense") == "balanced"
    assert normalise_preference(None) == "balanced"
    assert weighted_overall(DIMS, "nonsense") == weighted_overall(DIMS, "balanced")


def test_missing_dimensions_are_ignored():
    assert weighted_overall([], "balanced") is None
    assert weighted_overall(None, "balanced") is None
    partial = weighted_overall([{"key": "composition", "score": 90}], "light")
    assert partial == 90


def test_apply_preference_enriches_score_copy():
    score = {"dimensions": DIMS, "overall": 71}
    enriched = apply_preference_to_score(score, "light")
    assert score.get("overallPreference") is None  # original untouched
    assert enriched["preference"] == "light"
    assert enriched["preferenceLabel"] == "更看重光线"
    assert enriched["overallPreference"] == weighted_overall(DIMS, "light")
    assert enriched["overall"] == 71  # stored overall preserved


def test_python_and_javascript_weights_stay_in_sync():
    """The client re-computes the same weighting; guard against drift."""
    js = (ROOT / "app" / "static" / "js" / "workbench.js").read_text(encoding="utf-8")
    block = re.search(r"const PREFERENCE_WEIGHTS = \{(?P<body>.*?)\n  \};", js, re.S)
    assert block, "PREFERENCE_WEIGHTS not found in workbench.js"
    body = block.group("body")

    for pref in PREFERENCE_WEIGHTS:
        row = re.search(rf"{pref}:\s*\{{(?P<inner>[^}}]*)\}}", body)
        assert row, f"preference {pref} missing in JS weights"
        inner = row.group("inner")
        js_weights = {
            key: float(value)
            for key, value in re.findall(r"(\w+):\s*([0-9.]+)", inner)
        }
        assert js_weights == pytest.approx(PREFERENCE_WEIGHTS[pref]), pref

    # And the shared constants used elsewhere agree too.
    assert json.dumps(sorted(PREFERENCE_WEIGHTS)) == json.dumps(
        sorted(["balanced", "composition", "light", "color", "subject"])
    )