import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';
import { createSession, sessionCookie } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { HttpError, handleError, jsonError, jsonOk, verifySameOrigin, getClientIp } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const bodySchema = z.object({
  email: z.string().max(200).regex(EMAIL_RE, '邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位').max(200),
  nickname: z.string().min(1, '请填写昵称').max(40),
});

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    if (!env.registrationOpen) {
      throw new HttpError(403, 'registration_closed', '当前未开放注册');
    }
    const ip = getClientIp(request);
    if (!rateLimit(`register:${ip}`, 10, 10 * 60 * 1000)) {
      throw new HttpError(429, 'rate_limited', '注册过于频繁，请稍后再试');
    }
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_input', parsed.error.issues[0]?.message ?? '输入不合法');
    }
    const email = parsed.data.email.trim().toLowerCase();
    const existing = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (existing) {
      throw new HttpError(409, 'email_taken', '该邮箱已注册');
    }
    const id = randomUUID();
    db.insert(schema.users)
      .values({
        id,
        email,
        passwordHash: hashPassword(parsed.data.password),
        nickname: parsed.data.nickname.trim(),
        isDemo: false,
        createdAt: new Date(),
      })
      .run();
    const token = createSession(id);
    const store = await cookies();
    store.set({
      name: sessionCookie.name,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: sessionCookie.options.secure,
      path: '/',
      maxAge: sessionCookie.maxAgeSeconds,
    });
    return jsonOk({ user: { id, email, nickname: parsed.data.nickname.trim() } });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.code, error.message);
    console.error('[register]', error);
    return handleError(error);
  }
}