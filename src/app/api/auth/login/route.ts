import { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/server/http';
import { createSession, getOrCreateUser, SESSION_COOKIE } from '@/server/auth/session';
import { loginSchema } from '@/server/schemas';

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) {
    return fail('INVALID_LOGIN', '请输入有效邮箱和密码。', 400, parsed.error.flatten());
  }

  const user = await getOrCreateUser(parsed.data.email);
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

export function GET() {
  return NextResponse.json({ message: 'Use POST /api/auth/login' }, { status: 405 });
}
