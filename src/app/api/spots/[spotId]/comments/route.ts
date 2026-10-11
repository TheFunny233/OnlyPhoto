import { z } from 'zod';
import { handleError, jsonOk, requireUser, verifySameOrigin, HttpError } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { addComment, getSpot, listComments } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ body: z.string().min(1).max(600) });

export async function GET(_request: Request, ctx: { params: Promise<{ spotId: string }> }) {
  try {
    const { spotId } = await ctx.params;
    const user = await getCurrentUser();
    getSpot(spotId, user?.id ?? null);
    return jsonOk({ comments: listComments(spotId) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ spotId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { spotId } = await ctx.params;
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '评论内容不合法');
    return jsonOk({ comment: addComment(spotId, user.id, parsed.data.body) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}