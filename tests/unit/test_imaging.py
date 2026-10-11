from __future__ import annotations

import io

import pytest
from PIL import Image

from app.errors import ApiError
from app.imaging import detect_format, ingest_image


def jpeg(width=64, height=48, color=(120, 140, 160)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buffer, format="JPEG")
    return buffer.getvalue()


def test_detects_formats():
    assert detect_format(jpeg()) == "jpeg"
    png = io.BytesIO()
    Image.new("RGB", (8, 8), (1, 2, 3)).save(png, format="PNG")
    assert detect_format(png.getvalue()) == "png"
    webp = io.BytesIO()
    Image.new("RGB", (8, 8), (1, 2, 3)).save(webp, format="WEBP")
    assert detect_format(webp.getvalue()) == "webp"


def test_detects_heic_and_unknown():
    assert detect_format(b"\x00\x00\x00\x18ftypheic" + b"\x00" * 16) == "heic"
    assert detect_format(b"hello world") == "unknown"


def test_rejects_unknown_and_heic():
    with pytest.raises(ApiError) as unknown:
        ingest_image("owner", "p1", "x.txt", b"hello")
    assert unknown.value.status == 415

    with pytest.raises(ApiError) as heic:
        ingest_image("owner", "p2", "x.heic", b"\x00\x00\x00\x18ftypheic" + b"\x00" * 16)
    assert heic.value.code == "heic_unsupported"


def test_rejects_oversized_file():
    big = bytearray(16 * 1024 * 1024)
    big[0:3] = b"\xff\xd8\xff"
    with pytest.raises(ApiError) as exc:
        ingest_image("owner", "p3", "big.jpg", bytes(big))
    assert exc.value.status == 413


def test_rejects_corrupt_jpeg():
    with pytest.raises(ApiError):
        ingest_image("owner", "p4", "broken.jpg", b"\xff\xd8\xff\x00\x01\x02\x03")


def test_corrects_exif_orientation():
    image = Image.new("RGB", (200, 100), (10, 200, 10))
    exif = image.getexif()
    exif[274] = 6  # orientation: rotate 90
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    result = ingest_image("owner", "p5", "rotated.jpg", buffer.getvalue())
    assert (result["width"], result["height"]) == (100, 200)
    assert len(result["content_hash"]) == 64


def test_ai_input_within_budget():
    result = ingest_image("owner", "p6", "large.jpg", jpeg(1600, 1200))
    assert result["ai_input_bytes"] <= 3_000_000
    assert result["ai_input_base64"]