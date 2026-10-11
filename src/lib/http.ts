import { NextResponse } from 'next/server';
import type { SessionUser } from './auth/session';
import { getCurrentUser } from './auth/session';
import { env } from './env';

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return jsonError(error.status, error.code, error.message);
  }
  const message = error instanceof Error ? error.message : '未知错误';
  console.error('[photomaster] unhandled route error:', message);
  return jsonError(500, 'internal_error', '服务器内部错误');
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'unauthenticated', '请先登录');
  return user;
}

function allowedOrigins(): string[] {
  const list = new Set<string>([env.appUrl]);
  return [...list];
}

export function verifySameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const origin = request.headers.get('origin');
  if (!origin) return; // same-origin fetches without Origin are allowed (e.g. older clients)
  const ok = allowedOrigins().some((allowed) => {
    try {
      return new URL(allowed).origin === new URL(origin).origin;
    } catch {
      return false;
    }
  });
  const host = request.headers.get('host');
  const originHost = (() => {
    try {
      return new URL(origin).host;
    } catch {
      return '';
    }
  })();
  if (!ok && host !== originHost) {
    throw new HttpError(403, 'origin_not_allowed', '请求来源不被允许');
  }
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}