import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { HttpError } from '../http';
import { makePublicDerivative } from '../images/ingest';
import { resolveUploadDir } from '../db/client';
import { getOwnedPhoto } from './photos';

export { SUBJECT_OPTIONS } from '../constants';

export type SpotInput = {
  title: string;
  city: string;
  area?: string;
  lat: number;
  lng: number;
  coordSystem?: string;
  precision: string;
  subjects: string[];
  description?: string;
  howToStand?: string;
  direction?: string;
  bestLight?: string;
  lightSource?: string;
  gear?: string;
  safety?: string;
  status?: string;
  photoId?: string | null;
  linkExistingMedia?: boolean;
};

export type SpotDTO = {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  city: string;
  area: string;
  lat: number;
  lng: number;
  coordSystem: string;
  precision: string;
  subjects: string[];
  description: string;
  howToStand: string;
  direction: string;
  bestLight: string;
  lightSource: string;
  gear: string;
  safety: string;
  status: string;
  isDemo: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  likedByViewer: boolean;
  favoritedByViewer: boolean;
  isOwner: boolean;
  media: { id: string; url: string }[];
};

function countFor(table: typeof schema.likes | typeof schema.favorites | typeof schema.comments, spotId: string): number {
  const row = db
    .select({ c: sql<number>`count(*)` })
    .from(table)
    .where(eq(table.spotId, spotId))
    .get();
  return row?.c ?? 0;
}

function loadMedia(spotId: string) {
  const rows = db
    .select()
    .from(schema.spotMedia)
    .where(eq(schema.spotMedia.spotId, spotId))
    .orderBy(schema.spotMedia.sort)
    .all();
  return rows.map((m) => ({ id: m.id, url: `/api/spots/${spotId}/media/${m.id}` }));
}

export function serializeSpot(spot: typeof schema.spots.$inferSelect, viewerId: string | null): SpotDTO {
  const owner = db.select().from(schema.users).where(eq(schema.users.id, spot.ownerId)).get();
  const liked = viewerId
    ? Boolean(
        db
          .select()
          .from(schema.likes)
          .where(and(eq(schema.likes.spotId, spot.id), eq(schema.likes.userId, viewerId)))
          .get(),
      )
    : false;
  const favorited = viewerId
    ? Boolean(
        db
          .select()
          .from(schema.favorites)
          .where(and(eq(schema.favorites.spotId, spot.id), eq(schema.favorites.userId, viewerId)))
          .get(),
      )
    : false;
  return {
    id: spot.id,
    ownerId: spot.ownerId,
    ownerName: owner?.nickname ?? '未知用户',
    title: spot.title,
    city: spot.city,
    area: spot.area,
    lat: spot.lat,
    lng: spot.lng,
    coordSystem: spot.coordSystem,
    precision: spot.precision,
    subjects: JSON.parse(spot.subjects) as string[],
    description: spot.description,
    howToStand: spot.howToStand,
    direction: spot.direction,
    bestLight: spot.bestLight,
    lightSource: spot.lightSource,
    gear: spot.gear,
    safety: spot.safety,
    status: spot.status,
    isDemo: spot.isDemo,
    verifiedAt: spot.verifiedAt ? spot.verifiedAt.toISOString() : null,
    createdAt: spot.createdAt.toISOString(),
    updatedAt: spot.updatedAt.toISOString(),
    likeCount: countFor(schema.likes, spot.id),
    favoriteCount: countFor(schema.favorites, spot.id),
    commentCount: countFor(schema.comments, spot.id),
    likedByViewer: liked,
    favoritedByViewer: favorited,
    isOwner: viewerId === spot.ownerId,
    media: loadMedia(spot.id),
  };
}

export function listSpots(filter: {
  city?: string;
  subject?: string;
  q?: string;
  favoritesOf?: string | null;
  viewerId?: string | null;
  includeHidden?: boolean;
  limit?: number;
}): SpotDTO[] {
  const limit = Math.min(filter.limit ?? 200, 300);
  let rows = db.select().from(schema.spots).orderBy(desc(schema.spots.createdAt)).all();
  if (!filter.includeHidden) rows = rows.filter((r) => r.status === 'published');
  if (filter.city) rows = rows.filter((r) => r.city === filter.city);
  if (filter.subject) {
    rows = rows.filter((r) => (JSON.parse(r.subjects) as string[]).includes(filter.subject!));
  }
  if (filter.q) {
    const q = filter.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.subjects.toLowerCase().includes(q),
    );
  }
  if (filter.favoritesOf) {
    const favIds = db
      .select()
      .from(schema.favorites)
      .where(eq(schema.favorites.userId, filter.favoritesOf))
      .all()
      .map((f) => f.spotId);
    rows = rows.filter((r) => favIds.includes(r.id));
  }
  return rows.slice(0, limit).map((r) => serializeSpot(r, filter.viewerId ?? null));
}

export function getSpot(spotId: string, viewerId: string | null): SpotDTO {
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot) throw new HttpError(404, 'not_found', '机位不存在');
  if (spot.status !== 'published' && viewerId !== spot.ownerId) {
    throw new HttpError(404, 'not_found', '机位不存在');
  }
  return serializeSpot(spot, viewerId);
}

export function listComments(spotId: string) {
  const rows = db
    .select()
    .from(schema.comments)
    .where(and(eq(schema.comments.spotId, spotId), eq(schema.comments.status, 'visible')))
    .orderBy(desc(schema.comments.createdAt), desc(sql`rowid`))
    .all();
  return rows.map((c) => {
    const user = db.select().from(schema.users).where(eq(schema.users.id, c.userId)).get();
    return {
      id: c.id,
      body: c.body,
      userId: c.userId,
      nickname: user?.nickname ?? '用户',
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function createSpot(ownerId: string, input: SpotInput): Promise<SpotDTO> {
  const id = randomUUID();
  const now = new Date();
  db.insert(schema.spots)
    .values({
      id,
      ownerId,
      title: input.title,
      city: input.city,
      area: input.area ?? '',
      lat: input.lat,
      lng: input.lng,
      coordSystem: input.coordSystem ?? 'WGS84',
      precision: input.precision,
      subjects: JSON.stringify(input.subjects ?? []),
      description: input.description ?? '',
      howToStand: input.howToStand ?? '',
      direction: input.direction ?? '',
      bestLight: input.bestLight ?? '',
      lightSource: input.lightSource ?? 'unconfirmed',
      gear: input.gear ?? '',
      safety: input.safety ?? '',
      status: input.status ?? 'published',
      isDemo: false,
      verifiedAt: input.status === 'published' ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (input.photoId) {
    await attachPhotoToSpot(id, ownerId, input.photoId);
  }

  return getSpot(id, ownerId);
}

export async function attachPhotoToSpot(spotId: string, ownerId: string, photoId: string): Promise<void> {
  const photo = getOwnedPhoto(photoId, ownerId);
  if (!photo) throw new HttpError(400, 'photo_not_owned', '选择的照片不存在或不属于你');
  const mediaId = randomUUID();
  const targetKey = path.posix.join('public', spotId, `${mediaId}.jpg`);
  const targetAbs = path.join(/* turbopackIgnore: true */ resolveUploadDir(), targetKey);
  const meta = await makePublicDerivative(photo.storageKey, targetAbs);
  db.insert(schema.spotMedia)
    .values({
      id: mediaId,
      spotId,
      ownerId,
      photoId,
      storageKey: targetKey,
      width: meta.width,
      height: meta.height,
      bytes: meta.bytes,
      sort: 0,
      isDemo: false,
      createdAt: new Date(),
    })
    .run();
}

export function updateSpot(spotId: string, ownerId: string, input: Partial<SpotInput>): SpotDTO {
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot) throw new HttpError(404, 'not_found', '机位不存在');
  if (spot.ownerId !== ownerId) throw new HttpError(403, 'forbidden', '只能编辑自己的机位');
  db.update(schema.spots)
    .set({
      title: input.title ?? spot.title,
      city: input.city ?? spot.city,
      area: input.area ?? spot.area,
      lat: input.lat ?? spot.lat,
      lng: input.lng ?? spot.lng,
      coordSystem: input.coordSystem ?? spot.coordSystem,
      precision: input.precision ?? spot.precision,
      subjects: input.subjects ? JSON.stringify(input.subjects) : spot.subjects,
      description: input.description ?? spot.description,
      howToStand: input.howToStand ?? spot.howToStand,
      direction: input.direction ?? spot.direction,
      bestLight: input.bestLight ?? spot.bestLight,
      lightSource: input.lightSource ?? spot.lightSource,
      gear: input.gear ?? spot.gear,
      safety: input.safety ?? spot.safety,
      status: input.status ?? spot.status,
      updatedAt: new Date(),
    })
    .where(eq(schema.spots.id, spotId))
    .run();
  return getSpot(spotId, ownerId);
}

export function deleteSpot(spotId: string, ownerId: string): void {
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot) throw new HttpError(404, 'not_found', '机位不存在');
  if (spot.ownerId !== ownerId) throw new HttpError(403, 'forbidden', '只能删除自己的机位');
  const media = db.select().from(schema.spotMedia).where(eq(schema.spotMedia.spotId, spotId)).all();
  db.delete(schema.spots).where(eq(schema.spots.id, spotId)).run();
  const root = resolveUploadDir();
  for (const m of media) {
    try {
      fs.rmSync(path.join(/* turbopackIgnore: true */ root, m.storageKey), { force: true });
    } catch {
      /* ignore */
    }
  }
}

export function toggleLike(spotId: string, userId: string): { liked: boolean; count: number } {
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot || spot.status !== 'published') throw new HttpError(404, 'not_found', '机位不存在');
  const existing = db
    .select()
    .from(schema.likes)
    .where(and(eq(schema.likes.spotId, spotId), eq(schema.likes.userId, userId)))
    .get();
  if (existing) {
    db.delete(schema.likes).where(and(eq(schema.likes.spotId, spotId), eq(schema.likes.userId, userId))).run();
  } else {
    db.insert(schema.likes).values({ spotId, userId, createdAt: new Date() }).onConflictDoNothing().run();
  }
  return { liked: !existing, count: countFor(schema.likes, spotId) };
}

export function toggleFavorite(spotId: string, userId: string): { favorited: boolean; count: number } {
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot || spot.status !== 'published') throw new HttpError(404, 'not_found', '机位不存在');
  const existing = db
    .select()
    .from(schema.favorites)
    .where(and(eq(schema.favorites.spotId, spotId), eq(schema.favorites.userId, userId)))
    .get();
  if (existing) {
    db.delete(schema.favorites).where(and(eq(schema.favorites.spotId, spotId), eq(schema.favorites.userId, userId))).run();
  } else {
    db.insert(schema.favorites).values({ spotId, userId, createdAt: new Date() }).onConflictDoNothing().run();
  }
  return { favorited: !existing, count: countFor(schema.favorites, spotId) };
}

export function addComment(spotId: string, userId: string, body: string) {
  const spot = db.select().from(schema.spots).where(eq(schema.spots.id, spotId)).get();
  if (!spot || spot.status !== 'published') throw new HttpError(404, 'not_found', '机位不存在');
  const text = body.replace(/\s+/g, ' ').trim().slice(0, 600);
  if (!text) throw new HttpError(400, 'empty_comment', '评论不能为空');
  const id = randomUUID();
  db.insert(schema.comments).values({ id, spotId, userId, body: text, status: 'visible', createdAt: new Date() }).run();
  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  return { id, body: text, userId, nickname: user?.nickname ?? '用户', createdAt: new Date().toISOString() };
}

export function deleteOwnComment(commentId: string, userId: string): void {
  const comment = db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).get();
  if (!comment) throw new HttpError(404, 'not_found', '评论不存在');
  if (comment.userId !== userId) throw new HttpError(403, 'forbidden', '只能删除自己的评论');
  db.delete(schema.comments).where(eq(schema.comments.id, commentId)).run();
}

export function createReport(reporterId: string, targetType: 'spot' | 'comment', targetId: string, reason: string) {
  if (!['spot', 'comment'].includes(targetType)) throw new HttpError(400, 'bad_target', '举报对象类型不正确');
  const text = reason.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!text) throw new HttpError(400, 'empty_reason', '请填写举报原因');
  const id = randomUUID();
  db.insert(schema.reports)
    .values({ id, reporterId, targetType, targetId, reason: text, status: 'open', createdAt: new Date() })
    .run();
  return { id };
}

export function listReports() {
  return db.select().from(schema.reports).orderBy(desc(schema.reports.createdAt)).all().map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function resolveReport(reportId: string, action: 'resolve' | 'hide') {
  const report = db.select().from(schema.reports).where(eq(schema.reports.id, reportId)).get();
  if (!report) throw new HttpError(404, 'not_found', '举报不存在');
  if (action === 'hide') {
    if (report.targetType === 'spot') {
      db.update(schema.spots).set({ status: 'hidden' }).where(eq(schema.spots.id, report.targetId)).run();
    } else {
      db.update(schema.comments).set({ status: 'hidden' }).where(eq(schema.comments.id, report.targetId)).run();
    }
  }
  db.update(schema.reports).set({ status: 'resolved' }).where(eq(schema.reports.id, reportId)).run();
  return { ok: true };
}

export function listCities(): string[] {
  const rows = db.select().from(schema.spots).where(eq(schema.spots.status, 'published')).all();
  return [...new Set(rows.map((r) => r.city).filter(Boolean))].sort();
}