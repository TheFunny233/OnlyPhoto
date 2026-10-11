import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { detectFormat, ingestImage } from '@/lib/images/ingest';
import { HttpError } from '@/lib/http';

const owner = 'test-owner';

async function jpeg(width = 64, height = 48) {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } } })
    .jpeg()
    .toBuffer();
}

describe('format detection', () => {
  it('detects jpeg, png, webp', async () => {
    expect(detectFormat(await jpeg())).toBe('jpeg');
    expect(detectFormat(await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer())).toBe('png');
    expect(detectFormat(await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } }).webp().toBuffer())).toBe('webp');
  });

  it('detects heic by ftyp brand and unknown otherwise', () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    expect(detectFormat(heic)).toBe('heic');
    expect(detectFormat(Buffer.from('hello world'))).toBe('unknown');
  });
});

describe('ingestImage', () => {
  it('rejects unknown content types', async () => {
    await expect(
      ingestImage({ ownerId: owner, photoId: 'p1', originalName: 'x.txt', buffer: Buffer.from('hello') }),
    ).rejects.toMatchObject({ status: 415 });
  });

  it('rejects heic with a clear message', async () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    await expect(
      ingestImage({ ownerId: owner, photoId: 'p2', originalName: 'x.heic', buffer: heic }),
    ).rejects.toMatchObject({ code: 'heic_unsupported' });
  });

  it('rejects oversized files', async () => {
    const big = Buffer.alloc(16 * 1024 * 1024, 0xff);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    await expect(
      ingestImage({ ownerId: owner, photoId: 'p3', originalName: 'big.jpg', buffer: big }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('rejects corrupt jpeg payloads', async () => {
    const corrupt = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02, 0x03, 0x04]);
    await expect(
      ingestImage({ ownerId: owner, photoId: 'p4', originalName: 'broken.jpg', buffer: corrupt }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('corrects EXIF orientation', async () => {
    const src = await sharp({ create: { width: 200, height: 100, channels: 3, background: { r: 10, g: 200, b: 10 } } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const result = await ingestImage({ ownerId: owner, photoId: 'p5', originalName: 'rotated.jpg', buffer: src });
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(result.contentHash).toHaveLength(64);
  });

  it('produces an AI input within the byte budget', async () => {
    const src = await jpeg(1600, 1200);
    const result = await ingestImage({ ownerId: owner, photoId: 'p6', originalName: 'large.jpg', buffer: src });
    expect(result.aiInputBytes).toBeLessThanOrEqual(3_000_000);
    expect(result.aiInputBase64.length).toBeGreaterThan(0);
  });
});