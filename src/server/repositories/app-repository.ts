import type {
  Asset,
  AiCallLog,
  AiCallType,
  AuditCategory,
  AuditResult,
  Content,
  Draft,
  FeedItem,
  FeedType,
  Prompt,
  QualityScore,
  RankingMetric,
  User
} from '@/lib/types';
import {
  calculateFeedbackScore,
  calculateWeightedRankingScore,
  getRankingConfig
} from '@/lib/ranking-config';
import { prisma } from '@/server/db/prisma';
import { createId } from '@/server/utils/id';
import type {
  Asset as PrismaAsset,
  AiCallLog as PrismaAiCallLog,
  AuditResult as PrismaAuditResult,
  Content as PrismaContent,
  Draft as PrismaDraft,
  Prompt as PrismaPrompt,
  QualityScore as PrismaQualityScore,
  RankingMetric as PrismaRankingMetric,
  User as PrismaUser
} from '@prisma/client';

type DraftInput = Pick<Draft, 'title' | 'summary' | 'body' | 'assetIds' | 'tags'> & {
  version?: number;
};

function toIso(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : undefined;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapUser(user: PrismaUser): User {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? undefined,
    nickname: user.nickname,
    role: user.role as User['role'],
    createdAt: user.createdAt.toISOString()
  };
}

function mapPrompt(prompt: PrismaPrompt): Prompt {
  return {
    id: prompt.id,
    ownerId: prompt.ownerId,
    name: prompt.name,
    description: prompt.description,
    template: prompt.template,
    category: prompt.category as Prompt['category'],
    status: prompt.status as Prompt['status'],
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString()
  };
}

function mapAsset(asset: PrismaAsset): Asset {
  return {
    id: asset.id,
    ownerId: asset.ownerId,
    type: asset.type as Asset['type'],
    url: asset.url,
    filename: asset.filename,
    mimeType: asset.mimeType,
    size: asset.size,
    complianceStatus: asset.complianceStatus as Asset['complianceStatus'],
    complianceReason: asset.complianceReason ?? undefined,
    createdAt: asset.createdAt.toISOString()
  };
}

function mapDraft(draft: PrismaDraft): Draft {
  return {
    id: draft.id,
    ownerId: draft.ownerId,
    contentId: draft.contentId ?? undefined,
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    assetIds: parseJson<string[]>(draft.assetIdsJson, []),
    tags: parseJson<string[]>(draft.tagsJson, []),
    version: draft.version,
    syncStatus: draft.syncStatus as Draft['syncStatus'],
    lastSavedAt: draft.lastSavedAt.toISOString(),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString()
  };
}

function mapContent(content: PrismaContent): Content {
  return {
    id: content.id,
    authorId: content.authorId,
    title: content.title,
    summary: content.summary,
    body: content.body,
    coverUrl: content.coverUrl ?? undefined,
    assetIds: parseJson<string[]>(content.assetIdsJson, []),
    tags: parseJson<string[]>(content.tagsJson, []),
    status: content.status as Content['status'],
    auditResultId: content.auditResultId ?? undefined,
    qualityScoreId: content.qualityScoreId ?? undefined,
    publishedAt: toIso(content.publishedAt),
    createdAt: content.createdAt.toISOString(),
    updatedAt: content.updatedAt.toISOString()
  };
}

function mapAuditResult(result: PrismaAuditResult): AuditResult {
  return {
    id: result.id,
    contentId: result.contentId ?? undefined,
    draftId: result.draftId ?? undefined,
    passed: result.passed,
    riskLevel: result.riskLevel as AuditResult['riskLevel'],
    categories: parseJson<AuditCategory[]>(result.categoriesJson, []),
    hitSpans: parseJson<AuditResult['hitSpans']>(result.hitSpansJson, []),
    action: result.action as AuditResult['action'],
    suggestion: result.suggestion,
    modelName: result.modelName,
    createdAt: result.createdAt.toISOString()
  };
}

function mapQualityScore(score: PrismaQualityScore): QualityScore {
  return {
    id: score.id,
    contentId: score.contentId ?? undefined,
    draftId: score.draftId ?? undefined,
    total: score.total,
    dimensions: parseJson<QualityScore['dimensions']>(score.dimensionsJson, {
      originality: 0,
      structure: 0,
      readability: 0,
      informationDensity: 0,
      titleAttraction: 0,
      imageTextMatch: 0
    }),
    reasons: parseJson<string[]>(score.reasonsJson, []),
    modelName: score.modelName,
    createdAt: score.createdAt.toISOString()
  };
}

function mapRankingMetric(metric: PrismaRankingMetric): RankingMetric {
  const feedbackScore = calculateFeedbackScore(metric);
  return {
    contentId: metric.contentId,
    qualityScore: metric.qualityScore,
    viewCount: metric.viewCount,
    likeCount: metric.likeCount,
    commentCount: metric.commentCount,
    shareCount: metric.shareCount,
    heatScore: metric.heatScore,
    freshnessScore: metric.freshnessScore,
    feedbackScore,
    rankingScore: metric.rankingScore,
    calculatedAt: metric.calculatedAt.toISOString()
  };
}

function withActiveRankingScore(metric: RankingMetric | undefined, type: FeedType) {
  if (!metric) return undefined;
  return {
    ...metric,
    activeRankingScore: calculateWeightedRankingScore(metric, getRankingConfig(type))
  };
}

function mapAiCallLog(log: PrismaAiCallLog): AiCallLog {
  return {
    id: log.id,
    callType: log.callType as AiCallType,
    provider: log.provider,
    model: log.model,
    durationMs: log.durationMs,
    inputSummary: log.inputSummary,
    outputSummary: log.outputSummary,
    schemaValid: log.schemaValid,
    errorMessage: log.errorMessage ?? undefined,
    createdAt: log.createdAt.toISOString()
  };
}

async function ensureSeedData() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const createdAt = new Date();
  const userId = 'user_demo_creator';

  await prisma.user.create({
    data: {
      id: userId,
      email: 'demo@toutiao.ai',
      nickname: '训练营创作者',
      role: 'creator',
      createdAt
    }
  });
  await prisma.prompt.create({
    data: {
      id: 'prompt_short_post',
      ownerId: userId,
      name: '热点短图文创作',
      description: '把素材和观点整理成适合信息流消费的短图文。',
      template: '请围绕主题生成今日头条风格短图文：标题清晰、正文分段、信息密度高，结尾给出可执行建议。',
      category: 'short_post',
      status: 'active',
      createdAt,
      updatedAt: createdAt
    }
  });
  await prisma.asset.createMany({
    data: [
      {
        id: 'asset_city',
        ownerId: userId,
        type: 'image',
        url: '/demo-assets/city-workspace.svg',
        filename: 'city-workspace.svg',
        mimeType: 'image/svg+xml',
        size: 1200,
        complianceStatus: 'passed',
        createdAt
      },
      {
        id: 'asset_chart',
        ownerId: userId,
        type: 'image',
        url: '/demo-assets/content-chart.svg',
        filename: 'content-chart.svg',
        mimeType: 'image/svg+xml',
        size: 1400,
        complianceStatus: 'passed',
        createdAt
      }
    ]
  });

  const seedContents = [
    {
      id: 'content_seed_1',
      title: 'AI 进入创作工作台后，创作者真正省下的是什么',
      summary: '从选题、素材归纳到发布前审核，AI 更像一个稳定的副驾驶。',
      body:
        'AI 创作工具的价值不只是更快地产出文字，而是把创作者从重复整理、格式调整、风险自查中解放出来。\n\n一个完整的创作工作台应该把灵感、素材、草稿、审核和分发放在同一条链路中。创作者保留判断权，AI 负责提供候选、检查风险并给出修改建议。\n\n当质量评分进入分发环节，内容生产就不再停留在发布按钮之前，而会形成持续优化的闭环。',
      coverUrl: '/demo-assets/city-workspace.svg',
      assetIds: ['asset_city'],
      tags: ['AI创作', '人机协同', '内容生产'],
      auditResultId: 'audit_seed_1',
      qualityScoreId: 'quality_seed_1',
      qualityScore: 88,
      heatScore: 82,
      rankingScore: 86.3
    },
    {
      id: 'content_seed_2',
      title: '爆文榜单不该只看热度，还要看内容质量',
      summary: '质量分、阅读热度和发布时间结合，才能避免榜单被单一指标绑架。',
      body:
        '单纯按照阅读量排序，会让早发布内容和标题党天然占优。更合理的方式是把质量分、热度和新鲜度组合起来。\n\n质量分来自结构、可读性、信息密度和图文匹配度等维度；热度来自阅读、点赞、评论、分享；新鲜度则控制内容生命周期。\n\n这种排序方式最大的好处是可解释，创作者也能知道自己应该优化哪里。',
      coverUrl: '/demo-assets/content-chart.svg',
      assetIds: ['asset_chart'],
      tags: ['榜单排序', '内容质量', '推荐系统'],
      auditResultId: 'audit_seed_2',
      qualityScoreId: 'quality_seed_2',
      qualityScore: 84,
      heatScore: 74,
      rankingScore: 81.3
    }
  ];

  for (const content of seedContents) {
    await prisma.content.create({
      data: {
        id: content.id,
        authorId: userId,
        title: content.title,
        summary: content.summary,
        body: content.body,
        coverUrl: content.coverUrl,
        assetIdsJson: JSON.stringify(content.assetIds),
        tagsJson: JSON.stringify(content.tags),
        status: 'published',
        auditResultId: content.auditResultId,
        qualityScoreId: content.qualityScoreId,
        publishedAt: createdAt,
        createdAt,
        updatedAt: createdAt
      }
    });
    await prisma.auditResult.create({
      data: {
        id: content.auditResultId,
        contentId: content.id,
        passed: true,
        riskLevel: 'none',
        categoriesJson: JSON.stringify([]),
        hitSpansJson: JSON.stringify([]),
        action: 'allow',
        suggestion: '内容合规，可发布。',
        modelName: 'mock-audit-v1',
        createdAt
      }
    });
    await prisma.qualityScore.create({
      data: {
        id: content.qualityScoreId,
        contentId: content.id,
        total: content.qualityScore,
        dimensionsJson: JSON.stringify({
          originality: content.qualityScore,
          structure: content.qualityScore,
          readability: content.qualityScore,
          informationDensity: content.qualityScore,
          titleAttraction: content.qualityScore,
          imageTextMatch: content.qualityScore
        }),
        reasonsJson: JSON.stringify(['结构完整', '适合信息流阅读', '具备榜单排序信号']),
        modelName: 'mock-quality-v1',
        createdAt
      }
    });
    await prisma.rankingMetric.create({
      data: {
        contentId: content.id,
        qualityScore: content.qualityScore,
        viewCount: content.heatScore * 30,
        likeCount: content.heatScore * 2,
        commentCount: 30,
        shareCount: 30,
        heatScore: content.heatScore,
        freshnessScore: 90,
        rankingScore: content.rankingScore,
        calculatedAt: createdAt
      }
    });
  }
}

export async function getCurrentUserBySession(token?: string): Promise<User | null> {
  if (!token) return null;
  await ensureSeedData();
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true }
  });
  return session?.user ? mapUser(session.user) : null;
}

export async function createSession(userId: string) {
  const token = createId('session');
  await prisma.session.create({
    data: {
      token,
      userId
    }
  });
  return token;
}

export async function getOrCreateUser(email: string, nickname?: string): Promise<User> {
  await ensureSeedData();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return mapUser(existing);

  const user = await prisma.user.create({
    data: {
      id: createId('user'),
      email,
      nickname: nickname || email.split('@')[0] || '新创作者',
      role: 'creator'
    }
  });
  return mapUser(user);
}

export async function listPromptsForUser(userId: string): Promise<Prompt[]> {
  await ensureSeedData();
  const prompts = await prisma.prompt.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' }
  });
  return prompts.map(mapPrompt);
}

export async function createPromptForUser(
  userId: string,
  input: Pick<Prompt, 'name' | 'description' | 'template' | 'category'>
): Promise<Prompt> {
  const prompt = await prisma.prompt.create({
    data: {
      id: createId('prompt'),
      ownerId: userId,
      name: input.name,
      description: input.description,
      template: input.template,
      category: input.category,
      status: 'active'
    }
  });
  return mapPrompt(prompt);
}

export async function findPromptForUser(userId: string, promptId?: string): Promise<Prompt | null> {
  await ensureSeedData();
  const prompt = promptId
    ? await prisma.prompt.findFirst({ where: { id: promptId, ownerId: userId } })
    : await prisma.prompt.findFirst({ where: { ownerId: userId }, orderBy: { updatedAt: 'desc' } });
  return prompt ? mapPrompt(prompt) : null;
}

export async function listAssetsForUser(userId: string): Promise<Asset[]> {
  await ensureSeedData();
  const assets = await prisma.asset.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' }
  });
  return assets.map(mapAsset);
}

export async function findAssetsByIds(assetIds: string[]): Promise<Asset[]> {
  if (assetIds.length === 0) return [];
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } }
  });
  return assets.map(mapAsset);
}

export async function latestDraftForUser(userId: string): Promise<Draft | null> {
  const draft = await prisma.draft.findFirst({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' }
  });
  return draft ? mapDraft(draft) : null;
}

export async function createDraftForUser(userId: string, input: DraftInput): Promise<Draft> {
  const now = new Date();
  const draft = await prisma.draft.create({
    data: {
      id: createId('draft'),
      ownerId: userId,
      title: input.title,
      summary: input.summary,
      body: input.body,
      assetIdsJson: JSON.stringify(input.assetIds),
      tagsJson: JSON.stringify(input.tags),
      version: 1,
      syncStatus: 'synced',
      lastSavedAt: now
    }
  });
  return mapDraft(draft);
}

export async function getDraftForUser(userId: string, draftId: string): Promise<Draft | null> {
  const draft = await prisma.draft.findFirst({
    where: { id: draftId, ownerId: userId }
  });
  return draft ? mapDraft(draft) : null;
}

export async function updateDraftForUser(userId: string, draftId: string, input: DraftInput): Promise<Draft | null> {
  const existing = await prisma.draft.findFirst({
    where: { id: draftId, ownerId: userId }
  });
  if (!existing) return null;

  if (input.version !== undefined && input.version < existing.version) {
    throw Object.assign(new Error('DRAFT_CONFLICT'), {
      code: 'DRAFT_CONFLICT',
      serverVersion: existing.version
    });
  }

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      title: input.title,
      summary: input.summary,
      body: input.body,
      assetIdsJson: JSON.stringify(input.assetIds),
      tagsJson: JSON.stringify(input.tags),
      version: existing.version + 1,
      syncStatus: 'synced',
      lastSavedAt: new Date()
    }
  });
  return mapDraft(updated);
}

export async function rewriteDraftForUser(userId: string, draftId: string, input: Pick<Draft, 'title' | 'body'>) {
  const existing = await prisma.draft.findFirst({
    where: { id: draftId, ownerId: userId }
  });
  if (!existing) return null;
  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      title: input.title,
      body: input.body,
      version: existing.version + 1,
      lastSavedAt: new Date()
    }
  });
  return mapDraft(updated);
}

export async function saveAuditResult(result: AuditResult): Promise<AuditResult> {
  const saved = await prisma.auditResult.create({
    data: {
      id: result.id,
      contentId: result.contentId,
      draftId: result.draftId,
      passed: result.passed,
      riskLevel: result.riskLevel,
      categoriesJson: JSON.stringify(result.categories),
      hitSpansJson: JSON.stringify(result.hitSpans),
      action: result.action,
      suggestion: result.suggestion,
      modelName: result.modelName,
      createdAt: new Date(result.createdAt)
    }
  });
  return mapAuditResult(saved);
}

export async function publishDraftForUser(
  userId: string,
  draft: Draft,
  audit: AuditResult,
  qualityScore: QualityScore,
  rankingMetric: RankingMetric
): Promise<{ content: Content; audit: AuditResult; qualityScore: QualityScore; rankingMetric: RankingMetric }> {
  const assets = await findAssetsByIds(draft.assetIds);
  const coverUrl = assets[0]?.url;
  const now = new Date();
  const contentId = draft.contentId ?? createId('content');

  const result = await prisma.$transaction(async (tx) => {
    const savedAudit = await tx.auditResult.update({
      where: { id: audit.id },
      data: {
        contentId,
        draftId: draft.id
      }
    });
    const savedQuality = await tx.qualityScore.create({
      data: {
        id: qualityScore.id,
        contentId,
        draftId: draft.id,
        total: qualityScore.total,
        dimensionsJson: JSON.stringify(qualityScore.dimensions),
        reasonsJson: JSON.stringify(qualityScore.reasons),
        modelName: qualityScore.modelName,
        createdAt: new Date(qualityScore.createdAt)
      }
    });
    await tx.content.deleteMany({ where: { id: contentId } });
    const content = await tx.content.create({
      data: {
        id: contentId,
        authorId: userId,
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        coverUrl,
        assetIdsJson: JSON.stringify(draft.assetIds),
        tagsJson: JSON.stringify(draft.tags),
        status: 'published',
        auditResultId: savedAudit.id,
        qualityScoreId: savedQuality.id,
        publishedAt: now
      }
    });
    await tx.rankingMetric.upsert({
      where: { contentId },
      update: {
        qualityScore: rankingMetric.qualityScore,
        viewCount: rankingMetric.viewCount,
        likeCount: rankingMetric.likeCount,
        commentCount: rankingMetric.commentCount,
        shareCount: rankingMetric.shareCount,
        heatScore: rankingMetric.heatScore,
        freshnessScore: rankingMetric.freshnessScore,
        rankingScore: rankingMetric.rankingScore,
        calculatedAt: new Date(rankingMetric.calculatedAt)
      },
      create: {
        contentId,
        qualityScore: rankingMetric.qualityScore,
        viewCount: rankingMetric.viewCount,
        likeCount: rankingMetric.likeCount,
        commentCount: rankingMetric.commentCount,
        shareCount: rankingMetric.shareCount,
        heatScore: rankingMetric.heatScore,
        freshnessScore: rankingMetric.freshnessScore,
        rankingScore: rankingMetric.rankingScore,
        calculatedAt: new Date(rankingMetric.calculatedAt)
      }
    });
    await tx.draft.update({
      where: { id: draft.id },
      data: { contentId }
    });
    const savedMetric = await tx.rankingMetric.findUniqueOrThrow({ where: { contentId } });
    return { content, savedAudit, savedQuality, savedMetric };
  });

  return {
    content: mapContent(result.content),
    audit: mapAuditResult(result.savedAudit),
    qualityScore: mapQualityScore(result.savedQuality),
    rankingMetric: mapRankingMetric(result.savedMetric)
  };
}

export async function listFeed(type: FeedType, cursor: string | null, pageSize: number) {
  await ensureSeedData();
  const rankingConfig = getRankingConfig(type);

  const all = await prisma.content.findMany({
    where: { status: 'published' },
    include: {
      author: true,
      rankingMetric: true
    },
    orderBy: { publishedAt: 'desc' }
  });
  const sorted = all
    .map((item) => {
      const metric = item.rankingMetric ? mapRankingMetric(item.rankingMetric) : undefined;
      return {
        item,
        activeScore: metric ? calculateWeightedRankingScore(metric, rankingConfig) : 0
      };
    })
    .sort((left, right) => right.activeScore - left.activeScore);
  const startIndex = cursor ? sorted.findIndex(({ item }) => item.id === cursor) + 1 : 0;
  const page = sorted.slice(Math.max(0, startIndex), Math.max(0, startIndex) + pageSize);
  const qualityScores = await prisma.qualityScore.findMany({
    where: { id: { in: page.map(({ item }) => item.qualityScoreId).filter(Boolean) as string[] } }
  });
  const scoreMap = new Map(qualityScores.map((score) => [score.id, mapQualityScore(score)]));

  return {
    type,
    rankingConfig,
    items: page.map(({ item }): FeedItem => {
      const content = mapContent(item);
      return {
        ...content,
        author: { id: item.author.id, nickname: item.author.nickname },
        qualityScore: content.qualityScoreId ? scoreMap.get(content.qualityScoreId) : undefined,
        rankingMetric: withActiveRankingScore(
          item.rankingMetric ? mapRankingMetric(item.rankingMetric) : undefined,
          type
        )
      };
    }),
    nextCursor: page.length === pageSize ? page[page.length - 1]?.item.id ?? null : null
  };
}

export async function getFeedContent(contentId: string, type: FeedType = 'hot'): Promise<FeedItem | null> {
  await ensureSeedData();
  const item = await prisma.content.findFirst({
    where: { id: contentId, status: 'published' },
    include: {
      author: true,
      rankingMetric: true
    }
  });
  if (!item) return null;
  const content = mapContent(item);
  const qualityScore = content.qualityScoreId
    ? await prisma.qualityScore.findUnique({ where: { id: content.qualityScoreId } })
    : null;
  const draft = await prisma.draft.findFirst({
    where: { contentId: item.id, ownerId: item.authorId },
    select: { id: true }
  });
  return {
    ...content,
    author: { id: item.author.id, nickname: item.author.nickname },
    draftId: draft?.id,
    qualityScore: qualityScore ? mapQualityScore(qualityScore) : undefined,
    rankingMetric: withActiveRankingScore(item.rankingMetric ? mapRankingMetric(item.rankingMetric) : undefined, type)
  };
}

export async function offlineContentForUser(userId: string, contentId: string): Promise<Content | null> {
  const existing = await prisma.content.findFirst({
    where: { id: contentId, authorId: userId, status: 'published' }
  });
  if (!existing) return null;

  const updated = await prisma.content.update({
    where: { id: contentId },
    data: { status: 'offline' }
  });
  return mapContent(updated);
}

export async function createAiCallLog(input: Omit<AiCallLog, 'id' | 'createdAt'>): Promise<AiCallLog> {
  const log = await prisma.aiCallLog.create({
    data: {
      id: createId('ai_log'),
      callType: input.callType,
      provider: input.provider,
      model: input.model,
      durationMs: input.durationMs,
      inputSummary: input.inputSummary,
      outputSummary: input.outputSummary,
      schemaValid: input.schemaValid,
      errorMessage: input.errorMessage
    }
  });
  return mapAiCallLog(log);
}
