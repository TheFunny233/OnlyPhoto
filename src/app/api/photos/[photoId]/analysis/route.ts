import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { handleError, jsonOk, requireUser, verifySameOrigin, HttpError } from '@/lib/http';
import { getOwnedPhoto } from '@/lib/services/photos';
import { photoAiKey } from '@/lib/services/photos';
import { resolveUploadDir } from '@/lib/db/client';
import { runAnalysis } from '@/lib/ai/analyze';
import { GOAL_OPTIONS, SCENE_OPTIONS } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  scene: z.string().max(30).optional().default('auto'),
  goals: z.array(z.string().max(40)).max(10).optional().default([]),
  force: z.boolean().optional().default(false),
});

export async function POST(request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { photoId } = await ctx.params;
    const photo = getOwnedPhoto(photoId, user.id);
    if (!photo) throw new HttpError(404, 'not_found', '照片不存在或无权访问');

    const json = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json ?? {});
    if (!parsed.success) throw new HttpError(400, 'invalid_input', '分析参数不合法');
    const scene = SCENE_OPTIONS.some((s) => s.value === parsed.data.scene) ? parsed.data.scene : 'auto';
    const goals = parsed.data.goals.filter((g) => GOAL_OPTIONS.some((o) => o.value === g));

    const aiPath = path.join(resolveUploadDir(), photoAiKey(photo.id));
    let imageBase64 = '';
    if (fs.existsSync(aiPath)) {
      imageBase64 = fs.readFileSync(aiPath).toString('base64');
    }
    if (!imageBase64) {
      throw new HttpError(500, 'ai_input_missing', '分析用的图片副本缺失，请重新上传');
    }

    if (parsed.data.force) {
      const recent = db_recent(user.id);
      if (recent >= 3) {
        throw new HttpError(429, 'force_limited', '短时间内强制重分析次数过多，请稍后再试');
      }
    }

    const result = await runAnalysis({
      userId: user.id,
      photoId: photo.id,
      contentHash: photo.contentHash,
      imageBase64,
      mimeType: 'image/jpeg',
      scene,
      goals,
      force: parsed.data.force,
    });

    return jsonOk(result);
  } catch (error) {
    return handleError(error);
  }
}

function db_recent(_userId: string): number {
  return 0;
}