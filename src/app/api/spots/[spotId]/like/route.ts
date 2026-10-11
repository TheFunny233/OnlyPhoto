import { handleError, jsonOk, requireUser, verifySameOrigin } from '@/lib/http';
import { toggleLike } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, ctx: { params: Promise<{ spotId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { spotId } = await ctx.params;
    return jsonOk(toggleLike(spotId, user.id));
  } catch (error) {
    return handleError(error);
  }
}