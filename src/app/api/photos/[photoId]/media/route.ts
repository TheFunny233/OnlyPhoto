import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/http';
import { mountNoStore } from '@/lib/media';
import { getOwnedPhoto, photoThumbKey } from '@/lib/services/photos';
import { resolveUploadDir } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  try {
    const user = await requireUser();
    const { photoId } = await ctx.params;
    const photo = getOwnedPhoto(photoId, user.id);
    if (!photo) return mountNoStore(404, '照片不存在或无权访问');
    const url = new URL(request.url);
    const wantThumb = url.searchParams.get('thumb') === '1';
    const key = wantThumb ? photoThumbKey(photo.storageKey, photo.id) : photo.storageKey;
    const abs = path.join(/* turbopackIgnore: true */ resolveUploadDir(), key);
    if (!fs.existsSync(abs)) return mountNoStore(404, '文件不存在');
    const data = fs.readFileSync(abs);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'content-type': wantThumb ? 'image/jpeg' : photo.mimeType,
        'cache-control': 'private, max-age=60',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取失败';
    return mountNoStore(401, message);
  }
}