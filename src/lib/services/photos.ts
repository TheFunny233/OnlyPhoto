import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { ingestImage, deletePhotoFiles } from '../images/ingest';
import { HttpError } from '../http';
import { getLatestSucceededAnalysis } from '../ai/analyze';

export type PhotoDTO = {
  id: string;
  originalName: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  privacy: string;
  createdAt: string;
  analysisStatus: 'none' | 'processing' | 'succeeded' | 'failed';
  mediaUrl: string;
  thumbUrl: string;
};

export function photoThumbKey(storageKey: string, id: string): string {
  const dir = path.posix.dirname(storageKey);
  return path.posix.join(dir, `${id}.thumb.jpg`);
}

export function photoAiKey(id: string): string {
  return path.posix.join('ai', `${id}.jpg`);
}

export function toPhotoDTO(photo: typeof schema.photos.$inferSelect): PhotoDTO {
  const job = db
    .select()
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.photoId, photo.id))
    .orderBy(desc(schema.analysisJobs.createdAt))
    .get();
  const analysisStatus: PhotoDTO['analysisStatus'] = !job
    ? 'none'
    : job.status === 'succeeded'
      ? 'succeeded'
      : job.status === 'failed'
        ? 'failed'
        : job.status === 'processing' || job.status === 'queued'
          ? 'processing'
          : 'none';
  return {
    id: photo.id,
    originalName: photo.originalName,
    mimeType: photo.mimeType,
    width: photo.width,
    height: photo.height,
    bytes: photo.bytes,
    privacy: photo.privacy,
    createdAt: photo.createdAt.toISOString(),
    analysisStatus,
    mediaUrl: `/api/photos/${photo.id}/media`,
    thumbUrl: `/api/photos/${photo.id}/media?thumb=1`,
  };
}

export function listPhotos(ownerId: string): PhotoDTO[] {
  const rows = db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.ownerId, ownerId))
    .orderBy(desc(schema.photos.createdAt))
    .all();
  return rows.map(toPhotoDTO);
}

export function getOwnedPhoto(photoId: string, ownerId: string) {
  return db
    .select()
    .from(schema.photos)
    .where(and(eq(schema.photos.id, photoId), eq(schema.photos.ownerId, ownerId)))
    .get();
}

export async function createPhotoFromUpload(ownerId: string, file: File) {
  const originalName = file.name || 'upload';
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) throw new HttpError(400, 'empty_file', '请选择要上传的图片');
  const photoId = randomUUID();
  const ingested = await ingestImage({ ownerId, photoId, originalName, buffer });
  const now = new Date();
  db.insert(schema.photos)
    .values({
      id: photoId,
      ownerId,
      storageKey: ingested.storageKey,
      originalName,
      mimeType: ingested.mimeType,
      width: ingested.width,
      height: ingested.height,
      bytes: ingested.bytes,
      contentHash: ingested.contentHash,
      privacy: 'private',
      isDemo: false,
      createdAt: now,
    })
    .run();
  const photo = db.select().from(schema.photos).where(eq(schema.photos.id, photoId)).get()!;
  return { photo, ingested };
}

export function deletePhoto(photoId: string, ownerId: string): void {
  const photo = getOwnedPhoto(photoId, ownerId);
  if (!photo) throw new HttpError(404, 'not_found', '照片不存在');
  db.delete(schema.photos).where(eq(schema.photos.id, photoId)).run();
  deletePhotoFiles([
    photo.storageKey,
    photoThumbKey(photo.storageKey, photo.id),
    photoAiKey(photo.id),
  ]);
}

export function getPhotoDetail(photoId: string, ownerId: string) {
  const photo = getOwnedPhoto(photoId, ownerId);
  if (!photo) throw new HttpError(404, 'not_found', '照片不存在或无权访问');
  const analysis = getLatestSucceededAnalysis(photoId);
  const recipe = db
    .select()
    .from(schema.editRecipes)
    .where(eq(schema.editRecipes.photoId, photoId))
    .get();
  return {
    photo: toPhotoDTO(photo),
    analysis: analysis?.analysis ?? null,
    receipt: analysis?.receipt ?? null,
    jobId: analysis?.jobId ?? null,
    recipe: recipe ? JSON.parse(recipe.recipe) : null,
  };
}