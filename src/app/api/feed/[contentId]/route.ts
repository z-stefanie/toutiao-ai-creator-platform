import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { getFeedContent } from '@/server/repositories/app-repository';
import { getRankingConfig } from '@/lib/ranking-config';
import type { FeedType } from '@/lib/types';

type Context = { params: Promise<{ contentId: string }> };

function readFeedType(request: NextRequest): FeedType {
  const feed = request.nextUrl.searchParams.get('feed');
  return feed === 'viral' || feed === 'recommended' ? feed : 'hot';
}

export async function GET(request: NextRequest, context: Context) {
  const { contentId } = await context.params;
  const feedType = readFeedType(request);
  const content = await getFeedContent(contentId, feedType);
  if (!content) return fail('CONTENT_NOT_FOUND', '未找到内容。', 404);

  return ok({
    content,
    rankingConfig: getRankingConfig(feedType)
  });
}
