import { ok } from '@/server/http';
import { SESSION_COOKIE } from '@/server/auth/session';

export async function POST() {
  const response = ok({ loggedOut: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  return response;
}

