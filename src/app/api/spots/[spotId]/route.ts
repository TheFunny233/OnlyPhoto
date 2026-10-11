import { z } from 'zod';
import { handleError, jsonOk, requireUser, verifySameOrigin, HttpError } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { deleteSpot, getSpot, updateSpot } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  city: z.string().min(1).max(60).optional(),
  area: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  precision: z.enum(['exact', 'approximate']).optional(),
  subjects: z.array(z.string().max(30)).max(10).optional(),
  description: z.string().max(2000).optional(),
  howToStand: z.string().max(2000).optional(),
  direction: z.string().max(120).optional(),
  bestLight: z.string().max(500).optional(),
  lightSource: z.enum(['author_experience', 'external', 'unconfirmed']).optional(),
  gear: z.string().max(300).optional(),
  safety: z.string().max(500).optional(),
  status: z.enum(['draft', 'published', 'hidden']).optional(),
});

export async function GET(_request: Request, ctx: { params: Promise<{ spotId: string }> }) {
  try {
    const user = await getCurrentUser();
    const { spotId } = await ctx.params;
    return jsonOk({ spot: getSpot(spotId, user?.id ?? null) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ spotId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { spotId } = await ctx.params;
    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '机位信息不合法');
    return jsonOk({ spot: updateSpot(spotId, user.id, parsed.data) });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ spotId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { spotId } = await ctx.params;
    deleteSpot(spotId, user.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}