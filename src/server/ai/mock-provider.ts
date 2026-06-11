import type { AuditResult, Draft, GeneratedContent, QualityScore } from '@/lib/types';
import { prescreenContent } from '@/server/audit/rule-prescreen';
import { createId, timestamp } from '@/server/utils/id';

export function mockGenerateContent(input: {
  topic: string;
  audience: string;
  tone: string;
  promptTemplate?: string;
}): GeneratedContent {
  const topic = input.topic.trim();
  const audience = input.audience.trim();
  const tone = input.tone.trim();

  return {
    title: `${topic}：给${audience}的三条创作观察`,
    summary: `围绕${topic}，用${tone}的方式整理成可发布的短图文草稿。`,
    body: `围绕“${topic}”，创作者最需要的不是一次性生成一篇文章，而是一条稳定的生产链路。\n\n第一，AI 可以先把素材、观点和目标受众整理成可编辑的草稿，减少空白页压力。\n\n第二，发布前审核要前置到创作流程里。风险提示、质量评分和合规改写应该出现在同一个工作台，而不是发布失败之后才补救。\n\n第三，内容进入榜单后，排序也要能解释。质量分、阅读热度和发布时间共同决定分发位置，创作者才能知道下一轮优化方向。\n\n这篇草稿使用的基调是“${tone}”。${input.promptTemplate ? `参考 Prompt：${input.promptTemplate.slice(0, 46)}。` : ''}`,
    coverSuggestion: '使用创作者工作台或内容数据看板作为封面，突出“生产闭环”和“分发反馈”。',
    imageSuggestions: ['创作者工作台截图', '内容质量评分卡片', '热点榜单信息流'],
    tags: ['AI创作', '内容分发', '创作者工具'],
    reasoningSummary: 'Mock AI 根据主题、受众和语气生成结构化短图文，便于后续编辑、审核和发布。'
  };
}

export function mockAuditDraft(draft: Pick<Draft, 'id' | 'title' | 'body'>): AuditResult {
  const prescreen = prescreenContent(draft);
  const hits = prescreen.hitSpans.map((hit) => ({
    text: hit.text,
    category: hit.category,
    reason: hit.reason
  }));

  if (hits.length > 0) {
    return {
      id: createId('audit'),
      draftId: draft.id,
      passed: false,
      riskLevel: 'high',
      categories: prescreen.categories,
      hitSpans: hits,
      action: 'rewrite_required',
      suggestion: '已命中高风险表达，请使用合规改写或手动删除风险片段后再次提交。',
      modelName: 'mock-audit-v1',
      createdAt: timestamp()
    };
  }

  return {
    id: createId('audit'),
    draftId: draft.id,
    passed: true,
    riskLevel: 'none',
    categories: [],
    hitSpans: [],
    action: 'allow',
    suggestion: '内容未命中 Mock 风险规则，可进入质量评分和发布流程。',
    modelName: 'mock-audit-v1',
    createdAt: timestamp()
  };
}

export function mockRewriteDraft(draft: Draft) {
  let title = draft.title;
  let body = draft.body;
  const changedSpans: Array<{ before: string; after: string; reason: string }> = [];

  for (const rule of prescreenContent(draft).hitSpans) {
    if (title.includes(rule.text) || body.includes(rule.text)) {
      const replacement = '不当风险表达';
      title = title.replaceAll(rule.text, replacement);
      body = body.replaceAll(rule.text, replacement);
      changedSpans.push({
        before: rule.text,
        after: replacement,
        reason: rule.reason
      });
    }
  }

  return {
    title,
    body,
    changedSpans
  };
}

export function mockScoreDraft(draft: Draft): QualityScore {
  const lengthScore = Math.min(92, Math.max(68, Math.floor(draft.body.length / 12)));
  const tagBonus = Math.min(6, draft.tags.length * 2);
  const titleScore = draft.title.length >= 12 ? 88 : 76;
  const total = Math.round((lengthScore + titleScore + 86 + tagBonus) / 3);

  return {
    id: createId('quality'),
    draftId: draft.id,
    total,
    dimensions: {
      originality: Math.min(95, total + 1),
      structure: Math.min(96, total + 4),
      readability: Math.min(95, total + 3),
      informationDensity: Math.max(70, total - 3),
      titleAttraction: titleScore,
      imageTextMatch: draft.assetIds.length > 0 ? 86 : 78
    },
    reasons: ['结构完整，适合信息流阅读', '标题与正文主题一致', '具备进入榜单排序的基础质量信号'],
    modelName: 'mock-quality-v1',
    createdAt: timestamp()
  };
}
