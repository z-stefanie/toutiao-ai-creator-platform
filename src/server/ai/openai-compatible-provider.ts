type JsonRequest = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
};

export type OpenAiCompatibleConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function readContent(response: ChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text ?? '')
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function stripJsonFence(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function escapeControlCharsInJsonStrings(text: string) {
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

function parseJsonObject(text: string) {
  const candidate = stripJsonFence(text);
  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    // Some models do not support response_format and may add short prose.
  }

  try {
    return JSON.parse(escapeControlCharsInJsonStrings(candidate)) as unknown;
  } catch {
    // Continue with object extraction below.
  }

  const start = candidate.indexOf('{');
  if (start === -1) {
    throw new Error('OpenAI-compatible provider did not return a JSON object');
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
        return JSON.parse(objectText) as unknown;
      } catch {
        return JSON.parse(escapeControlCharsInJsonStrings(objectText)) as unknown;
      }
    }
  }

  throw new Error('OpenAI-compatible provider returned incomplete JSON');
}

export async function generateOpenAiCompatibleJson(config: OpenAiCompatibleConfig, request: JsonRequest) {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      temperature: request.temperature ?? 0.2,
      messages: [
        {
          role: 'system',
          content: `${request.systemPrompt}\n只返回一个合法 JSON 对象；不要使用 Markdown 代码块；不要添加解释文字。`
        },
        {
          role: 'user',
          content: request.userPrompt
        }
      ]
    })
  });

  const payload = (await response.json()) as ChatCompletionResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI-compatible request failed with ${response.status}`);
  }

  const content = readContent(payload);
  if (!content) {
    throw new Error('OpenAI-compatible provider returned empty content');
  }

  return parseJsonObject(content);
}
