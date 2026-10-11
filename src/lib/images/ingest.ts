import sharp, { type Metadata } from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env';
import { resolveUploadDir } from '../db/client';
import { HttpError } from '../http';

export type DetectedFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'unknown';

export function detectFormat(buffer: Buffer): DetectedFormat {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return 'unknown';
}

const MIME_BY_FORMAT: Record<Exclude<DetectedFormat, 'unknown' | 'heic'>, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXT_BY_FORMAT: Record<Exclude<DetectedFormat, 'unknown' | 'heic'>, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

export type IngestResult = {
  id: string;
  storageKey: string;
  thumbKey: string;
  relativeDir: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  contentHash: string;
  aiInputBase64: string;
  aiInputMimeType: string;
  aiInputBytes: number;
};

function aiDir(): string {
  return path.join(resolveUploadDir(), 'ai');
}

async function buildAiInput(buffer: Buffer, format: 'jpeg' | 'png' | 'webp') {
  let edge = env.ai.maxImageEdge;
  let quality = 80;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const out = await sharp(buffer)
      .rotate()
      .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (out.length <= env.ai.maxImageBytes) {
      return { out, edge, format: 'jpeg' as const };
    }
    edge = Math.max(600, Math.round(edge * 0.75));
    quality = Math.max(50, quality - 10);
  }
  // Last resort: hard limit
  const out = await sharp(buffer)
    .rotate()
    .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 50 })
    .toBuffer();
  if (out.length > env.ai.maxImageBytes) {
    throw new HttpError(413, 'image_too_large', '图片在压缩后仍然过大，无法用于分析');
  }
  return { out, edge: 600, format: 'jpeg' as const };
}

export async function ingestImage(params: {
  ownerId: string;
  photoId: string;
  originalName: string;
  buffer: Buffer;
}): Promise<IngestResult> {
  const { buffer } = params;
  if (buffer.length === 0) throw new HttpError(400, 'empty_file', '文件为空');
  if (buffer.length > env.upload.maxBytes) {
    throw new HttpError(413, 'file_too_large', `文件超过 ${Math.round(env.upload.maxBytes / 1024 / 1024)}MB 限制`);
  }

  const detected = detectFormat(buffer);
  if (detected === 'heic') {
    throw new HttpError(415, 'heic_unsupported', '暂不支持 HEIC/HEIF，请先转换为 JPEG 或 PNG');
  }
  if (detected === 'unknown') {
    throw new HttpError(415, 'unsupported_type', '仅支持 JPEG / PNG / WebP 图片');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new HttpError(400, 'corrupt_image', '图片无法解码，可能已损坏');
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new HttpError(400, 'corrupt_image', '无法读取图片尺寸');
  if (width * height > env.upload.maxPixels) {
    throw new HttpError(413, 'too_many_pixels', '图片像素过多，超过约 40MP 限制');
  }

  const mimeType = MIME_BY_FORMAT[detected];
  const ext = EXT_BY_FORMAT[detected];

  // Normalize: apply EXIF orientation, strip metadata (incl. GPS) by re-encoding.
  let normalized: Buffer;
  let normMeta: Metadata;
  try {
    const pipeline = sharp(buffer).rotate();
    if (detected === 'jpeg') normalized = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    else if (detected === 'png') normalized = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    else normalized = await pipeline.webp({ quality: 92 }).toBuffer();
    normMeta = await sharp(normalized).metadata();
  } catch {
    throw new HttpError(400, 'corrupt_image', '图片处理失败，可能已损坏');
  }

  const finalWidth = normMeta.width ?? width;
  const finalHeight = normMeta.height ?? height;

  const relativeDir = params.ownerId.replace(/[^a-zA-Z0-9_-]/g, '');
  const dir = path.join(resolveUploadDir(), relativeDir);
  fs.mkdirSync(dir, { recursive: true });

  const storageKey = path.posix.join(relativeDir, `${params.photoId}.${ext}`);
  const thumbKey = path.posix.join(relativeDir, `${params.photoId}.thumb.jpg`);
  fs.writeFileSync(path.join(/* turbopackIgnore: true */ dir, `${params.photoId}.${ext}`), normalized);

  const thumb = await sharp(normalized)
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(path.join(/* turbopackIgnore: true */ dir, `${params.photoId}.thumb.jpg`), thumb);

  const ai = await buildAiInput(normalized, detected);
  fs.mkdirSync(aiDir(), { recursive: true });
  fs.writeFileSync(path.join(/* turbopackIgnore: true */ aiDir(), `${params.photoId}.jpg`), ai.out);

  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex');

  return {
    id: params.photoId,
    storageKey,
    thumbKey,
    relativeDir,
    mimeType,
    width: finalWidth,
    height: finalHeight,
    bytes: normalized.length,
    contentHash,
    aiInputBase64: ai.out.toString('base64'),
    aiInputMimeType: 'image/jpeg',
    aiInputBytes: ai.out.length,
  };
}

export function deletePhotoFiles(keys: string[]): void {
  const root = resolveUploadDir();
  for (const key of keys) {
    if (!key) continue;
    const abs = path.join(/* turbopackIgnore: true */ root, key);
    const normalized = path.normalize(abs);
    if (!normalized.startsWith(path.normalize(root))) continue; // prevent traversal
    try {
      fs.rmSync(normalized, { force: true });
    } catch {
      // ignore missing files
    }
  }
}

/** Produce a public, metadata-stripped derivative used when a photo is published to a spot. */
export async function makePublicDerivative(sourceKey: string, targetAbs: string, edge = 1600): Promise<{ width: number; height: number; bytes: number }> {
  const sourceAbs = path.join(/* turbopackIgnore: true */ resolveUploadDir(), sourceKey);
  const out = await sharp(sourceAbs)
    .rotate()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
  fs.writeFileSync(targetAbs, out);
  const meta = await sharp(out).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0, bytes: out.length };
}