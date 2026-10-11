from __future__ import annotations

import hashlib
import io
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

from .config import settings
from .db import upload_dir
from .errors import ApiError

MAX_BYTES = settings.upload_max_bytes
MAX_PIXELS = settings.upload_max_pixels

_MIME = {"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
_EXT = {"jpeg": "jpg", "png": "png", "webp": "webp"}


def detect_format(buffer: bytes) -> str:
    if len(buffer) >= 3 and buffer[0] == 0xFF and buffer[1] == 0xD8 and buffer[2] == 0xFF:
        return "jpeg"
    if buffer[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(buffer) >= 12 and buffer[0:4] == b"RIFF" and buffer[8:12] == b"WEBP":
        return "webp"
    if len(buffer) >= 12 and buffer[4:8] == b"ftyp":
        brand = buffer[8:12].decode("ascii", "ignore")
        if brand in {"heic", "heix", "hevc", "hevx", "mif1", "msf1"}:
            return "heic"
    return "unknown"


def _encode(img: Image.Image, fmt: str, *, quality: int = 92) -> bytes:
    buf = io.BytesIO()
    if fmt == "jpeg":
        img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
    elif fmt == "png":
        img.save(buf, format="PNG", optimize=True)
    else:
        img.save(buf, format="WEBP", quality=quality, method=6)
    return buf.getvalue()


def _resize_to_edge(img: Image.Image, edge: int) -> Image.Image:
    if max(img.size) <= edge:
        return img
    return img.copy().resize(
        (edge, max(1, round(img.height * edge / img.width))) if img.width >= img.height
        else (max(1, round(img.width * edge / img.height)), edge),
        Image.LANCZOS,
    )


def ingest_image(owner_id: str, photo_id: str, original_name: str, buffer: bytes) -> dict[str, Any]:
    if not buffer:
        raise ApiError(400, "empty_file", "文件为空")
    if len(buffer) > MAX_BYTES:
        raise ApiError(413, "file_too_large", f"文件超过 {round(MAX_BYTES / 1024 / 1024)}MB 限制")

    fmt = detect_format(buffer)
    if fmt == "heic":
        raise ApiError(415, "heic_unsupported", "暂不支持 HEIC/HEIF，请先转换为 JPEG 或 PNG")
    if fmt == "unknown":
        raise ApiError(415, "unsupported_type", "仅支持 JPEG / PNG / WebP 图片")

    try:
        with Image.open(io.BytesIO(buffer)) as probe:
            probe.load()
            width, height = probe.size
    except Exception:
        raise ApiError(400, "corrupt_image", "图片无法解码，可能已损坏")

    if width <= 0 or height <= 0:
        raise ApiError(400, "corrupt_image", "无法读取图片尺寸")
    if width * height > MAX_PIXELS:
        raise ApiError(413, "too_many_pixels", "图片像素过多，超过约 40MP 限制")

    try:
        with Image.open(io.BytesIO(buffer)) as source:
            source.load()
            oriented = ImageOps.exif_transpose(source) or source
            oriented = oriented.copy()
    except Exception:
        raise ApiError(400, "corrupt_image", "图片处理失败，可能已损坏")

    normalized = _encode(oriented, fmt)
    with Image.open(io.BytesIO(normalized)) as check:
        final_width, final_height = check.size

    rel_dir = "".join(ch for ch in owner_id if ch.isalnum() or ch in "_-")
    directory = upload_dir() / rel_dir
    directory.mkdir(parents=True, exist_ok=True)

    storage_key = f"{rel_dir}/{photo_id}.{_EXT[fmt]}"
    thumb_key = f"{rel_dir}/{photo_id}.thumb.jpg"
    (directory / f"{photo_id}.{_EXT[fmt]}").write_bytes(normalized)

    thumb = oriented.copy()
    thumb.thumbnail((640, 640), Image.LANCZOS)
    (directory / f"{photo_id}.thumb.jpg").write_bytes(_encode(thumb, "jpeg", quality=80))

    ai_bytes = _build_ai_input(oriented)
    ai_dir = upload_dir() / "ai"
    ai_dir.mkdir(parents=True, exist_ok=True)
    (ai_dir / f"{photo_id}.jpg").write_bytes(ai_bytes)

    content_hash = hashlib.sha256(normalized).hexdigest()

    return {
        "id": photo_id,
        "storage_key": storage_key,
        "thumb_key": thumb_key,
        "mime_type": _MIME[fmt],
        "width": final_width,
        "height": final_height,
        "bytes": len(normalized),
        "content_hash": content_hash,
        "ai_input_base64": _b64(ai_bytes),
        "ai_input_mime_type": "image/jpeg",
        "ai_input_bytes": len(ai_bytes),
    }


def _build_ai_input(img: Image.Image) -> bytes:
    edge = settings.ai.max_image_edge
    quality = 80
    for _ in range(4):
        candidate = _encode(_resize_to_edge(img, edge), "jpeg", quality=quality)
        if len(candidate) <= settings.ai.max_image_bytes:
            return candidate
        edge = max(600, round(edge * 0.75))
        quality = max(50, quality - 10)
    candidate = _encode(_resize_to_edge(img, 600), "jpeg", quality=50)
    if len(candidate) > settings.ai.max_image_bytes:
        raise ApiError(413, "image_too_large", "图片在压缩后仍然过大，无法用于分析")
    return candidate


def _b64(data: bytes) -> str:
    import base64

    return base64.b64encode(data).decode("ascii")


def ai_input_path(photo_id: str) -> Path:
    return upload_dir() / "ai" / f"{photo_id}.jpg"


def read_ai_input_base64(photo_id: str) -> str:
    path = ai_input_path(photo_id)
    if not path.exists():
        return ""
    return _b64(path.read_bytes())


def photo_thumb_key(storage_key: str, photo_id: str) -> str:
    directory = storage_key.rsplit("/", 1)[0] if "/" in storage_key else ""
    return f"{directory}/{photo_id}.thumb.jpg" if directory else f"{photo_id}.thumb.jpg"


def delete_photo_files(keys: list[str]) -> None:
    root = upload_dir().resolve()
    for key in keys:
        if not key:
            continue
        target = (root / key).resolve()
        if root not in target.parents and target != root:
            continue
        try:
            target.unlink(missing_ok=True)
        except OSError:
            pass


def make_public_derivative(source_key: str, target_abs: Path, edge: int = 1600) -> dict[str, int]:
    source = upload_dir() / source_key
    with Image.open(source) as img:
        img.load()
        oriented = ImageOps.exif_transpose(img) or img
        derived = oriented.copy()
    derived.thumbnail((edge, edge), Image.LANCZOS)
    data = _encode(derived, "jpeg", quality=85)
    target_abs.parent.mkdir(parents=True, exist_ok=True)
    target_abs.write_bytes(data)
    return {"width": derived.width, "height": derived.height, "bytes": len(data)}