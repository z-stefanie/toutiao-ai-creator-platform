import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { updateDraftSchema } from '@/server/schemas';
import { createDraftForUser } from '@/server/repositories/app-repository';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

    const parsed = updateDraftSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return fail('INVALID_DRAFT', '草稿内容不完整。', 400, parsed.error.flatten());
    }

    const draft = await createDraftForUser(user.id, parsed.data);
    return ok({ draft });
  } catch { return fail('INTERNAL_ERROR', '服务暂时不可用，请稍后重试。', 500); }
}
