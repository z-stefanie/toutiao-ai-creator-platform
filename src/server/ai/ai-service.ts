import type { z } from 'zod';
import type { AiCallType, AuditResult, Draft, GeneratedContent, QualityScore } from '@/lib/types';
import {
  mockAuditDraft,
  mockGenerateContent,
  mockRewriteDraft,
  mockScoreDraft
} from '@/server/ai/mock-provider';
import {
  auditOutputSchema,
  generatedContentOutputSchema,
  qualityScoreOutputSchema,
  rewriteOutputSchema
} from '@/server/ai/output-schemas';
import { generateOpenAiCompatibleJson } from '@/server/ai/openai-compatible-provider';
import { createAiCallLog } from '@/server/repositories/app-repository';
import { createId, timestamp } from '@/server/utils/id';

type ProviderName = 'mock' | 'openai' | 'openai-compatible';

type AiConfig = {
  provider: ProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
};

type GenerateContentInput = {
  topic: string;
  audience: string;
  tone: string;
  promptTemplate?: string;
};

type RewriteResult = {
  title: string;
  body: string;
  changedSpans: Array<{ before: string; after: string; reason: string }>;
};

function getAiConfig(): AiConfig {
  const providerSetting = process.env.AI_PROVIDER;
  const provider =
    providerSetting === 'openai' || providerSetting === 'openai-compatible' ? providerSetting : 'mock';
  return {
    provider,
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? (provider === 'mock' ? 'mock-ai-v1' : 'gpt-4o-mini')
  };
}

function summarize(value: unknown, maxLength = 900) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

async function callProvider(config: AiConfig, systemPrompt: string, userPrompt: string) {
  if (config.provider === 'mock') {
    throw new Error('callProvider should only be used for OpenAI-compatible provider');
  }
  if (!config.apiKey) {
    throw new Error('AI_API_KEY is required when AI_PROVIDER=openai or openai-compatible');
  }
  return generateOpenAiCompatibleJson(
    {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model
    },
    {
      systemPrompt,
      userPrompt
    }
  );
}

async function runAiTask<T>({
  callType,
  input,
  schema,
  mock,
  systemPrompt,
  userPrompt
}: {
  callType: AiCallType;
  input: unknown;
  schema: z.ZodType<T>;
  mock: () => unknown;
  systemPrompt: string;
  userPrompt: string;
}): Promise<{ data: T; config: AiConfig }> {
  const config = getAiConfig();
  const startedAt = Date.now();
  let rawOutput: unknown = null;
  let schemaValid = false;
  let errorMessage: string | undefined;

  try {
    rawOutput = config.provider === 'mock' ? mock() : await callProvider(config, systemPrompt, userPrompt);
    const parsed = schema.parse(rawOutput);
    schemaValid = true;
    return { data: parsed, config };
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
    throw error;
  } finally {
    await createAiCallLog({
      callType,
      provider: config.provider,
      model: config.model,
      durationMs: Date.now() - startedAt,
      inputSummary: summarize(input),
      outputSummary: rawOutput ? summarize(rawOutput) : '',
      schemaValid,
      errorMessage
    }).catch(() => {
      // Logging must never break the creator flow.
    });
  }
}

export async function generateContent(input: GenerateContentInput): Promise<GeneratedContent> {
  const systemPrompt = [
    '你是今日头条创作者平台的内容生成助手。',
    '必须只返回 JSON，不要输出 Markdown。',
    'JSON 字段：title, summary, body, coverSuggestion, imageSuggestions, tags, reasoningSummary。'
  ].join('\n');
  const userPrompt = JSON.stringify({
    task: 'generate_content',
    ...input
  });
  const { data } = await runAiTask({
    callType: 'generate_content',
    input,
    schema: generatedContentOutputSchema,
    mock: () => mockGenerateContent(input),
    systemPrompt,
    userPrompt
  });
  return data;
}

export async function auditDraft(draft: Draft): Promise<AuditResult> {
  const systemPrompt = [
    '你是内容安全审核模型。',
    '审核范围：涉黄、涉赌、涉毒、敏感信息、低俗内容。',
    '必须只返回 JSON，字段：passed, riskLevel, categories, hitSpans, action, suggestion。',
    'riskLevel 只能是英文枚举：none, low, medium, high。',
    'categories 只能使用英文枚举数组：porn, gambling, drug, sensitive, vulgar, other。',
    'hitSpans 必须是对象数组，每项字段为 text, category, reason；category 同样只能使用英文枚举。',
    'action 只能是英文枚举：allow, warn, block, rewrite_required。',
    '高危内容必须 passed=false，action 为 block 或 rewrite_required。'
  ].join('\n');
  const userPrompt = JSON.stringify({
    task: 'audit_content',
    title: draft.title,
    body: draft.body
  });
  const { data, config } = await runAiTask({
    callType: 'audit_content',
    input: { draftId: draft.id, title: draft.title, body: draft.body },
    schema: auditOutputSchema,
    mock: () => mockAuditDraft(draft),
    systemPrompt,
    userPrompt
  });
  return {
    id: createId('audit'),
    draftId: draft.id,
    ...data,
    modelName: config.model,
    createdAt: timestamp()
  };
}

export async function rewriteCompliantDraft(draft: Pick<Draft, 'id' | 'title' | 'body'>): Promise<RewriteResult> {
  const systemPrompt = [
    '你是内容合规改写助手。',
    '在保留原意的前提下移除违规或高风险表达。',
    '必须只返回 JSON，字段：title, body, changedSpans。',
    'changedSpans 必须是对象数组，每项字段为 before, after, reason；不能返回字符串数组。'
  ].join('\n');
  const userPrompt = JSON.stringify({
    task: 'rewrite_compliant',
    title: draft.title,
    body: draft.body
  });
  const { data } = await runAiTask({
    callType: 'rewrite_compliant',
    input: { draftId: draft.id, title: draft.title, body: draft.body },
    schema: rewriteOutputSchema,
    mock: () => mockRewriteDraft(draft),
    systemPrompt,
    userPrompt
  });
  return data;
}

export async function scoreDraftQuality(draft: Draft): Promise<QualityScore> {
  const systemPrompt = [
    '你是内容质量评分模型。',
    '请从原创性、结构完整度、可读性、信息密度、标题吸引力、图文匹配度评分。',
    '必须只返回 JSON，字段：total, dimensions, reasons, improvementSuggestions。',
    'total 必须是 0 到 100 的整数。',
    'dimensions 必须是对象，不是数组；必须包含整数键：originality, structure, readability, informationDensity, titleAttraction, imageTextMatch。'
  ].join('\n');
  const userPrompt = JSON.stringify({
    task: 'score_quality',
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    tags: draft.tags,
    assetIds: draft.assetIds
  });
  const { data, config } = await runAiTask({
    callType: 'score_quality',
    input: { draftId: draft.id, title: draft.title, body: draft.body, tags: draft.tags },
    schema: qualityScoreOutputSchema,
    mock: () => mockScoreDraft(draft),
    systemPrompt,
    userPrompt
  });
  return {
    id: createId('quality'),
    draftId: draft.id,
    total: data.total,
    dimensions: data.dimensions,
    reasons: data.reasons,
    modelName: config.model,
    createdAt: timestamp()
  };
}
