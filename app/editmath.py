"""Deterministic pixel maths shared with the browser preview/export (mirrors pixel.ts).

Fixed order: crop -> exposure -> contrast -> saturation -> warmth -> encode.
"""

from __future__ import annotations

from typing import Any

from .utils import clamp

DEFAULT_RECIPE = {"crop": None, "exposureEv": 0.0, "contrast": 0.0, "saturation": 0.0, "warmth": 0.0}


def normalize_crop(crop: Any) -> dict[str, float] | None:
    if not isinstance(crop, dict):
        return None
    try:
        x = clamp(float(crop.get("x", 0)), 0, 1)
        y = clamp(float(crop.get("y", 0)), 0, 1)
        width = clamp(float(crop.get("width", 0)), 0, 1 - x)
        height = clamp(float(crop.get("height", 0)), 0, 1 - y)
    except (TypeError, ValueError):
        return None
    if width < 0.05 or height < 0.05:
        return None
    if width > 0.999 and height > 0.999:
        return None
    return {"x": x, "y": y, "width": width, "height": height}


def normalize_recipe(recipe: Any) -> dict[str, Any]:
    recipe = recipe or {}
    try:
        exposure = clamp(float(recipe.get("exposureEv", 0)), -1, 1)
        contrast = clamp(float(recipe.get("contrast", 0)), -20, 20)
        saturation = clamp(float(recipe.get("saturation", 0)), -20, 20)
        warmth = clamp(float(recipe.get("warmth", 0)), -20, 20)
    except (TypeError, ValueError):
        exposure = contrast = saturation = warmth = 0.0
    return {
        "crop": normalize_crop(recipe.get("crop")),
        "exposureEv": exposure,
        "contrast": contrast,
        "saturation": saturation,
        "warmth": warmth,
    }


def crop_rect(crop: Any, width: int, height: int) -> dict[str, int]:
    c = normalize_crop(crop)
    if c is None:
        return {"left": 0, "top": 0, "width": width, "height": height}
    left = round(c["x"] * width)
    top = round(c["y"] * height)
    w = max(1, round(c["width"] * width))
    h = max(1, round(c["height"] * height))
    return {"left": left, "top": top, "width": min(w, width - left), "height": min(h, height - top)}


def transform_pixels(data: bytearray, recipe: dict[str, Any]) -> bytearray:
    r = normalize_recipe(recipe)
    exp_mul = 2 ** r["exposureEv"]
    c_factor = 1 + r["contrast"] / 100
    s_factor = 1 + r["saturation"] / 100
    warm_shift = r["warmth"] * 1.5

    for i in range(0, len(data), 4):
        red = data[i] * exp_mul
        green = data[i + 1] * exp_mul
        blue = data[i + 2] * exp_mul

        red = (red - 128) * c_factor + 128
        green = (green - 128) * c_factor + 128
        blue = (blue - 128) * c_factor + 128

        luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
        red = luma + (red - luma) * s_factor
        green = luma + (green - luma) * s_factor
        blue = luma + (blue - luma) * s_factor

        red += warm_shift
        blue -= warm_shift

        data[i] = _clamp255(round(red))
        data[i + 1] = _clamp255(round(green))
        data[i + 2] = _clamp255(round(blue))
    return data


def _clamp255(value: int) -> int:
    return 0 if value < 0 else 255 if value > 255 else value


def is_identity(recipe: Any) -> bool:
    r = normalize_recipe(recipe)
    return (
        r["exposureEv"] == 0
        and r["contrast"] == 0
        and r["saturation"] == 0
        and r["warmth"] == 0
        and r["crop"] is None
    )