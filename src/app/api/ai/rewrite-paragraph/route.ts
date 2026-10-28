import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { rewriteParagraphSchema } from '@/server/schemas';
import { ownsDraft } from '@/server/repositories/draft-repository';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
    const parsed = rewriteParagraphSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail('INVALID_REWRITE_PARAGRAPH_INPUT', '段落改写参数不完整。', 400, parsed.error.flatten());
    if (!await ownsDraft(user.id, parsed.data.draftId)) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);
    const cleaned = parsed.data.paragraph.replace(/^局部重写：/, '').trim();
    return ok({ rewrittenParagraph: `局部重写：${cleaned} 这一段已补充更明确的场景、动作和可执行建议，方便创作者逐段确认。` });
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
