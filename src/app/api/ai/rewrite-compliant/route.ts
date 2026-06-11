import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { rewriteSchema } from '@/server/schemas';
import { getDraftForUser, rewriteDraftForUser } from '@/server/repositories/app-repository';
import { rewriteCompliantDraft } from '@/server/ai/ai-service';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const parsed = rewriteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_REWRITE_INPUT', '缺少草稿 ID。', 400, parsed.error.flatten());
  }

  const draft = await getDraftForUser(user.id, parsed.data.draftId);
  if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);

  const rewritten = await rewriteCompliantDraft(draft);
  const updatedDraft = await rewriteDraftForUser(user.id, parsed.data.draftId, {
    title: rewritten.title,
    body: rewritten.body
  });

  return ok({ draft: updatedDraft, rewritten });
}
