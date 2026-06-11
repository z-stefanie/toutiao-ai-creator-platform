import { NextRequest } from 'next/server';
import { ok } from '@/server/http';
import { listFeed } from '@/server/feed/list-feed';

export async function GET(request: NextRequest) {
  return ok(await listFeed(request, 'recommended'));
}
