import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return fail('UNAUTHENTICATED', '请先登录。', 401);
  }
  return ok({ user });
}

