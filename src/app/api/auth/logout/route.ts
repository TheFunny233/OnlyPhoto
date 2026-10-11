import { cookies } from 'next/headers';
import { deleteSession, getSessionToken, sessionCookie } from '@/lib/auth/session';
import { handleError, jsonOk, verifySameOrigin } from '@/lib/http';

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const token = await getSessionToken();
    if (token) deleteSession(token);
    const store = await cookies();
    store.set({ name: sessionCookie.name, value: '', httpOnly: true, sameSite: 'lax', secure: sessionCookie.options.secure, path: '/', maxAge: 0 });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}