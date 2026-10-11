import { handleError, jsonOk, requireUser } from '@/lib/http';
import { getMeSummary } from '@/lib/services/me';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(getMeSummary(user.id));
  } catch (error) {
    return handleError(error);
  }
}