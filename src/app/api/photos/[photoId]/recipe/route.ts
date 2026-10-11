import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db/client';
import { handleError, jsonOk, requireUser, verifySameOrigin, HttpError } from '@/lib/http';
import { getOwnedPhoto } from '@/lib/services/photos';
import { normalizeRecipe } from '@/lib/edit/pixel';

export const dynamic = 'force-dynamic';

const regionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const bodySchema = z.object({
  crop: regionSchema.nullable().optional(),
  exposureEv: z.number().optional(),
  contrast: z.number().optional(),
  saturation: z.number().optional(),
  warmth: z.number().optional(),
});

export async function GET(_request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  try {
    const user = await requireUser();
    const { photoId } = await ctx.params;
    if (!getOwnedPhoto(photoId, user.id)) throw new HttpError(404, 'not_found', '照片不存在');
    const row = db.select().from(schema.editRecipes).where(eq(schema.editRecipes.photoId, photoId)).get();
    return jsonOk({ recipe: row ? JSON.parse(row.recipe) : null });
  } catch (error) {
    return handleError(error);
  }
}

export async function PUT(request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { photoId } = await ctx.params;
    if (!getOwnedPhoto(photoId, user.id)) throw new HttpError(404, 'not_found', '照片不存在或无权访问');
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '编辑参数不合法');
    const recipe = normalizeRecipe(parsed.data);
    const existing = db.select().from(schema.editRecipes).where(eq(schema.editRecipes.photoId, photoId)).get();
    if (existing) {
      db.update(schema.editRecipes)
        .set({ recipe: JSON.stringify(recipe), updatedAt: new Date() })
        .where(eq(schema.editRecipes.photoId, photoId))
        .run();
    } else {
      db.insert(schema.editRecipes)
        .values({
          id: randomUUID(),
          photoId,
          ownerId: user.id,
          recipe: JSON.stringify(recipe),
          updatedAt: new Date(),
        })
        .run();
    }
    return jsonOk({ recipe });
  } catch (error) {
    return handleError(error);
  }
}