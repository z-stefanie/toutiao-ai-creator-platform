import type { AuditCategory } from '@/lib/types';

export type PrescreenHit = {
  text: string;
  category: AuditCategory;
  reason: string;
  reviewStatus: 'machine_blocked' | 'manual_review_required';
};

export const auditRiskRules: Array<{
  term: string;
  category: AuditCategory;
  reason: string;
  reviewStatus: 'machine_blocked' | 'manual_review_required';
}> = [
  { term: '赌博', category: 'gambling', reason: '涉及赌博引导或相关表达', reviewStatus: 'machine_blocked' },
  { term: '博彩', category: 'gambling', reason: '涉及博彩相关表达', reviewStatus: 'machine_blocked' },
  { term: '赌局', category: 'gambling', reason: '涉及赌博活动组织', reviewStatus: 'machine_blocked' },
  { term: '下注', category: 'gambling', reason: '涉及下注诱导', reviewStatus: 'machine_blocked' },
  { term: '赔率', category: 'gambling', reason: '涉及博彩赔率表达', reviewStatus: 'machine_blocked' },
  { term: '彩票套利', category: 'gambling', reason: '涉及博彩获利诱导', reviewStatus: 'machine_blocked' },
  { term: '毒品', category: 'drug', reason: '涉及毒品相关表达', reviewStatus: 'machine_blocked' },
  { term: '禁药', category: 'drug', reason: '涉及禁药传播风险', reviewStatus: 'machine_blocked' },
  { term: '吸毒', category: 'drug', reason: '涉及吸毒行为', reviewStatus: 'machine_blocked' },
  { term: '贩毒', category: 'drug', reason: '涉及毒品交易风险', reviewStatus: 'machine_blocked' },
  { term: '违禁药物', category: 'drug', reason: '涉及违禁药物信息', reviewStatus: 'machine_blocked' },
  { term: '涉黄', category: 'porn', reason: '涉及色情低俗风险', reviewStatus: 'machine_blocked' },
  { term: '色情', category: 'porn', reason: '涉及色情内容', reviewStatus: 'machine_blocked' },
  { term: '成人内容', category: 'porn', reason: '涉及成人内容引流', reviewStatus: 'machine_blocked' },
  { term: '裸露', category: 'porn', reason: '涉及裸露风险', reviewStatus: 'manual_review_required' },
  { term: '黄色网站', category: 'porn', reason: '涉及色情站点引流', reviewStatus: 'machine_blocked' },
  { term: '低俗', category: 'vulgar', reason: '存在低俗表达风险', reviewStatus: 'machine_blocked' },
  { term: '擦边', category: 'vulgar', reason: '存在擦边表达风险', reviewStatus: 'manual_review_required' },
  { term: '粗俗', category: 'vulgar', reason: '存在粗俗表达风险', reviewStatus: 'manual_review_required' },
  { term: '恶俗', category: 'vulgar', reason: '存在恶俗表达风险', reviewStatus: 'machine_blocked' },
  { term: '挑逗', category: 'vulgar', reason: '存在挑逗引流风险', reviewStatus: 'manual_review_required' },
  { term: '敏感信息', category: 'sensitive', reason: '可能包含敏感信息', reviewStatus: 'machine_blocked' },
  { term: '身份证', category: 'sensitive', reason: '可能泄露个人敏感身份信息', reviewStatus: 'machine_blocked' },
  { term: '手机号', category: 'sensitive', reason: '可能泄露个人联系方式', reviewStatus: 'manual_review_required' },
  { term: '家庭住址', category: 'sensitive', reason: '可能泄露住址信息', reviewStatus: 'machine_blocked' },
  { term: '银行卡', category: 'sensitive', reason: '可能泄露金融信息', reviewStatus: 'machine_blocked' },
  { term: '密码', category: 'sensitive', reason: '可能泄露账户凭证', reviewStatus: 'machine_blocked' }
];

export function prescreenContent(input: { title: string; body: string }) {
  const text = `${input.title}\n${input.body}`;
  const hitSpans: PrescreenHit[] = auditRiskRules
    .filter((rule) => text.includes(rule.term))
    .map((rule) => ({
      text: rule.term,
      category: rule.category,
      reason: rule.reason,
      reviewStatus: rule.reviewStatus
    }));

  return {
    passed: hitSpans.length === 0,
    hitSpans,
    categories: [...new Set(hitSpans.map((hit) => hit.category))]
  };
}
