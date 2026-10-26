import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { draftOperationSchema } from '@/server/schemas';
import { getDraftForUser } from '@/server/repositories/app-repository';
import { hashDraftOperation, saveDraftOperation } from '@/server/repositories/draft-repository';

type Context = { params: Promise<{ draftId: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
    const { draftId } = await context.params;
    const draft = await getDraftForUser(user.id, draftId);
    return draft ? ok({ draft }) : fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
    const operationId = request.headers.get('Idempotency-Key');
    if (!operationId || !/^[A-Za-z0-9_-]{8,128}$/.test(operationId)) return fail('MISSING_IDEMPOTENCY_KEY', '缺少有效的操作标识。', 400);
    const parsed = draftOperationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('INVALID_DRAFT_OPERATION', '草稿操作参数不正确。', 400, parsed.error.flatten());
    const { draftId } = await context.params;
    const result = await saveDraftOperation(user.id, draftId, { ...parsed.data, operationId, requestHash: hashDraftOperation(parsed.data) });
    switch (result.status) {
      case 'applied': case 'replayed': return ok({ ack: result.ack });
      case 'conflict': return fail('DRAFT_CONFLICT', '云端有更新的版本，需要处理冲突。', 409, { current: result.current });
      case 'key_reused': return fail('IDEMPOTENCY_KEY_REUSED', '操作标识已用于不同的内容。', 422);
      case 'not_found': return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);
    }
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
