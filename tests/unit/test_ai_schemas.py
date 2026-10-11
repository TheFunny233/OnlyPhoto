from __future__ import annotations

import pytest

from app.ai.schemas import extract_json_object, parse_analysis

BASE = {
    "summary": "一句总览",
    "strengths": [],
    "improvements": [],
    "reshootSuggestions": [],
    "editingSuggestions": [],
    "recommendedRecipe": None,
    "firstAction": "先做这件事",
    "uncertainties": [],
}


def test_accepts_minimal_valid_object():
    result = parse_analysis(BASE)
    assert result["ok"] is True
    assert result["value"]["schemaVersion"] == "1"
    assert result["value"]["firstAction"] == "先做这件事"


def test_rejects_missing_summary():
    payload = dict(BASE)
    payload.pop("summary")
    assert parse_analysis(payload)["ok"] is False


def test_drops_out_of_range_regions():
    result = parse_analysis(
        {
            **BASE,
            "improvements": [
                {"category": "composition", "title": "bad", "region": {"x": 5, "y": 5, "width": 1, "height": 1}},
                {"category": "light", "title": "good", "region": {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}},
            ],
        }
    )
    assert result["ok"] is True
    assert result["value"]["improvements"][0]["region"] is None
    assert result["value"]["improvements"][1]["region"] == {"x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}


def test_limits_array_sizes():
    many = [{"category": "composition", "title": f"t{i}"} for i in range(9)]
    result = parse_analysis({**BASE, "strengths": many, "uncertainties": ["a", "b", "c", "d", "e", "f", "g"]})
    assert len(result["value"]["strengths"]) <= 3
    assert len(result["value"]["uncertainties"]) <= 6


def test_clamps_recommended_recipe():
    result = parse_analysis(
        {**BASE, "recommendedRecipe": {"exposureEv": 9, "contrast": -80, "saturation": 80, "warmth": 5}}
    )
    recipe = result["value"]["recommendedRecipe"]
    assert recipe["exposureEv"] == 1
    assert recipe["contrast"] == -20
    assert recipe["saturation"] == 20


def test_ignores_invalid_category():
    result = parse_analysis({**BASE, "improvements": [{"category": "nonsense", "title": "x"}]})
    assert result["value"]["improvements"] == []


def test_extract_json_variants():
    assert extract_json_object('{"a":1}') == {"a": 1}
    assert extract_json_object('```json\n{"a":2}\n```') == {"a": 2}
    assert extract_json_object('好的，结果是 {"a":3} 完毕') == {"a": 3}
    with pytest.raises(ValueError):
        extract_json_object("没有任何结构")