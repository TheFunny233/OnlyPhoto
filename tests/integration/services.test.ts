import { beforeAll, describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema, resolveDatabasePath } from '@/lib/db/client';
import { runMigrations } from '@/lib/db/migrate';
import { env } from '@/lib/env';
import { hashPassword } from '@/lib/auth/password';
import {
  addComment,
  createSpot,
  deleteSpot,
  listComments,
  toggleFavorite,
  toggleLike,
} from '@/lib/services/spots';
import { runAnalysis } from '@/lib/ai/analyze';
import { consumeBudget, getBudget } from '@/lib/ai/budget';

function makeUser(email: string, nickname: string) {
  const id = randomUUID();
  db.insert(schema.users)
    .values({
      id,
      email,
      nickname,
      passwordHash: hashPassword('x'.repeat(10)),
      isDemo: false,
      createdAt: new Date(),
    })
    .run();
  return id;
}

const spotInput = (title: string) => ({
  title,
  city: '测试市',
  lat: 31.2,
  lng: 121.4,
  precision: 'approximate' as const,
  subjects: ['风景'],
});

beforeAll(() => {
  runMigrations();
});

describe('spot interactions', () => {
  it('like toggles and keeps a single row', async () => {
    const user = makeUser(`like-${Date.now()}@example.com`, '点赞用户');
    const spot = await createSpot(user, spotInput('点赞机位'));
    const first = toggleLike(spot.id, user);
    expect(first.liked).toBe(true);
    expect(first.count).toBe(1);
    // duplicate insert must not double count
    db.insert(schema.likes).values({ spotId: spot.id, userId: user, createdAt: new Date() }).onConflictDoNothing().run();
    expect(toggleLike(spot.id, user).liked).toBe(false);
    expect(toggleLike(spot.id, user).count).toBe(1);
  });

  it('favorite toggles', async () => {
    const user = makeUser(`fav-${Date.now()}@example.com`, '收藏用户');
    const spot = await createSpot(user, spotInput('收藏机位'));
    expect(toggleFavorite(spot.id, user).favorited).toBe(true);
    expect(toggleFavorite(spot.id, user).favorited).toBe(false);
  });

  it('deleting a spot cascades comments and likes', async () => {
    const user = makeUser(`del-${Date.now()}@example.com`, '删除用户');
    const spot = await createSpot(user, spotInput('级联机位'));
    toggleLike(spot.id, user);
    addComment(spot.id, user, '一条评论');
    deleteSpot(spot.id, user);
    expect(db.select().from(schema.likes).where(eq(schema.likes.spotId, spot.id)).all()).toHaveLength(0);
    expect(db.select().from(schema.comments).where(eq(schema.comments.spotId, spot.id)).all()).toHaveLength(0);
  });

  it('hides/removes nothing on invalid spot', () => {
    expect(() => toggleLike('missing-spot', 'nobody')).toThrow();
  });
});

describe('analysis job lifecycle (mock)', () => {
  it('is idempotent for the same image/scene/goals', async () => {
    const user = makeUser(`job-${Date.now()}@example.com`, '分析用户');
    const photoId = randomUUID();
    const contentHash = 'hash-' + randomUUID();
    db.insert(schema.photos)
      .values({
        id: photoId,
        ownerId: user,
        storageKey: 'x/y.jpg',
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        width: 100,
        height: 100,
        bytes: 1000,
        contentHash,
        privacy: 'private',
        isDemo: false,
        createdAt: new Date(),
      })
      .run();

    const params = {
      userId: user,
      photoId,
      contentHash,
      imageBase64: 'AAAA',
      mimeType: 'image/jpeg',
      scene: 'landscape',
      goals: ['improve_color'],
    };
    const first = await runAnalysis(params);
    expect(first.status).toBe('succeeded');
    expect(first.analysis?.schemaVersion).toBe('1');

    const second = await runAnalysis(params);
    expect(second.status).toBe('succeeded');
    expect(second.reused).toBe(true);

    const results = db.select().from(schema.analysisResults).where(eq(schema.analysisResults.photoId, photoId)).all();
    expect(results).toHaveLength(1);
  });

  it('does not silently fall back to mock when live is misconfigured', async () => {
    const user = makeUser(`live-${Date.now()}@example.com`, '真实用户');
    const photoId = randomUUID();
    const contentHash = 'hash-' + randomUUID();
    db.insert(schema.photos)
      .values({
        id: photoId,
        ownerId: user,
        storageKey: 'x/y.jpg',
        originalName: 'a.jpg',
        mimeType: 'image/jpeg',
        width: 100,
        height: 100,
        bytes: 1000,
        contentHash,
        privacy: 'private',
        isDemo: false,
        createdAt: new Date(),
      })
      .run();

    const mutable = env.ai as unknown as { mode: string; baseUrl: string; apiKey: string; visionModel: string };
    const backup = { ...mutable };
    try {
      mutable.mode = 'live';
      mutable.baseUrl = '';
      mutable.apiKey = '';
      mutable.visionModel = '';
      const res = await runAnalysis({
        userId: user,
        photoId,
        contentHash,
        imageBase64: 'AAAA',
        mimeType: 'image/jpeg',
        scene: 'auto',
        goals: [],
        force: true,
      });
      expect(res.status).toBe('failed');
      expect(res.error?.type).toBe('config');
    } finally {
      Object.assign(mutable, backup);
    }
  });
});

describe('live budget ledger', () => {
  it('persists spend across a fresh connection (survives restart)', () => {
    const before = getBudget().used;
    consumeBudget(1);
    const after = getBudget().used;
    expect(after).toBe(before + 1);

    const raw = new Database(resolveDatabasePath(), { readonly: true });
    const row = raw.prepare('SELECT used FROM live_budget WHERE id = ?').get('onlyphoto-dev-run') as
      | { used: number }
      | undefined;
    raw.close();
    expect(row?.used).toBe(after);
  });
});

describe('persistence', () => {
  it('stores spots durably on disk', async () => {
    const user = makeUser(`persist-${Date.now()}@example.com`, '持久化用户');
    const spot = await createSpot(user, spotInput('持久化机位'));
    const raw = new Database(resolveDatabasePath(), { readonly: true });
    const row = raw.prepare('SELECT title FROM spots WHERE id = ?').get(spot.id) as { title: string } | undefined;
    raw.close();
    expect(row?.title).toBe('持久化机位');
  });

  it('orders comments newest first and filters hidden', async () => {
    const user = makeUser(`comments-${Date.now()}@example.com`, '评论用户');
    const spot = await createSpot(user, spotInput('评论机位'));
    addComment(spot.id, user, '第一条');
    addComment(spot.id, user, '第二条');
    const list = listComments(spot.id);
    expect(list).toHaveLength(2);
    expect(list[0]!.body).toBe('第二条');

    db.update(schema.comments).set({ status: 'hidden' }).where(eq(schema.comments.spotId, spot.id)).run();
    expect(listComments(spot.id)).toHaveLength(0);
  });
});