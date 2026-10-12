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


def test_invalid_category_becomes_other_instead_of_being_dropped():
    """Naming differences must not silently empty the report (see BUGLOG)."""
    result = parse_analysis({**BASE, "improvements": [{"category": "nonsense", "title": "x"}]})
    assert len(result["value"]["improvements"]) == 1
    assert result["value"]["improvements"][0]["category"] == "other"


def test_accepts_chinese_keys_and_categories():
    """Regression: a Chinese-keyed response used to be dropped entirely, emptying the report."""
    raw = {
        "总览": "街景随拍，元素较多但缺少视觉重心。",
        "优点": [{"类别": "构图", "标题": "线条引导", "现象": "道路标线形成纵深", "优先级": "高"}],
        "可改进处": [{"类型": "背景", "标题": "路牌抢眼", "现象": "右侧路牌更亮", "需要重拍": False}],
        "重拍建议": [{"text": "向左移动让路牌避开主体"}],
        "修图建议": ["降低整体饱和度"],
        "先做这一件事": "先裁掉右侧路牌",
        "不确定": ["无法确定拍摄时间"],
        "评分": {"dims": [{"维度": "构图", "分值": 70}, {"维度": "色彩", "分值": 50}]},
    }
    result = parse_analysis(raw)
    assert result["ok"] is True
    value = result["value"]
    assert value["summary"].startswith("街景随拍")
    assert [(f["category"], f["priority"]) for f in value["strengths"]] == [("composition", "high")]
    assert value["improvements"][0]["category"] == "background"
    assert value["reshootSuggestions"] == ["向左移动让路牌避开主体"]
    assert value["editingSuggestions"] == ["降低整体饱和度"]
    assert value["firstAction"] == "先裁掉右侧路牌"
    assert value["uncertainties"] == ["无法确定拍摄时间"]
    assert value["score"]["overall"] == 62  # (70*.25 + 50*.15) / (.25+.15)
    assert [d["key"] for d in value["score"]["dimensions"]] == ["composition", "color"]


def test_unknown_category_falls_back_to_other_instead_of_dropping():
    result = parse_analysis(
        {"summary": "总览", "improvements": [{"category": "完全未知", "title": "某问题", "observation": "现象"}]}
    )
    assert result["ok"] is True
    assert len(result["value"]["improvements"]) == 1
    assert result["value"]["improvements"][0]["category"] == "other"


def test_findings_wrapped_in_a_dict_are_extracted():
    result = parse_analysis(
        {"summary": "总览", "strengths": {"items": [{"category": "light", "title": "光线柔和"}]}}
    )
    assert result["ok"] is True
    assert [f["title"] for f in result["value"]["strengths"]] == ["光线柔和"]


def test_finding_without_title_uses_observation_and_keeps_content():
    result = parse_analysis({"summary": "总览", "improvements": [{"category": "color", "observation": "偏色明显"}]})
    assert result["ok"] is True
    finding = result["value"]["improvements"][0]
    assert finding["title"] == "偏色明显"
    assert finding["observation"] == "偏色明显"


def test_summary_optional_when_other_content_present():
    result = parse_analysis({"strengths": [{"category": "composition", "title": "有引导线"}]})
    assert result["ok"] is True
    assert result["value"]["summary"] == ""
    assert any("总览" in w for w in result["warnings"])


def test_totally_empty_output_is_rejected():
    result = parse_analysis({"summary": ""})
    assert result["ok"] is False


def test_extract_json_variants():
    assert extract_json_object('{"a":1}') == {"a": 1}
    assert extract_json_object('```json\n{"a":2}\n```') == {"a": 2}
    assert extract_json_object('好的，结果是 {"a":3} 完毕') == {"a": 3}
    with pytest.raises(ValueError):
        extract_json_object("没有任何结构")