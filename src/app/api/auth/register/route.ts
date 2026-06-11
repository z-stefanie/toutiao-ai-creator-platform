import { NextRequest } from 'next/server';
import { ok, fail } from '@/server/http';
import { createSession, getOrCreateUser, SESSION_COOKIE } from '@/server/auth/session';
import { registerSchema } from '@/server/schemas';

export async function POST(request: NextRequest) {
  const parsed = registerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_REGISTER', '请输入有效注册信息。', 400, parsed.error.flatten());
  }

  const user = await getOrCreateUser(parsed.data.email, parsed.data.nickname);
  const token = await createSession(user.id);
  const response = ok({ user });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return response;
}
