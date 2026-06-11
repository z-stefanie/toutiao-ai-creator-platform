import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { publishSchema } from '@/server/schemas';
import { calculateRankingMetric } from '@/server/ranking/ranking';
import {
  getDraftForUser,
  publishDraftForUser,
  saveAuditResult
} from '@/server/repositories/app-repository';
import { auditDraft, scoreDraftQuality } from '@/server/ai/ai-service';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const parsed = publishSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_PUBLISH_INPUT', '缺少草稿 ID。', 400, parsed.error.flatten());
  }

  const draft = await getDraftForUser(user.id, parsed.data.draftId);
  if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);

  const audit = await auditDraft(draft);
  const savedAudit = await saveAuditResult(audit);

  if (!audit.passed) {
    return ok({
      published: false,
      audit: savedAudit,
      qualityScore: null,
      content: null
    });
  }

  const qualityScore = await scoreDraftQuality(draft);
  const provisionalContent = {
    id: draft.contentId ?? draft.id,
    authorId: user.id,
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    assetIds: draft.assetIds,
    tags: draft.tags,
    status: 'published' as const,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const rankingMetric = calculateRankingMetric(provisionalContent, qualityScore);
  const published = await publishDraftForUser(user.id, draft, savedAudit, qualityScore, rankingMetric);

  return ok({
    published: true,
    audit: published.audit,
    qualityScore: published.qualityScore,
    content: published.content
  });
}
