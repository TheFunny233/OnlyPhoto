import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';
import { resolveUploadDir } from '@/lib/db/client';
import { mountNoStore } from '@/lib/media';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ spotId: string; mediaId: string }> }) {
  const { spotId, mediaId } = await ctx.params;
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot || spot.status !== 'published') return mountNoStore(404, '图片不存在');
  const media = db
    .select()
    .from(schema.spotMedia)
    .where(and(eq(schema.spotMedia.id, mediaId), eq(schema.spotMedia.spotId, spotId)))
    .get();
  if (!media) return mountNoStore(404, '图片不存在');
  const abs = path.join(/* turbopackIgnore: true */ resolveUploadDir(), media.storageKey);
  if (!fs.existsSync(abs)) return mountNoStore(404, '图片文件不存在');
  const data = fs.readFileSync(abs);
  return new NextResponse(new Uint8Array(data), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=300' },
  });
}