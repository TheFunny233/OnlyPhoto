import { z } from 'zod';
import { handleError, jsonOk, requireUser, verifySameOrigin, HttpError } from '@/lib/http';
import { getCurrentUser } from '@/lib/auth/session';
import { createSpot, listCities, listSpots } from '@/lib/services/spots';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title: z.string().min(1).max(80),
  city: z.string().min(1).max(60),
  area: z.string().max(120).optional().default(''),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  coordSystem: z.string().max(20).optional().default('WGS84'),
  precision: z.enum(['exact', 'approximate']),
  subjects: z.array(z.string().max(30)).max(10).optional().default([]),
  description: z.string().max(2000).optional().default(''),
  howToStand: z.string().max(2000).optional().default(''),
  direction: z.string().max(120).optional().default(''),
  bestLight: z.string().max(500).optional().default(''),
  lightSource: z.enum(['author_experience', 'external', 'unconfirmed']).optional().default('unconfirmed'),
  gear: z.string().max(300).optional().default(''),
  safety: z.string().max(500).optional().default(''),
  status: z.enum(['draft', 'published']).optional().default('published'),
  photoId: z.string().max(60).nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const user = await getCurrentUser();
    const onlyFavorites = url.searchParams.get('favorites') === '1';
    const spots = listSpots({
      city: url.searchParams.get('city') ?? undefined,
      subject: url.searchParams.get('subject') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      viewerId: user?.id ?? null,
      favoritesOf: onlyFavorites ? (user?.id ?? null) : null,
      limit: Number(url.searchParams.get('limit') ?? 200),
    });
    return jsonOk({ spots, cities: listCities() });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, 'invalid_input', parsed.error.issues[0]?.message ?? '机位信息不合法');
    }
    const spot = await createSpot(user.id, parsed.data);
    return jsonOk({ spot }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}