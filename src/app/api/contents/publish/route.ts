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
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

    const parsed = publishSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('INVALID_PUBLISH_INPUT', '缺少草稿 ID。', 400, parsed.error.flatten());
    }

    const draft = await getDraftForUser(user.id, parsed.data.draftId);
    if (!draft) return fail('DRAFT_NOT_FOUND', '未找到草稿。', 404);

    if (parsed.data.version !== undefined && parsed.data.version !== draft.version) {
      return fail('DRAFT_CHANGED', '草稿在别处被修改，请确认最新内容后再发布', 409, { currentVersion: draft.version });
    }
    if (!draft.title.trim() || !draft.body.trim()) return fail('DRAFT_INCOMPLETE', '标题和正文不能为空', 400);
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
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'DRAFT_CHANGED') {
      return fail('DRAFT_CHANGED', '草稿在别处被修改，请确认最新内容后再发布', 409, { currentVersion: 'currentVersion' in error ? error.currentVersion : undefined });
    }
    return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500);
  }
}
