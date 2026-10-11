import { handleError, jsonOk, requireUser, verifySameOrigin, getClientIp, HttpError } from '@/lib/http';
import { createPhotoFromUpload, listPhotos } from '@/lib/services/photos';
import { rateLimit } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ photos: listPhotos(user.id) });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    if (!rateLimit(`upload:${user.id}`, 30, 10 * 60 * 1000)) {
      throw new HttpError(429, 'rate_limited', '上传过于频繁，请稍后再试');
    }
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'no_file', '请选择要上传的图片文件');
    }
    const { photo } = await createPhotoFromUpload(user.id, file);
    return jsonOk({ photo: { id: photo.id } }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}