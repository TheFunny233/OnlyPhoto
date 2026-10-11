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