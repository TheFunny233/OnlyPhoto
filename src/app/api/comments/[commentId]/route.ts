import { handleError, jsonOk, requireUser, verifySameOrigin } from '@/lib/http';
import { deleteOwnComment } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, ctx: { params: Promise<{ commentId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { commentId } = await ctx.params;
    deleteOwnComment(commentId, user.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}