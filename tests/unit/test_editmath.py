from __future__ import annotations

from app.editmath import DEFAULT_RECIPE, crop_rect, is_identity, normalize_crop, normalize_recipe, transform_pixels


def _rgba(colors):
    data = bytearray(len(colors) * 4)
    for index, color in enumerate(colors):
        data[index * 4] = color[0]
        data[index * 4 + 1] = color[1]
        data[index * 4 + 2] = color[2]
        data[index * 4 + 3] = 255
    return data


def test_identity_recipe_leaves_pixels_unchanged():
    data = _rgba([(10, 20, 30), (200, 100, 50)])
    assert bytes(transform_pixels(data, DEFAULT_RECIPE)) == bytes(_rgba([(10, 20, 30), (200, 100, 50)]))


def test_exposure_brightens_and_darkens():
    assert transform_pixels(_rgba([(100, 100, 100)]), {**DEFAULT_RECIPE, "exposureEv": 0.5})[0] > 100
    assert transform_pixels(_rgba([(100, 100, 100)]), {**DEFAULT_RECIPE, "exposureEv": -0.5})[0] < 100


def test_warmth_shifts_red_and_blue():
    out = transform_pixels(_rgba([(120, 120, 120)]), {**DEFAULT_RECIPE, "warmth": 20})
    assert out[0] > 120 and out[2] < 120


def test_clamps_to_byte_range():
    out = transform_pixels(_rgba([(250, 250, 250)]), {**DEFAULT_RECIPE, "exposureEv": 1, "contrast": 20})
    assert 0 <= out[0] <= 255


def test_preserves_alpha():
    data = bytearray([100, 100, 100, 77])
    assert transform_pixels(data, {**DEFAULT_RECIPE, "exposureEv": 0.5})[3] == 77


def test_normalize_recipe_clamps():
    recipe = normalize_recipe({"exposureEv": 5, "contrast": -100, "saturation": 999, "warmth": 50})
    assert recipe["exposureEv"] == 1
    assert recipe["contrast"] == -20
    assert recipe["saturation"] == 20
    assert recipe["warmth"] == 20


def test_normalize_crop_rejects_invalid():
    assert normalize_crop({"x": 0.1, "y": 0.1, "width": 0, "height": 0.5}) is None
    assert normalize_crop({"x": 0, "y": 0, "width": 1, "height": 1}) is None
    assert normalize_crop({"x": 0.1, "y": 0.1, "width": 0.5, "height": 0.5}) == {
        "x": 0.1,
        "y": 0.1,
        "width": 0.5,
        "height": 0.5,
    }


def test_crop_rect_maps_percentages():
    assert crop_rect({"x": 0.25, "y": 0.5, "width": 0.5, "height": 0.5}, 400, 200) == {
        "left": 100,
        "top": 100,
        "width": 200,
        "height": 100,
    }


def test_is_identity():
    assert is_identity(DEFAULT_RECIPE)
    assert not is_identity({**DEFAULT_RECIPE, "contrast": 5})