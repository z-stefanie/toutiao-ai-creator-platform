import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { generateContentSchema } from '@/server/schemas';
import { createDraftForUser, findPromptForUser } from '@/server/repositories/app-repository';
import { generateContent } from '@/server/ai/ai-service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

    const parsed = generateContentSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('INVALID_GENERATION_INPUT', '创作参数不完整。', 400, parsed.error.flatten());
    }

    const prompt = await findPromptForUser(user.id, parsed.data.promptId);
    const generated = await generateContent({
      ...parsed.data,
      promptTemplate: prompt?.template
    });
    const draft = await createDraftForUser(user.id, {
      title: generated.title,
      summary: generated.summary,
      body: generated.body,
      assetIds: parsed.data.assetIds,
      tags: generated.tags
    });

    return ok({ generated, draft });
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
