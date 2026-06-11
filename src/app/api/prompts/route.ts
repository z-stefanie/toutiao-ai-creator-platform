import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { createPromptSchema } from '@/server/schemas';
import { createPromptForUser, listPromptsForUser } from '@/server/repositories/app-repository';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const prompts = await listPromptsForUser(user.id);
  return ok({ prompts });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const parsed = createPromptSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_PROMPT', 'Prompt 信息不完整。', 400, parsed.error.flatten());
  }

  const prompt = await createPromptForUser(user.id, parsed.data);
  return ok({ prompt });
}
