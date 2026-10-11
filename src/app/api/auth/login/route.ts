import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, sessionCookie } from '@/lib/auth/session';
import { HttpError, handleError, jsonError, jsonOk, verifySameOrigin, getClientIp } from '@/lib/http';
import { rateLimit } from '@/lib/ratelimit';

const bodySchema = z.object({
  email: z.string().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const ip = getClientIp(request);
    if (!rateLimit(`login:${ip}`, 20, 10 * 60 * 1000)) {
      throw new HttpError(429, 'rate_limited', '登录尝试过于频繁，请稍后再试');
    }
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '请输入邮箱与密码');
    const email = parsed.data.email.trim().toLowerCase();
    const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      throw new HttpError(401, 'invalid_credentials', '邮箱或密码不正确');
    }
    const token = createSession(user.id);
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
    return jsonOk({ user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.code, error.message);
    console.error('[login]', error);
    return handleError(error);
  }
}