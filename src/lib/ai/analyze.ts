import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { AI_PROMPT_VERSION, env, isAiLiveConfigured } from '../env';
import { analyzeWithProvider, ProviderError } from './adapter-openai';
import { mockAnalysis } from './mock';
import { parseAnalysis } from './schema';
import type { AnalysisReceipt, PhotoAnalysis } from './types';
import { BudgetExceededError, consumeBudget } from './budget';

export type RunAnalysisParams = {
  userId: string;
  photoId: string;
  contentHash: string;
  imageBase64: string;
  mimeType: string;
  scene: string;
  goals: string[];
  force?: boolean;
};

export type AnalysisResponse = {
  jobId: string;
  status: 'succeeded' | 'processing' | 'failed';
  reused: boolean;
  analysis?: PhotoAnalysis;
  receipt?: AnalysisReceipt;
  error?: { type: string; message: string };
};

const STALE_MS = env.ai.requestTimeoutMs * 2 + 30_000;

export function reapStaleJobs(): void {
  const cutoff = new Date(Date.now() - STALE_MS);
  db.update(schema.analysisJobs)
    .set({
      status: 'failed',
      errorType: 'stale',
      error: '任务在服务重启或超时后中断，可重试',
      finishedAt: new Date(),
    })
    .where(and(eq(schema.analysisJobs.status, 'processing'), lt(schema.analysisJobs.startedAt, cutoff)))
    .run();
}

function computeKey(params: RunAnalysisParams, mode: string, provider: string, model: string): string {
  return createHash('sha256')
    .update(
      [
        params.contentHash,
        params.scene,
        [...params.goals].sort().join(','),
        mode,
        provider,
        model,
        AI_PROMPT_VERSION,
      ].join('|'),
    )
    .digest('hex');
}

function loadResult(jobId: string) {
  const row = db
    .select()
    .from(schema.analysisResults)
    .where(eq(schema.analysisResults.jobId, jobId))
    .get();
  if (!row) return null;
  return {
    analysis: JSON.parse(row.data) as PhotoAnalysis,
    receipt: JSON.parse(row.receipt) as AnalysisReceipt,
  };
}

function liveUsageLast24h(userId: string): number {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = db
    .select()
    .from(schema.apiUsage)
    .where(
      and(
        eq(schema.apiUsage.userId, userId),
        eq(schema.apiUsage.mode, 'live'),
        gte(schema.apiUsage.createdAt, since),
      ),
    )
    .all();
  return rows.length;
}

function recordUsage(entry: {
  userId: string;
  photoId: string;
  mode: 'live' | 'mock';
  provider: string;
  model: string | null;
  status: 'success' | 'error';
  errorType?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): void {
  db.insert(schema.apiUsage)
    .values({
      id: randomUUID(),
      userId: entry.userId,
      photoId: entry.photoId,
      mode: entry.mode,
      provider: entry.provider,
      model: entry.model,
      status: entry.status,
      errorType: entry.errorType ?? null,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
      createdAt: new Date(),
    })
    .run();
}

export async function runAnalysis(params: RunAnalysisParams): Promise<AnalysisResponse> {
  reapStaleJobs();

  const mode = env.ai.mode;
  if (mode === 'live' && !isAiLiveConfigured()) {
    return {
      jobId: '',
      status: 'failed',
      reused: false,
      error: {
        type: 'config',
        message: 'live 模式未正确配置 AI_BASE_URL / AI_API_KEY / AI_VISION_MODEL，请检查服务端配置。',
      },
    };
  }

  let provider = 'mock';
  try {
    provider = mode === 'live' ? new URL(env.ai.baseUrl).host : 'mock';
  } catch {
    provider = 'mock';
  }
  const model = mode === 'live' ? env.ai.visionModel : 'mock';
  const idempotencyKey = computeKey(params, mode, provider, model);

  const existing = db
    .select()
    .from(schema.analysisJobs)
    .where(eq(schema.analysisJobs.idempotencyKey, idempotencyKey))
    .get();

  if (existing && !params.force) {
    if (existing.status === 'succeeded') {
      const loaded = loadResult(existing.id);
      if (loaded) {
        return { jobId: existing.id, status: 'succeeded', reused: true, ...loaded };
      }
    }
    if (existing.status === 'processing' && existing.startedAt && Date.now() - existing.startedAt.getTime() < STALE_MS) {
      return { jobId: existing.id, status: 'processing', reused: true };
    }
  }

  const now = new Date();
  const jobId = existing?.id ?? randomUUID();
  if (existing) {
    db.update(schema.analysisJobs)
      .set({
        status: 'processing',
        error: null,
        errorType: null,
        attempts: existing.attempts + 1,
        startedAt: now,
        finishedAt: null,
        mode,
        provider,
        model,
      })
      .where(eq(schema.analysisJobs.id, jobId))
      .run();
  } else {
    db.insert(schema.analysisJobs)
      .values({
        id: jobId,
        photoId: params.photoId,
        ownerId: params.userId,
        status: 'processing',
        idempotencyKey,
        mode,
        provider,
        model,
        promptVersion: AI_PROMPT_VERSION,
        scene: params.scene,
        goals: JSON.stringify(params.goals),
        attempts: 1,
        createdAt: now,
        startedAt: now,
      })
      .run();
  }

  // Budget and per-user limits only apply to real provider calls.
  if (mode === 'live') {
    if (liveUsageLast24h(params.userId) >= env.ai.userDailyRequestLimit) {
      const message = `今日真实分析次数已达上限（${env.ai.userDailyRequestLimit} 次）`;
      db.update(schema.analysisJobs)
        .set({ status: 'failed', errorType: 'rate_limit', error: message, finishedAt: new Date() })
        .where(eq(schema.analysisJobs.id, jobId))
        .run();
      return { jobId, status: 'failed', reused: false, error: { type: 'rate_limit', message } };
    }
    try {
      consumeBudget(1);
    } catch (error) {
      const message =
        error instanceof BudgetExceededError ? error.message : '真实请求预算检查失败';
      db.update(schema.analysisJobs)
        .set({ status: 'failed', errorType: 'budget', error: message, finishedAt: new Date() })
        .where(eq(schema.analysisJobs.id, jobId))
        .run();
      return { jobId, status: 'failed', reused: false, error: { type: 'budget', message } };
    }
  }

  const adapterInput = {
    imageBase64: params.imageBase64,
    mimeType: params.mimeType,
    scene: params.scene,
    goals: params.goals,
  };

  try {
    const providerResult =
      mode === 'live' ? await analyzeWithProvider(adapterInput) : mockAnalysis(adapterInput, params.contentHash);

    const parsed = parseAnalysis(providerResult.raw);
    if (!parsed.ok) {
      const message = `模型输出未通过校验：${parsed.errors.slice(0, 3).join('; ')}`;
      recordUsage({
        userId: params.userId,
        photoId: params.photoId,
        mode,
        provider,
        model,
        status: 'error',
        errorType: 'schema',
        inputTokens: providerResult.inputTokens,
        outputTokens: providerResult.outputTokens,
      });
      db.update(schema.analysisJobs)
        .set({ status: 'failed', errorType: 'schema', error: message, finishedAt: new Date() })
        .where(eq(schema.analysisJobs.id, jobId))
        .run();
      return { jobId, status: 'failed', reused: false, error: { type: 'schema', message } };
    }

    const receipt: AnalysisReceipt = {
      mode,
      provider,
      model: mode === 'live' ? env.ai.visionModel : 'mock',
      promptVersion: AI_PROMPT_VERSION,
      providerRequestId: providerResult.providerRequestId,
      inputTokens: providerResult.inputTokens,
      outputTokens: providerResult.outputTokens,
      imageHash: params.contentHash,
      generatedAt: new Date().toISOString(),
    };

    const resultId = randomUUID();
    db.insert(schema.analysisResults)
      .values({
        id: resultId,
        jobId,
        photoId: params.photoId,
        ownerId: params.userId,
        data: JSON.stringify(parsed.value),
        receipt: JSON.stringify(receipt),
        createdAt: new Date(),
      })
      .run();

    db.update(schema.analysisJobs)
      .set({ status: 'succeeded', finishedAt: new Date(), error: null, errorType: null })
      .where(eq(schema.analysisJobs.id, jobId))
      .run();

    recordUsage({
      userId: params.userId,
      photoId: params.photoId,
      mode,
      provider,
      model,
      status: 'success',
      inputTokens: providerResult.inputTokens,
      outputTokens: providerResult.outputTokens,
    });

    return { jobId, status: 'succeeded', reused: false, analysis: parsed.value, receipt };
  } catch (error) {
    const providerError = error as ProviderError;
    const errorType = providerError?.kind ?? 'unknown';
    const message = providerError?.message ?? '分析失败';
    recordUsage({
      userId: params.userId,
      photoId: params.photoId,
      mode,
      provider,
      model,
      status: 'error',
      errorType,
    });
    db.update(schema.analysisJobs)
      .set({ status: 'failed', errorType, error: message, finishedAt: new Date() })
      .where(eq(schema.analysisJobs.id, jobId))
      .run();
    return { jobId, status: 'failed', reused: false, error: { type: errorType, message } };
  }
}

export function getLatestSucceededAnalysis(photoId: string): {
  jobId: string;
  analysis: PhotoAnalysis;
  receipt: AnalysisReceipt;
} | null {
  const job = db
    .select()
    .from(schema.analysisJobs)
    .where(and(eq(schema.analysisJobs.photoId, photoId), eq(schema.analysisJobs.status, 'succeeded')))
    .orderBy(desc(schema.analysisJobs.finishedAt))
    .get();
  if (!job) return null;
  const loaded = loadResult(job.id);
  if (!loaded) return null;
  return { jobId: job.id, ...loaded };
}

export function getJobStatus(jobId: string): { status: string; error: string | null } | null {
  const job = db.select().from(schema.analysisJobs).where(eq(schema.analysisJobs.id, jobId)).get();
  if (!job) return null;
  return { status: job.status, error: job.error ?? null };
}