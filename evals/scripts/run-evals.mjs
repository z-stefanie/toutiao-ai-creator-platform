import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const auditCasesPath = path.join(projectRoot, 'evals/audit-cases.json');
const qualityCasesPath = path.join(projectRoot, 'evals/quality-cases.json');
const dbPath = path.join(projectRoot, 'prisma/dev.db');

const riskRules = [
  { term: '赌博', category: 'gambling', reason: '涉及赌博引导或相关表达' },
  { term: '博彩', category: 'gambling', reason: '涉及博彩相关表达' },
  { term: '赌局', category: 'gambling', reason: '涉及赌博活动组织' },
  { term: '下注', category: 'gambling', reason: '涉及下注诱导' },
  { term: '赔率', category: 'gambling', reason: '涉及博彩赔率表达' },
  { term: '彩票套利', category: 'gambling', reason: '涉及博彩获利诱导' },
  { term: '毒品', category: 'drug', reason: '涉及毒品相关表达' },
  { term: '禁药', category: 'drug', reason: '涉及禁药传播风险' },
  { term: '吸毒', category: 'drug', reason: '涉及吸毒行为' },
  { term: '贩毒', category: 'drug', reason: '涉及毒品交易风险' },
  { term: '违禁药物', category: 'drug', reason: '涉及违禁药物信息' },
  { term: '涉黄', category: 'porn', reason: '涉及色情低俗风险' },
  { term: '色情', category: 'porn', reason: '涉及色情内容' },
  { term: '成人内容', category: 'porn', reason: '涉及成人内容引流' },
  { term: '裸露', category: 'porn', reason: '涉及裸露风险' },
  { term: '黄色网站', category: 'porn', reason: '涉及色情站点引流' },
  { term: '低俗', category: 'vulgar', reason: '存在低俗表达风险' },
  { term: '擦边', category: 'vulgar', reason: '存在擦边表达风险' },
  { term: '粗俗', category: 'vulgar', reason: '存在粗俗表达风险' },
  { term: '恶俗', category: 'vulgar', reason: '存在恶俗表达风险' },
  { term: '挑逗', category: 'vulgar', reason: '存在挑逗引流风险' },
  { term: '敏感信息', category: 'sensitive', reason: '可能包含敏感信息' },
  { term: '身份证', category: 'sensitive', reason: '可能泄露个人敏感身份信息' },
  { term: '手机号', category: 'sensitive', reason: '可能泄露个人联系方式' },
  { term: '家庭住址', category: 'sensitive', reason: '可能泄露住址信息' },
  { term: '银行卡', category: 'sensitive', reason: '可能泄露金融信息' },
  { term: '密码', category: 'sensitive', reason: '可能泄露账户凭证' }
];

const auditCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  body: z.string(),
  expected: z.object({
    passed: z.boolean(),
    riskLevel: z.enum(['none', 'low', 'medium', 'high']),
    categories: z.array(z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other'])),
    action: z.enum(['allow', 'warn', 'block', 'rewrite_required'])
  })
});

const qualityCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  summary: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  assetIds: z.array(z.string()),
  expected: z.object({
    band: z.enum(['high', 'medium', 'low']),
    minTotal: z.number().int().min(0).max(100),
    maxTotal: z.number().int().min(0).max(100)
  })
});

const auditOutputSchema = z.object({
  passed: z.boolean(),
  riskLevel: z.enum(['none', 'low', 'medium', 'high']),
  categories: z.array(z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other'])),
  hitSpans: z.array(
    z.object({
      text: z.string(),
      category: z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other']),
      reason: z.string()
    })
  ),
  action: z.enum(['allow', 'warn', 'block', 'rewrite_required']),
  suggestion: z.string()
});

const qualityOutputSchema = z.object({
  total: z.number().int().min(0).max(100),
  dimensions: z.object({
    originality: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
    readability: z.number().int().min(0).max(100),
    informationDensity: z.number().int().min(0).max(100),
    titleAttraction: z.number().int().min(0).max(100),
    imageTextMatch: z.number().int().min(0).max(100)
  }),
  reasons: z.array(z.string()),
  improvementSuggestions: z.array(z.string())
});

async function readJson(filePath, schema) {
  const content = await readFile(filePath, 'utf8');
  return z.array(schema).parse(JSON.parse(content));
}

function mockAudit(caseItem) {
  const text = `${caseItem.title}\n${caseItem.body}`;
  const hitSpans = riskRules
    .filter((rule) => text.includes(rule.term))
    .map((rule) => ({
      text: rule.term,
      category: rule.category,
      reason: rule.reason
    }));

  if (hitSpans.length > 0) {
    return {
      passed: false,
      riskLevel: 'high',
      categories: [...new Set(hitSpans.map((hit) => hit.category))],
      hitSpans,
      action: 'rewrite_required',
      suggestion: '已命中高风险表达，请使用合规改写或手动删除风险片段后再次提交。'
    };
  }

  return {
    passed: true,
    riskLevel: 'none',
    categories: [],
    hitSpans: [],
    action: 'allow',
    suggestion: '内容未命中 Mock 风险规则，可进入质量评分和发布流程。'
  };
}

function mockQuality(caseItem) {
  const lengthScore = Math.min(92, Math.max(68, Math.floor(caseItem.body.length / 12)));
  const tagBonus = Math.min(6, caseItem.tags.length * 2);
  const titleScore = caseItem.title.length >= 12 ? 88 : 76;
  const total = Math.round((lengthScore + titleScore + 86 + tagBonus) / 3);

  return {
    total,
    dimensions: {
      originality: Math.min(95, total + 1),
      structure: Math.min(96, total + 4),
      readability: Math.min(95, total + 3),
      informationDensity: Math.max(70, total - 3),
      titleAttraction: titleScore,
      imageTextMatch: caseItem.assetIds.length > 0 ? 86 : 78
    },
    reasons: ['结构完整，适合信息流阅读', '标题与正文主题一致', '具备进入榜单排序的基础质量信号'],
    improvementSuggestions: ['补充真实案例', '优化标题信息量']
  };
}

function qualityBand(total) {
  if (total >= 88) return 'high';
  if (total >= 82) return 'medium';
  return 'low';
}

function includesAll(actual, expected) {
  return expected.every((item) => actual.includes(item));
}

function evaluateAudit(cases) {
  const details = [];
  let schemaFailures = 0;
  let passed = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (const caseItem of cases) {
    const startedAt = Date.now();
    const output = mockAudit(caseItem);
    const schemaResult = auditOutputSchema.safeParse(output);
    const durationMs = Date.now() - startedAt;
    if (!schemaResult.success) {
      schemaFailures += 1;
    }

    const actual = schemaResult.success ? schemaResult.data : output;
    const matched =
      schemaResult.success &&
      actual.passed === caseItem.expected.passed &&
      actual.riskLevel === caseItem.expected.riskLevel &&
      actual.action === caseItem.expected.action &&
      includesAll(actual.categories, caseItem.expected.categories);

    if (matched) {
      passed += 1;
    } else if (actual.passed && !caseItem.expected.passed) {
      falseNegative += 1;
    } else if (!actual.passed && caseItem.expected.passed) {
      falsePositive += 1;
    }

    details.push({
      id: caseItem.id,
      passed: matched,
      expected: caseItem.expected,
      actual,
      durationMs,
      schemaValid: schemaResult.success
    });
  }

  return {
    total: cases.length,
    passed,
    accuracy: cases.length === 0 ? 0 : passed / cases.length,
    schemaFailures,
    falsePositive,
    falseNegative,
    details
  };
}

function evaluateQuality(cases) {
  const details = [];
  let schemaFailures = 0;
  let passed = 0;

  for (const caseItem of cases) {
    const startedAt = Date.now();
    const output = mockQuality(caseItem);
    const schemaResult = qualityOutputSchema.safeParse(output);
    const durationMs = Date.now() - startedAt;
    if (!schemaResult.success) {
      schemaFailures += 1;
    }

    const actual = schemaResult.success ? schemaResult.data : output;
    const band = schemaResult.success ? qualityBand(actual.total) : 'unknown';
    const matched =
      schemaResult.success &&
      band === caseItem.expected.band &&
      actual.total >= caseItem.expected.minTotal &&
      actual.total <= caseItem.expected.maxTotal;

    if (matched) {
      passed += 1;
    }

    details.push({
      id: caseItem.id,
      passed: matched,
      expected: caseItem.expected,
      actual: {
        total: actual.total,
        band,
        dimensions: actual.dimensions
      },
      durationMs,
      schemaValid: schemaResult.success
    });
  }

  return {
    total: cases.length,
    passed,
    coverage: cases.length === 0 ? 0 : passed / cases.length,
    schemaFailures,
    details
  };
}

function readAiCallLogSummary() {
  if (!existsSync(dbPath)) {
    return { available: false, reason: 'prisma/dev.db not found' };
  }

  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare(
        [
          'select callType, provider, model,',
          'count(*) as total,',
          'sum(case when schemaValid = 1 then 1 else 0 end) as schemaValidCount,',
          'avg(durationMs) as avgDurationMs',
          'from AiCallLog',
          'group by callType, provider, model',
          'order by callType'
        ].join(' ')
      )
      .all();
    db.close();

    const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const schemaValidCount = rows.reduce((sum, row) => sum + Number(row.schemaValidCount), 0);
    const weightedDuration = rows.reduce(
      (sum, row) => sum + Number(row.avgDurationMs ?? 0) * Number(row.total),
      0
    );

    return {
      available: true,
      total,
      schemaValidCount,
      schemaSuccessRate: total === 0 ? 0 : schemaValidCount / total,
      avgDurationMs: total === 0 ? 0 : weightedDuration / total,
      rows
    };
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'unknown database read error'
    };
  }
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMs(value) {
  return `${Number(value).toFixed(1)}ms`;
}

function printDetails(title, details) {
  console.log(`\n${title}`);
  for (const item of details) {
    const status = item.passed ? 'PASS' : 'FAIL';
    console.log(`- ${status} ${item.id}`);
  }
}

async function main() {
  const auditCases = await readJson(auditCasesPath, auditCaseSchema);
  const qualityCases = await readJson(qualityCasesPath, qualityCaseSchema);

  const auditResult = evaluateAudit(auditCases);
  const qualityResult = evaluateQuality(qualityCases);
  const logSummary = readAiCallLogSummary();
  const totalSchemaFailures = auditResult.schemaFailures + qualityResult.schemaFailures;

  console.log('AI Evaluation Summary');
  console.log('=====================');
  console.log(`Audit cases: ${auditResult.passed}/${auditResult.total} (${formatPercent(auditResult.accuracy)})`);
  console.log(`Audit false positives: ${auditResult.falsePositive}`);
  console.log(`Audit false negatives: ${auditResult.falseNegative}`);
  console.log(`Quality cases: ${qualityResult.passed}/${qualityResult.total} (${formatPercent(qualityResult.coverage)})`);
  console.log(`Eval schema failures: ${totalSchemaFailures}`);

  if (logSummary.available) {
    console.log(`AI call log schema success: ${formatPercent(logSummary.schemaSuccessRate)}`);
    console.log(`AI call log avg duration: ${formatMs(logSummary.avgDurationMs)}`);
    console.log('\nAI Call Log Breakdown');
    for (const row of logSummary.rows) {
      console.log(
        `- ${row.callType} ${row.provider}/${row.model}: ${row.schemaValidCount}/${row.total} schema valid, avg ${formatMs(row.avgDurationMs ?? 0)}`
      );
    }
  } else {
    console.log(`AI call log summary: unavailable (${logSummary.reason})`);
  }

  printDetails('Audit Case Details', auditResult.details);
  printDetails('Quality Case Details', qualityResult.details);

  if (auditResult.passed !== auditResult.total || qualityResult.passed !== qualityResult.total || totalSchemaFailures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
