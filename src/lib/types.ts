export type User = {
  id: string;
  email: string;
  phone?: string;
  nickname: string;
  role: 'creator' | 'admin';
  createdAt: string;
};

export type Prompt = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  template: string;
  category: 'article' | 'short_post' | 'review' | 'rewrite' | 'audit' | 'quality';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  ownerId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  complianceStatus: 'pending' | 'passed' | 'rejected';
  complianceReason?: string;
  createdAt: string;
};

export type Draft = {
  id: string;
  ownerId: string;
  contentId?: string;
  title: string;
  summary: string;
  body: string;
  assetIds: string[];
  tags: string[];
  version: number;
  syncStatus: 'synced' | 'local_pending' | 'conflicted';
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditCategory = 'porn' | 'gambling' | 'drug' | 'sensitive' | 'vulgar' | 'other';

export type FeedType = 'hot' | 'viral' | 'recommended';

export type AuditResult = {
  id: string;
  contentId?: string;
  draftId?: string;
  passed: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  categories: AuditCategory[];
  hitSpans: Array<{
    text: string;
    category: AuditCategory;
    reason: string;
  }>;
  action: 'allow' | 'warn' | 'block' | 'rewrite_required';
  suggestion: string;
  modelName: string;
  createdAt: string;
};

export type QualityScore = {
  id: string;
  contentId?: string;
  draftId?: string;
  total: number;
  dimensions: {
    originality: number;
    structure: number;
    readability: number;
    informationDensity: number;
    titleAttraction: number;
    imageTextMatch: number;
  };
  reasons: string[];
  modelName: string;
  createdAt: string;
};

export type Content = {
  id: string;
  authorId: string;
  title: string;
  summary: string;
  body: string;
  coverUrl?: string;
  assetIds: string[];
  tags: string[];
  status: 'draft' | 'reviewing' | 'published' | 'rejected' | 'offline';
  auditResultId?: string;
  qualityScoreId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type RankingMetric = {
  contentId: string;
  qualityScore: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  heatScore: number;
  freshnessScore: number;
  feedbackScore?: number;
  rankingScore: number;
  activeRankingScore?: number;
  calculatedAt: string;
};

export type RankingConfig = {
  type: FeedType;
  title: string;
  description: string;
  weights: {
    quality: number;
    heat: number;
    freshness: number;
    feedback: number;
  };
};

export type FeedItem = Content & {
  author: Pick<User, 'id' | 'nickname'>;
  draftId?: string;
  qualityScore?: QualityScore;
  rankingMetric?: RankingMetric;
};

export type GeneratedContent = {
  title: string;
  summary: string;
  body: string;
  coverSuggestion: string;
  imageSuggestions: string[];
  tags: string[];
  reasoningSummary: string;
};

export type AiCallType = 'generate_content' | 'audit_content' | 'rewrite_compliant' | 'score_quality';

export type AiCallLog = {
  id: string;
  callType: AiCallType;
  provider: string;
  model: string;
  durationMs: number;
  inputSummary: string;
  outputSummary: string;
  schemaValid: boolean;
  errorMessage?: string;
  createdAt: string;
};

export type ApiResponse<T> =
  | { ok: true; data: T; traceId: string }
  | { ok: false; error: { code: string; message: string; details?: unknown }; traceId: string };
