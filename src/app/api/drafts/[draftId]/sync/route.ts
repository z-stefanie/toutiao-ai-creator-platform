import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { syncDraftSchema } from '@/server/schemas';
import { updateDraftForUser } from '@/server/repositories/app-repository';

type Context = { params: Promise<{ draftId: string }> };

export async function POST(request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const parsed = syncDraftSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_SYNC', '离线同步数据不完整。', 400, parsed.error.flatten());
  }

  const { draftId } = await context.params;
  const draft = await updateDraftForUser(user.id, draftId, parsed.data.changes);
  if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);

  return ok({ draft, syncedAt: draft.lastSavedAt });
}
