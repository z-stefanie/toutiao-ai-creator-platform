import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { listAssetsForUser } from '@/server/repositories/app-repository';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const assets = await listAssetsForUser(user.id);
  return ok({ assets });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);
  return fail('UPLOAD_NOT_IMPLEMENTED', 'MVP 当前使用内置演示素材，真实上传将在素材服务阶段接入。', 501);
}
