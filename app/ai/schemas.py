"""Validation + normalisation for model output (mirrors the reference schema.ts)."""

from __future__ import annotations

import json
import re
from typing import Any

from ..utils import clamp

LIMITS = {
    "strengths": 3,
    "improvements": 3,
    "reshoot_suggestions": 3,
    "editing_suggestions": 6,
    "uncertainties": 6,
    "string_length": 600,
    "short_string_length": 160,
    "score_pros": 5,
    "score_cons": 5,
}

# Dimension weights are fixed server-side so the overall score is reproducible and
# never "invented" by the model. Missing dimensions are ignored (weights renormalised).
DIMENSION_WEIGHTS: dict[str, float] = {
    "composition": 0.25,
    "light": 0.25,
    "color": 0.15,
    "subject": 0.20,
    "background": 0.15,
}

DIMENSION_LABELS: dict[str, str] = {
    "composition": "构图",
    "light": "光线",
    "color": "色彩",
    "subject": "主体",
    "background": "背景",
}

CATEGORIES = {"composition", "light", "color", "subject", "background", "other"}
PRIORITIES = {"high", "medium", "low"}
CERTAINTIES = {"clear", "tentative"}

# Models do not always follow the exact keys/enums we ask for (especially with Chinese
# prompts). We accept common aliases and map unrecognised categories to "other" instead of
# dropping the whole finding -- otherwise a naming difference silently empties the report.
FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "summary": ("summary", "总览", "overview", "整体评价", "一句话总览"),
    "scene": ("scene", "场景", "场景判断"),
    "strengths": ("strengths", "strength", "优点", "positives", "pros", "亮点"),
    "improvements": ("improvements", "improvement", "issues", "problems", "问题", "可改进处", "不足", "negatives", "cons"),
    "reshootSuggestions": ("reshootSuggestions", "reshoot_suggestions", "reshoot", "重拍建议", "重拍"),
    "editingSuggestions": ("editingSuggestions", "editing_suggestions", "editing", "修图建议", "编辑建议", "retouch"),
    "uncertainties": ("uncertainties", "uncertainty", "不确定", "不确定事项"),
    "firstAction": ("firstAction", "first_action", "first", "先做这一件事", "首要行动"),
    "score": ("score", "评分", "打分"),
    "recommendedRecipe": ("recommendedRecipe", "recommended_recipe", "recipe", "推荐参数"),
}

CATEGORY_ALIASES: dict[str, str] = {
    "composition": "composition", "构图": "composition", "compose": "composition",
    "light": "light", "光线": "light", "曝光": "light", "光影": "light",
    "color": "color", "色彩": "color", "颜色": "color", "色调": "color",
    "subject": "subject", "主体": "subject", "subjectmatter": "subject",
    "background": "background", "背景": "background",
    "other": "other", "其他": "other", "其它": "other",
}

PRIORITY_ALIASES: dict[str, str] = {
    "high": "high", "高": "high", "高优先级": "high", "优先级高": "high",
    "medium": "medium", "中": "medium", "中优先级": "medium", "优先级中": "medium",
    "low": "low", "低": "low", "低优先级": "low", "优先级低": "low",
}

CERTAINTY_ALIASES: dict[str, str] = {
    "clear": "clear", "明确": "clear", "确定": "clear",
    "tentative": "tentative", "不确定": "tentative", "推测": "tentative",
}

FINDING_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "id": ("id", "标识"),
    "category": ("category", "type", "类别", "类型", "方面"),
    "title": ("title", "name", "标题", "要点", "名称"),
    "observation": ("observation", "observed", "现象", "描述", "问题现象"),
    "explanation": ("explanation", "reason", "why", "解释", "说明", "原因"),
    "action": ("action", "suggestion", "advice", "建议", "怎么做", "行动", "改进建议"),
    "priority": ("priority", "优先级", "重要程度"),
    "certainty": ("certainty", "确定性", "置信度"),
    "region": ("region", "area", "box", "区域", "框选"),
    "requiresReshoot": ("requiresReshoot", "requires_reshoot", "needsReshoot", "需要重拍", "重拍"),
}


def _pick(raw: dict, field: str, default: Any = None) -> Any:
    """Look up a field by its canonical name or any accepted alias (case-insensitive)."""
    if not isinstance(raw, dict):
        return default
    lowered = {str(key).strip().lower(): value for key, value in raw.items()}
    for alias in FIELD_ALIASES.get(field, (field,)):
        if alias.lower() in lowered:
            return lowered[alias.lower()]
    return default


def _pick_finding(raw: dict, field: str, default: Any = None) -> Any:
    if not isinstance(raw, dict):
        return default
    lowered = {str(key).strip().lower(): value for key, value in raw.items()}
    for alias in FINDING_FIELD_ALIASES.get(field, (field,)):
        if alias.lower() in lowered:
            return lowered[alias.lower()]
    return default


def _coerce_enum(value: Any, mapping: dict[str, str], fallback: str) -> str:
    if isinstance(value, str):
        stripped = value.strip()
        if stripped in mapping:  # exact match first (covers CJK aliases)
            return mapping[stripped]
        lowered = stripped.lower()
        if lowered in mapping:
            return mapping[lowered]
    return fallback


def _as_list(value: Any) -> list[Any]:
    """Accept a list, or a dict wrapping a list (e.g. {"items": [...]}), or a single item."""
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("items", "list", "data", "entries", "结果", "列表"):
            if isinstance(value.get(key), list):
                return value[key]
        # A dict that looks like a single finding.
        if any(k in value for k in ("title", "标题", "name")):
            return [value]
        return []
    if isinstance(value, str) and value.strip():
        return [value]
    return []

_WS = re.compile(r"\s+")


def _clean_text(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    return _WS.sub(" ", value).strip()[:max_len]


def _sanitize_region(region: Any) -> dict[str, float] | None:
    if not isinstance(region, dict):
        return None
    try:
        x = float(region.get("x"))
        y = float(region.get("y"))
        width = float(region.get("width"))
        height = float(region.get("height"))
    except (TypeError, ValueError):
        return None
    if not all(v == v and abs(v) != float("inf") for v in (x, y, width, height)):
        return None
    if width <= 0 or height <= 0:
        return None
    cx = clamp(x, 0.0, 1.0)
    cy = clamp(y, 0.0, 1.0)
    cw = clamp(width, 0.0, 1.0 - cx)
    ch = clamp(height, 0.0, 1.0 - cy)
    if cw < 0.02 or ch < 0.02:
        return None
    if cw > 0.98 and ch > 0.98:
        return None
    return {"x": cx, "y": cy, "width": cw, "height": ch}


def _sanitize_finding(finding: Any, index: int) -> dict[str, Any] | None:
    if not isinstance(finding, dict):
        return None
    # Accept common key aliases and map unknown categories to "other" rather than dropping
    # the whole finding (a naming difference must not silently empty the report).
    category = _coerce_enum(_pick_finding(finding, "category"), CATEGORY_ALIASES, "other")
    title = _clean_text(_pick_finding(finding, "title"), LIMITS["short_string_length"])
    observation = _clean_text(_pick_finding(finding, "observation"), LIMITS["string_length"])
    if not title and not observation:
        return None  # nothing usable at all
    requires_reshoot = _pick_finding(finding, "requiresReshoot", False)
    if isinstance(requires_reshoot, str):
        requires_reshoot = requires_reshoot.strip().lower() in {"true", "yes", "1", "需要", "是"}
    return {
        "id": _clean_text(_pick_finding(finding, "id"), 40) or f"f{index + 1}",
        "category": category,
        "title": title or (observation[:40] if observation else "未命名要点"),
        "observation": observation,
        "explanation": _clean_text(_pick_finding(finding, "explanation"), LIMITS["string_length"]),
        "action": _clean_text(_pick_finding(finding, "action"), LIMITS["string_length"]),
        "priority": _coerce_enum(_pick_finding(finding, "priority"), PRIORITY_ALIASES, "medium"),
        "certainty": _coerce_enum(_pick_finding(finding, "certainty"), CERTAINTY_ALIASES, "tentative"),
        "region": _sanitize_region(_pick_finding(finding, "region")),
        "requiresReshoot": bool(requires_reshoot),
    }


def _sanitize_recipe(recipe: Any) -> dict[str, Any] | None:
    if not isinstance(recipe, dict):
        return None

    def num(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    return {
        "crop": _sanitize_region(recipe.get("crop")),
        "exposureEv": clamp(num(recipe.get("exposureEv")), -1, 1),
        "contrast": clamp(num(recipe.get("contrast")), -20, 20),
        "saturation": clamp(num(recipe.get("saturation")), -20, 20),
        "warmth": clamp(num(recipe.get("warmth")), -20, 20),
    }


def _clean_str_list(value: Any, max_items: int) -> list[str]:
    """Accept strings, or dicts wrapping a sentence (models sometimes do both)."""
    items = _as_list(value)
    out: list[str] = []
    for item in items:
        if isinstance(item, dict):
            picked = None
            for key in ("text", "content", "suggestion", "advice", "reason", "建议", "内容", "description", "title"):
                if isinstance(item.get(key), str) and item[key].strip():
                    picked = item[key]
                    break
            text = _clean_text(picked, LIMITS["string_length"])
        else:
            text = _clean_text(item, LIMITS["string_length"])
        if text:
            out.append(text)
        if len(out) >= max_items:
            break
    return out


def _sanitize_score_items(items: Any, *, positive: bool, limit: int) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return out
    for item in items:
        if not isinstance(item, dict):
            continue
        label = _clean_text(item.get("label"), LIMITS["short_string_length"])
        if not label:
            continue
        try:
            delta = float(item.get("delta"))
        except (TypeError, ValueError):
            delta = 0.0
        delta = clamp(delta, -20, 20)
        if positive:
            delta = abs(delta)
        else:
            delta = -abs(delta)
        out.append(
            {
                "label": label,
                "delta": round(delta, 1),
                "reason": _clean_text(item.get("reason"), LIMITS["string_length"]),
            }
        )
        if len(out) >= limit:
            break
    return out


def _compute_overall(dimensions: list[dict[str, Any]]) -> int | None:
    """Weighted average of dimension scores, computed server-side (never invented)."""
    if not dimensions:
        return None
    total_weight = sum(item["weight"] for item in dimensions)
    if total_weight <= 0:
        return None
    score = sum(item["score"] * item["weight"] for item in dimensions) / total_weight
    return int(round(clamp(score, 0, 100)))


def _sanitize_score(score: Any) -> dict[str, Any] | None:
    if not isinstance(score, dict):
        return None
    raw_dimensions = score.get("dimensions") if isinstance(score.get("dimensions"), list) else None
    if raw_dimensions is None:
        for alias in ("dims", "维度", "items", "list"):
            if isinstance(score.get(alias), list):
                raw_dimensions = score[alias]
                break
    dimensions: list[dict[str, Any]] = []
    if isinstance(raw_dimensions, list):
        seen: set[str] = set()
        for item in raw_dimensions[:8]:
            if not isinstance(item, dict):
                continue
            raw_key = item.get("key") if "key" in item else (item.get("维度") or item.get("name"))
            key = _coerce_enum(raw_key, CATEGORY_ALIASES, "")
            if key not in DIMENSION_WEIGHTS or key in seen:
                continue
            raw_value = item.get("score", item.get("分值", item.get("value")))
            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue
            if value != value:  # NaN guard
                continue
            seen.add(key)
            dimensions.append(
                {
                    "key": key,
                    "label": DIMENSION_LABELS[key],
                    "score": int(round(clamp(value, 0, 100))),
                    "weight": DIMENSION_WEIGHTS[key],
                    "reason": _clean_text(item.get("reason"), LIMITS["string_length"]),
                }
            )

    pros = _sanitize_score_items(score.get("pros"), positive=True, limit=LIMITS["score_pros"])
    cons = _sanitize_score_items(score.get("cons"), positive=False, limit=LIMITS["score_cons"])
    if not dimensions and not pros and not cons:
        return None
    return {
        "overall": _compute_overall(dimensions),
        "summary": _clean_text(score.get("summary"), LIMITS["string_length"]),
        "dimensions": dimensions,
        "pros": pros,
        "cons": cons,
        "scale": "0-100（主观参考分，非专业认证）",
    }


def parse_analysis(raw: Any) -> dict[str, Any]:
    """Return {"ok": bool, "value"|"errors"}. Mirrors the reference semantics."""
    if not isinstance(raw, dict):
        return {"ok": False, "errors": ["(root): 模型输出不是 JSON 对象"]}
    warnings: list[str] = []

    summary = _pick(raw, "summary")
    if not isinstance(summary, str):
        summary = ""
    strengths_raw = _as_list(_pick(raw, "strengths"))
    improvements_raw = _as_list(_pick(raw, "improvements"))
    reshoot_raw = _pick(raw, "reshootSuggestions")
    editing_raw = _pick(raw, "editingSuggestions")
    if not summary.strip() and not strengths_raw and not improvements_raw and not _as_list(reshoot_raw) and not _as_list(editing_raw):
        return {"ok": False, "errors": ["模型输出缺少可用的点评内容"]}
    if not summary.strip():
        warnings.append("模型未返回总览，已留空")

    strengths = [f for f in (_sanitize_finding(x, i) for i, x in enumerate(strengths_raw[: LIMITS["strengths"] + 2])) if f]
    improvements = [
        f for f in (_sanitize_finding(x, i + 10) for i, x in enumerate(improvements_raw[: LIMITS["improvements"] + 2])) if f
    ]

    value = {
        "schemaVersion": "1",
        "scene": _clean_text(_pick(raw, "scene"), LIMITS["short_string_length"]),
        "summary": _clean_text(summary, LIMITS["string_length"]),
        "strengths": strengths[: LIMITS["strengths"]],
        "improvements": improvements[: LIMITS["improvements"]],
        "reshootSuggestions": _clean_str_list(reshoot_raw, LIMITS["reshoot_suggestions"]),
        "editingSuggestions": _clean_str_list(editing_raw, LIMITS["editing_suggestions"]),
        "recommendedRecipe": _sanitize_recipe(_pick(raw, "recommendedRecipe")),
        "firstAction": _clean_text(_pick(raw, "firstAction"), LIMITS["string_length"]),
        "uncertainties": _clean_str_list(_pick(raw, "uncertainties"), LIMITS["uncertainties"]),
        "score": _sanitize_score(_pick(raw, "score")),
    }
    return {"ok": True, "value": value, "warnings": warnings}


def extract_json_object(text: str) -> Any:
    trimmed = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", trimmed, re.IGNORECASE)
    candidate = fence.group(1) if fence else trimmed
    try:
        return json.loads(candidate)
    except ValueError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start >= 0 and end > start:
            return json.loads(candidate[start : end + 1])
        raise ValueError("模型未返回可解析的 JSON")

# Same limits as the reference implementation.
LIMITS.update({"strengths": 3, "improvements": 3})