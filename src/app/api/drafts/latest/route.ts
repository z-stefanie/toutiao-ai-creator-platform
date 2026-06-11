import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { latestDraftForUser } from '@/server/repositories/app-repository';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const draft = await latestDraftForUser(user.id);

  return ok({ draft: draft ?? null });
}
