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
    category = finding.get("category")
    if category not in CATEGORIES:
        return None
    priority = finding.get("priority")
    certainty = finding.get("certainty")
    return {
        "id": _clean_text(finding.get("id"), 40) or f"f{index + 1}",
        "category": category,
        "title": _clean_text(finding.get("title"), LIMITS["short_string_length"]) or "未命名要点",
        "observation": _clean_text(finding.get("observation"), LIMITS["string_length"]),
        "explanation": _clean_text(finding.get("explanation"), LIMITS["string_length"]),
        "action": _clean_text(finding.get("action"), LIMITS["string_length"]),
        "priority": priority if priority in PRIORITIES else "medium",
        "certainty": certainty if certainty in CERTAINTIES else "tentative",
        "region": _sanitize_region(finding.get("region")),
        "requiresReshoot": bool(finding.get("requiresReshoot", False)),
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
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
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
    raw_dimensions = score.get("dimensions")
    dimensions: list[dict[str, Any]] = []
    if isinstance(raw_dimensions, list):
        seen: set[str] = set()
        for item in raw_dimensions[:8]:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            if key not in DIMENSION_WEIGHTS or key in seen:
                continue
            try:
                value = float(item.get("score"))
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
    summary = raw.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        return {"ok": False, "errors": ["summary: 缺少总览"]}

    strengths_raw = raw.get("strengths") if isinstance(raw.get("strengths"), list) else []
    improvements_raw = raw.get("improvements") if isinstance(raw.get("improvements"), list) else []

    strengths = [f for f in (_sanitize_finding(x, i) for i, x in enumerate(strengths_raw[: LIMITS["strengths"] + 2])) if f]
    improvements = [
        f for f in (_sanitize_finding(x, i + 10) for i, x in enumerate(improvements_raw[: LIMITS["improvements"] + 2])) if f
    ]

    value = {
        "schemaVersion": "1",
        "scene": _clean_text(raw.get("scene"), LIMITS["short_string_length"]),
        "summary": _clean_text(summary, LIMITS["string_length"]),
        "strengths": strengths[: LIMITS["strengths"]],
        "improvements": improvements[: LIMITS["improvements"]],
        "reshootSuggestions": _clean_str_list(raw.get("reshootSuggestions"), LIMITS["reshoot_suggestions"]),
        "editingSuggestions": _clean_str_list(raw.get("editingSuggestions"), LIMITS["editing_suggestions"]),
        "recommendedRecipe": _sanitize_recipe(raw.get("recommendedRecipe")),
        "firstAction": _clean_text(raw.get("firstAction"), LIMITS["string_length"]),
        "uncertainties": _clean_str_list(raw.get("uncertainties"), LIMITS["uncertainties"]),
        "score": _sanitize_score(raw.get("score")),
    }
    return {"ok": True, "value": value, "warnings": []}


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