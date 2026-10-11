from __future__ import annotations

from app.ai.schemas import DIMENSION_WEIGHTS, parse_analysis


def base_payload(score=None):
    return {
        "summary": "总览",
        "firstAction": "先做这件事",
        "strengths": [],
        "improvements": [],
        "reshootSuggestions": [],
        "editingSuggestions": [],
        "uncertainties": [],
        "score": score,
    }


def test_missing_score_is_none():
    assert parse_analysis(base_payload(None))["value"]["score"] is None
    assert parse_analysis(base_payload())["value"]["score"] is None


def test_overall_is_computed_server_side_from_weights():
    result = parse_analysis(
        base_payload({"dimensions": [{"key": "composition", "score": 80}, {"key": "light", "score": 60}]})
    )
    score = result["value"]["score"]
    expected = round(
        (80 * DIMENSION_WEIGHTS["composition"] + 60 * DIMENSION_WEIGHTS["light"])
        / (DIMENSION_WEIGHTS["composition"] + DIMENSION_WEIGHTS["light"])
    )
    assert score["overall"] == expected
    assert score["scale"].startswith("0-100")


def test_dimension_scores_are_clamped_and_unknown_keys_dropped():
    result = parse_analysis(
        base_payload(
            {
                "dimensions": [
                    {"key": "composition", "score": 700, "reason": "too high"},
                    {"key": "light", "score": -50, "reason": "too low"},
                    {"key": "nonsense", "score": 50, "reason": "dropped"},
                ]
            }
        )
    )
    score = result["value"]["score"]
    by_key = {item["key"]: item["score"] for item in score["dimensions"]}
    assert by_key == {"composition": 100, "light": 0}


def test_duplicate_dimensions_are_deduped():
    result = parse_analysis(
        base_payload(
            {
                "dimensions": [
                    {"key": "composition", "score": 90},
                    {"key": "composition", "score": 10},
                ]
            }
        )
    )
    score = result["value"]["score"]
    assert len(score["dimensions"]) == 1
    assert score["dimensions"][0]["score"] == 90


def test_pros_are_positive_and_cons_are_negative():
    result = parse_analysis(
        base_payload(
            {
                "dimensions": [{"key": "composition", "score": 70}],
                "pros": [{"label": "地平线水平", "delta": -3, "reason": "x"}],
                "cons": [{"label": "高光溢出", "delta": 4, "reason": "y"}],
            }
        )
    )
    score = result["value"]["score"]
    assert score["pros"][0]["delta"] > 0
    assert score["cons"][0]["delta"] < 0


def test_score_item_limits_and_empty_labels():
    result = parse_analysis(
        base_payload(
            {
                "dimensions": [{"key": "light", "score": 50}],
                "pros": [{"label": f"p{i}", "delta": 1} for i in range(9)] + [{"label": "", "delta": 5}],
                "cons": [{"label": f"c{i}", "delta": -1} for i in range(9)],
            }
        )
    )
    score = result["value"]["score"]
    assert len(score["pros"]) <= 5
    assert len(score["cons"]) <= 5
    assert all(item["label"] for item in score["pros"])


def test_overall_is_none_without_dimensions():
    result = parse_analysis(base_payload({"pros": [{"label": "x", "delta": 3}], "cons": []}))
    score = result["value"]["score"]
    assert score is not None
    assert score["overall"] is None
    assert score["pros"][0]["label"] == "x"