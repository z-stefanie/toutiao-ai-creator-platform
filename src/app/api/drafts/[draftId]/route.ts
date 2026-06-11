import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { updateDraftSchema } from '@/server/schemas';
import { getDraftForUser, updateDraftForUser } from '@/server/repositories/app-repository';

type Context = { params: Promise<{ draftId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const { draftId } = await context.params;
  const draft = await getDraftForUser(user.id, draftId);
  if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);
  return ok({ draft });
}

export async function PATCH(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const { draftId } = await context.params;
  const draft = await getDraftForUser(user.id, draftId);
  if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);

  const parsed = updateDraftSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_DRAFT', '草稿内容不完整。', 400, parsed.error.flatten());
  }

  try {
    const updatedDraft = await updateDraftForUser(user.id, draftId, parsed.data);
    return ok({ draft: updatedDraft });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'DRAFT_CONFLICT') {
      return fail('DRAFT_CONFLICT', '云端草稿版本更新，请刷新后合并。', 409, {
        serverVersion: 'serverVersion' in error ? error.serverVersion : draft.version
      });
    }
    throw error;
  }
}
