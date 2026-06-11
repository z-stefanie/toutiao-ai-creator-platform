import { NextRequest } from 'next/server';
import { listFeed as listFeedFromRepository } from '@/server/repositories/app-repository';

type FeedType = 'hot' | 'viral' | 'recommended';

export async function listFeed(request: NextRequest, type: FeedType) {
  const pageSize = Number(request.nextUrl.searchParams.get('limit') ?? '6');
  const cursor = request.nextUrl.searchParams.get('cursor');
  return listFeedFromRepository(type, cursor, pageSize);
}
