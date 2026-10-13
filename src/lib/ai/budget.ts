import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { env } from '../env';

/**
 * Persistent ledger for real provider requests made during this development task run.
 * It survives process restarts and never resets automatically.
 */

export const RUN_TASK_ID = 'onlyphoto-dev-run';

function ensureLedger(): { used: number; limit: number } {
  const existing = db.select().from(schema.liveBudget).where(eq(schema.liveBudget.id, RUN_TASK_ID)).get();
  if (existing) return { used: existing.used, limit: existing.limit };
  db.insert(schema.liveBudget)
    .values({
      id: RUN_TASK_ID,
      taskId: RUN_TASK_ID,
      used: 0,
      limit: env.liveTests.maxRequests,
      updatedAt: new Date(),
    })
    .run();
  return { used: 0, limit: env.liveTests.maxRequests };
}

export function getBudget(): { used: number; limit: number; remaining: number } {
  const { used, limit } = ensureLedger();
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export class BudgetExceededError extends Error {
  constructor(public used: number, public limit: number) {
    super(`真实请求预算已用尽（${used}/${limit}）`);
  }
}

export function consumeBudget(count = 1): { used: number; limit: number; remaining: number } {
  const { used, limit } = ensureLedger();
  if (used + count > limit) {
    throw new BudgetExceededError(used, limit);
  }
  db.update(schema.liveBudget)
    .set({ used: used + count, updatedAt: new Date() })
    .where(eq(schema.liveBudget.id, RUN_TASK_ID))
    .run();
  return { used: used + count, limit, remaining: Math.max(0, limit - used - count) };
}