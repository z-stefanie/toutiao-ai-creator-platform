import { z } from 'zod';

const generatedContentOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  coverSuggestion: z.string().default('使用最能呈现主题场景的首张素材作为封面。'),
  imageSuggestions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  reasoningSummary: z.string().default('')
});

const auditOutputSchema = z.object({
  passed: z.boolean(),
  riskLevel: z.enum(['none', 'low', 'medium', 'high']),
  categories: z.array(z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other'])).default([]),
  hitSpans: z
    .array(
      z.object({
        text: z.string(),
        category: z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other']),
        reason: z.string()
      })
    )
    .default([]),
  action: z.enum(['allow', 'warn', 'block', 'rewrite_required']),
  suggestion: z.string()
});

const rewriteOutputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  changedSpans: z
    .array(
      z.object({
        before: z.string(),
        after: z.string(),
        reason: z.string()
      })
    )
    .default([])
});

const qualityScoreOutputSchema = z.object({
  total: z.number().int().min(0).max(100),
  dimensions: z.object({
    originality: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
    readability: z.number().int().min(0).max(100),
    informationDensity: z.number().int().min(0).max(100),
    titleAttraction: z.number().int().min(0).max(100),
    imageTextMatch: z.number().int().min(0).max(100)
  }),
  reasons: z.array(z.string()).default([]),
  improvementSuggestions: z.array(z.string()).default([])
});

const requiredEnv = ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`[smoke] Missing env: ${missingEnv.join(', ')}`);
  process.exit(1);
}

if (!process.env.AI_BASE_URL.startsWith('https://')) {
  console.error('[smoke] AI_BASE_URL must be an HTTPS base URL.');
  process.exit(1);
}

const baseUrl = process.env.AI_BASE_URL.replace(/\/+$/, '');
const model = process.env.AI_MODEL;
const timeoutMs = Number(process.env.AI_SMOKE_TIMEOUT_MS ?? 60000);

function extractContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text ?? '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function stripJsonFence(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function escapeControlCharsInJsonStrings(text) {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        result += '\\n';
        continue;
      }
      if (char === '\r') {
        result += '\\r';
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        continue;
      }
      if (char.charCodeAt(0) < 0x20) {
        result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        continue;
      }
    }

    result += char;
  }

  return result;
}

function parseJsonObject(text) {
  const candidate = stripJsonFence(text);
  try {
    return JSON.parse(candidate);
  } catch {
    // Models without JSON response_format may add short prose around JSON.
  }

  try {
    return JSON.parse(escapeControlCharsInJsonStrings(candidate));
  } catch {
    // Continue with object extraction below.
  }

  const start = candidate.indexOf('{');
  if (start === -1) {
    throw new Error('Model content did not contain a JSON object.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < candidate.length; index += 1) {
    const char = candidate[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      const objectText = candidate.slice(start, index + 1);
      try {
        return JSON.parse(objectText);
      } catch {
        return JSON.parse(escapeControlCharsInJsonStrings(objectText));
      }
    }
  }

  throw new Error('Model content contained incomplete JSON.');
}

async function callJson({ name, schema, systemPrompt, userPrompt }) {
  const startedAt = Date.now();
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\n必须只返回一个合法 JSON 对象，不要输出 Markdown，不要解释。`
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      status: 0,
      error: error instanceof Error ? error.message : 'Network request failed.'
    };
  }

  const durationMs = Date.now() - startedAt;
  const text = await response.text();

  if (!response.ok) {
    return {
      name,
      ok: false,
      durationMs,
      status: response.status,
      error: text.slice(0, 500)
    };
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return {
      name,
      ok: false,
      durationMs,
      status: response.status,
      error: 'Provider response was not JSON.'
    };
  }

  const content = extractContent(payload);
  let rawOutput;
  try {
    rawOutput = parseJsonObject(content);
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs,
      status: response.status,
      error: error instanceof Error ? error.message : 'Model content was not a JSON object.'
    };
  }

  const parsed = schema.safeParse(rawOutput);
  if (!parsed.success) {
    return {
      name,
      ok: false,
      durationMs,
      status: response.status,
      error: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    };
  }

  return {
    name,
    ok: true,
    durationMs,
    status: response.status,
    fields: Object.keys(parsed.data)
  };
}

const tasks = [
  {
    name: 'generate_content',
    schema: generatedContentOutputSchema,
    systemPrompt: '你是今日头条创作者平台的内容生成助手。',
    userPrompt: JSON.stringify({
      task: 'generate_content',
      topic: '北京通勤效率提升',
      audience: '城市白领',
      tone: '理性、实用',
      requiredFields: ['title', 'summary', 'body', 'coverSuggestion', 'imageSuggestions', 'tags', 'reasoningSummary']
    })
  },
  {
    name: 'audit_content',
    schema: auditOutputSchema,
    systemPrompt: [
      '你是内容安全审核模型，审核范围包括涉黄、涉赌、涉毒、敏感信息和低俗内容。',
      'riskLevel 只能是英文枚举：none, low, medium, high。',
      'categories 只能使用英文枚举数组：porn, gambling, drug, sensitive, vulgar, other。',
      'hitSpans 必须是对象数组，每项字段为 text, category, reason；category 同样只能使用英文枚举。',
      'action 只能是英文枚举：allow, warn, block, rewrite_required。'
    ].join('\n'),
    userPrompt: JSON.stringify({
      task: 'audit_content',
      title: '高风险内容测试',
      body: '这段内容包含赌博引流和收集身份证信息的风险表达，请给出拦截判断。',
      requiredFields: ['passed', 'riskLevel', 'categories', 'hitSpans', 'action', 'suggestion']
    })
  },
  {
    name: 'rewrite_compliant',
    schema: rewriteOutputSchema,
    systemPrompt:
      '你是内容合规改写助手，需要在保留原意的前提下移除违规或高风险表达。changedSpans 必须是对象数组，每项字段为 before, after, reason；不能返回字符串数组。',
    userPrompt: JSON.stringify({
      task: 'rewrite_compliant',
      title: '高风险活动推荐',
      body: '原文包含赌博引流和收集身份证信息，请改写成合规的城市活动安全提醒。',
      requiredFields: ['title', 'body', 'changedSpans']
    })
  },
  {
    name: 'score_quality',
    schema: qualityScoreOutputSchema,
    systemPrompt:
      '你是内容质量评分模型，请从原创性、结构完整度、可读性、信息密度、标题吸引力、图文匹配度评分。total 必须是 0 到 100 的整数。dimensions 必须是对象，不是数组；必须包含整数键：originality, structure, readability, informationDensity, titleAttraction, imageTextMatch。',
    userPrompt: JSON.stringify({
      task: 'score_quality',
      title: '三个方法提升通勤效率',
      summary: '介绍错峰、路线规划和公共交通换乘技巧。',
      body: '早高峰出行可以先确认目的地周边路况，再结合地铁、公交和骑行进行组合规划。文章给出三类可执行建议，并提醒读者根据天气和时间预算动态调整。',
      tags: ['通勤', '城市生活', '效率'],
      assetIds: ['asset-demo-1'],
      requiredFields: ['total', 'dimensions', 'reasons', 'improvementSuggestions']
    })
  }
];

console.log(`[smoke] provider=openai-compatible model=${model} baseUrl=${baseUrl}`);
console.log(`[smoke] timeout=${timeoutMs}ms`);

const results = [];
for (const task of tasks) {
  console.log(`[smoke] ${task.name} START`);
  const result = await callJson(task);
  results.push(result);
  if (result.ok) {
    console.log(`[smoke] ${result.name} OK ${result.durationMs}ms fields=${result.fields.join(',')}`);
  } else {
    console.log(`[smoke] ${result.name} FAIL ${result.durationMs}ms status=${result.status} error=${result.error}`);
  }
}

const passed = results.filter((result) => result.ok).length;
console.log(`[smoke] summary ${passed}/${results.length} passed`);

if (passed !== results.length) {
  process.exit(1);
}
