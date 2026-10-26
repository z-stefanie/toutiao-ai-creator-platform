import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { ok, fail } from '@/server/http';
import { getDraftSnapshot } from '@/server/repositories/draft-repository';

export async function GET(_request: NextRequest, context: { params: Promise<{ draftId: string; snapshotId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
    const { draftId, snapshotId } = await context.params;
    const snapshot = await getDraftSnapshot(user.id, draftId, snapshotId);
    return snapshot ? ok({ snapshot }) : fail('DRAFT_NOT_FOUND', '未找到草稿或快照。', 404);
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
