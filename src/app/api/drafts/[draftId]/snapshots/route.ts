import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { ok, fail } from '@/server/http';
import { listDraftSnapshots } from '@/server/repositories/draft-repository';

export async function GET(_request: NextRequest, context: { params: Promise<{ draftId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
    const { draftId } = await context.params;
    const snapshots = await listDraftSnapshots(user.id, draftId);
    return snapshots ? ok({ snapshots }) : fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
