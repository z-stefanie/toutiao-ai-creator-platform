import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getCurrentUser } from '@/server/auth/session';
import { offlineContentForUser } from '@/server/repositories/app-repository';

type Context = { params: Promise<{ contentId: string }> };

export async function POST(_request: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return fail('UNAUTHENTICATED', '请先登录。', 401);

  const { contentId } = await context.params;
  const content = await offlineContentForUser(user.id, contentId);
  if (!content) return fail('CONTENT_NOT_FOUND', '未找到可下线内容。', 404);

  return ok({
    content,
    governanceAction: {
      type: 'offline',
      reviewStatus: 'manual_review_required',
      reason: '运营治理下线，内容不再进入榜单和详情消费。'
    }
  });
}
