import { z } from 'zod';
import { handleError, jsonOk, requireUser, verifySameOrigin, HttpError } from '@/lib/http';
import { createReport } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  targetType: z.enum(['spot', 'comment']),
  targetId: z.string().min(1).max(60),
  reason: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '举报信息不合法');
    return jsonOk(createReport(user.id, parsed.data.targetType, parsed.data.targetId, parsed.data.reason), {
      status: 201,
    });
  } catch (error) {
    return handleError(error);
  }
}