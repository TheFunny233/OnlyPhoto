import { getCurrentUser } from '@/lib/auth/session';
import { handleError, jsonOk } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    return jsonOk({ user });
  } catch (error) {
    return handleError(error);
  }
}