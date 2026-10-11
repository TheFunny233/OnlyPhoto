import '../src/lib/loadEnv';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/db/client';
import { runMigrations } from '../src/lib/db/migrate';
import { ingestImage } from '../src/lib/images/ingest';
import { runAnalysis } from '../src/lib/ai/analyze';
import { getBudget } from '../src/lib/ai/budget';
import { env, isAiLiveConfigured } from '../src/lib/env';
import { hashPassword } from '../src/lib/auth/password';

runMigrations();

const OUT = path.join(process.cwd(), 'artifacts', 'test-results', 'live-ai.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

async function main() {
  if (!env.liveTests.run) {
    const report = { status: 'SKIPPED', reason: 'RUN_LIVE_AI_TESTS=false，未授权真实测试' };
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log('[test-live] SKIPPED — 未授权真实测试（RUN_LIVE_AI_TESTS=false）。');
    return;
  }
  if (!isAiLiveConfigured()) {
    const report = { status: 'SKIPPED', reason: '真实模式配置不完整（缺少 Base URL / Key / 模型）' };
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log('[test-live] SKIPPED — 配置不完整。');
    return;
  }

  const email = 'live.test@photomaster.local';
  let user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user) {
    const id = randomUUID();
    db.insert(schema.users)
      .values({
        id,
        email,
        nickname: '真实测试用户',
        passwordHash: hashPassword('live-test-not-for-login-' + randomUUID()),
        isDemo: true,
        createdAt: new Date(),
      })
      .run();
    user = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;
  }

  const samples: { file: string; scene: string }[] = [
    { file: 'city-skyline.jpg', scene: 'architecture' },
    { file: 'mountain-mist.jpg', scene: 'landscape' },
    { file: 'night-market.jpg', scene: 'food' },
  ];

  const results: unknown[] = [];
  for (const sample of samples) {
    const src = path.join(process.cwd(), 'public', 'demo', sample.file);
    if (!fs.existsSync(src)) {
      results.push({ file: sample.file, status: 'skipped', reason: '缺少示例图片' });
      continue;
    }
    const photoId = randomUUID();
    const buffer = fs.readFileSync(src);
    const ingested = await ingestImage({ ownerId: user.id, photoId, originalName: sample.file, buffer });
    db.insert(schema.photos)
      .values({
        id: photoId,
        ownerId: user.id,
        storageKey: ingested.storageKey,
        originalName: sample.file,
        mimeType: ingested.mimeType,
        width: ingested.width,
        height: ingested.height,
        bytes: ingested.bytes,
        contentHash: ingested.contentHash,
        privacy: 'private',
        isDemo: true,
        createdAt: new Date(),
      })
      .run();

    const started = Date.now();
    const res = await runAnalysis({
      userId: user.id,
      photoId,
      contentHash: ingested.contentHash,
      imageBase64: ingested.aiInputBase64,
      mimeType: ingested.aiInputMimeType,
      scene: sample.scene,
      goals: ['highlight_subject'],
      force: true,
    });
    const latencyMs = Date.now() - started;

    results.push({
      file: sample.file,
      scene: sample.scene,
      status: res.status,
      latencyMs,
      reused: res.reused,
      error: res.error ?? null,
      summary: res.analysis?.summary ?? null,
      counts: res.analysis
        ? {
            strengths: res.analysis.strengths.length,
            improvements: res.analysis.improvements.length,
            reshoot: res.analysis.reshootSuggestions.length,
            editing: res.analysis.editingSuggestions.length,
            uncertainties: res.analysis.uncertainties.length,
          }
        : null,
      receipt: res.receipt ?? null,
      budget: getBudget(),
    });
    console.log(`[test-live] ${sample.file} -> ${res.status} in ${latencyMs}ms`);
  }

  const report = {
    status: results.some((r) => (r as { status: string }).status === 'succeeded') ? 'COMPLETED' : 'FAILED',
    provider: (() => {
      try {
        return new URL(env.ai.baseUrl).host;
      } catch {
        return env.ai.baseUrl;
      }
    })(),
    model: env.ai.visionModel,
    budget: getBudget(),
    generatedAt: new Date().toISOString(),
    results,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('[test-live] 完成，预算：', JSON.stringify(getBudget()));
}

main().catch((error) => {
  console.error('[test-live] 运行失败：', (error as Error).message);
  fs.writeFileSync(OUT, JSON.stringify({ status: 'ERROR', message: (error as Error).message }, null, 2));
  process.exit(1);
});