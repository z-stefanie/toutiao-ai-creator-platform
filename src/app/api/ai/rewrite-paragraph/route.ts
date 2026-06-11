import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { rewriteParagraphSchema } from '@/server/schemas';
import { getDraftForUser, updateDraftForUser } from '@/server/repositories/app-repository';

function splitParagraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function rewriteParagraph(paragraph: string) {
  const cleaned = paragraph.replace(/^局部重写：/, '').trim();
  return `局部重写：${cleaned} 这一段已补充更明确的场景、动作和可执行建议，方便创作者逐段确认。`;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const parsed = rewriteParagraphSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_REWRITE_PARAGRAPH_INPUT', '段落改写参数不完整。', 400, parsed.error.flatten());
  }

  const draft = await getDraftForUser(user.id, parsed.data.draftId);
  if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);

  const paragraphs = splitParagraphs(draft.body);
  if (!paragraphs[parsed.data.paragraphIndex]) {
    return fail('PARAGRAPH_NOT_FOUND', '未找到要改写的段落。', 404);
  }

  const rewrittenParagraph = rewriteParagraph(paragraphs[parsed.data.paragraphIndex]);
  paragraphs[parsed.data.paragraphIndex] = rewrittenParagraph;
  const updatedDraft = await updateDraftForUser(user.id, draft.id, {
    title: draft.title,
    summary: draft.summary,
    body: paragraphs.join('\n\n'),
    tags: draft.tags,
    assetIds: draft.assetIds
  });

  return ok({
    draft: updatedDraft,
    rewrittenParagraph
  });
}
