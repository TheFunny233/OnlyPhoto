import { NextResponse } from 'next/server';
import { env, isAiLiveConfigured } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: env.appName,
    demoMode: env.demoMode,
    aiMode: env.ai.mode,
    aiLiveConfigured: isAiLiveConfigured(),
    mapConfigured: Boolean(env.map.tileUrl),
    time: new Date().toISOString(),
  });
}