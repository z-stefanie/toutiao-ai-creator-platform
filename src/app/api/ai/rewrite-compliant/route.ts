import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { rewriteSchema } from '@/server/schemas';
import { ownsDraft } from '@/server/repositories/draft-repository';
import { rewriteCompliantDraft } from '@/server/ai/ai-service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
    const parsed = rewriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('INVALID_REWRITE_INPUT', '改写参数不完整。', 400, parsed.error.flatten());
    if (!await ownsDraft(user.id, parsed.data.draftId)) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);
    const rewritten = await rewriteCompliantDraft({ id: parsed.data.draftId, title: parsed.data.title, body: parsed.data.body });
    return ok({ rewritten });
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
