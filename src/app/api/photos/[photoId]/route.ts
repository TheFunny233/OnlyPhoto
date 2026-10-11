import { handleError, jsonOk, requireUser, verifySameOrigin } from '@/lib/http';
import { deletePhoto, getPhotoDetail } from '@/lib/services/photos';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  try {
    const user = await requireUser();
    const { photoId } = await ctx.params;
    return jsonOk(getPhotoDetail(photoId, user.id));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ photoId: string }> }) {
  try {
    verifySameOrigin(request);
    const user = await requireUser();
    const { photoId } = await ctx.params;
    deletePhoto(photoId, user.id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}