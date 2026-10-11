import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';

export const SESSION_COOKIE = 'pm_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  nickname: string;
  isDemo: boolean;
};

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function createSession(userId: string): string {
  const id = randomToken();
  const now = new Date();
  db.insert(schema.sessions)
    .values({
      id,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    })
    .run();
  return id;
}

export function deleteSession(token: string): void {
  db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
}

function shouldUseSecureCookies(): boolean {
  if (process.env.ALLOW_INSECURE_COOKIES === 'true') return false;
  const appUrl = process.env.APP_URL ?? '';
  return appUrl.startsWith('https://');
}

export const sessionCookie = {
  name: SESSION_COOKIE,
  maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
  options: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: shouldUseSecureCookies(),
    path: '/',
  },
};

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const row = db.select().from(schema.sessions).where(eq(schema.sessions.id, token)).get();
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  const user = db.select().from(schema.users).where(eq(schema.users.id, row.userId)).get();
  if (!user) return null;
  return { id: user.id, email: user.email, nickname: user.nickname, isDemo: user.isDemo };
}