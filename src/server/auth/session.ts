import { cookies } from 'next/headers';
import type { User } from '@/lib/types';
import {
  createSession as createRepositorySession,
  getCurrentUserBySession,
  getOrCreateUser as getOrCreateRepositoryUser
} from '@/server/repositories/app-repository';

export const SESSION_COOKIE = 'tt_session';

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getCurrentUserBySession(token);
}

export async function createSession(userId: string) {
  return createRepositorySession(userId);
}

export async function getOrCreateUser(email: string, nickname?: string) {
  return getOrCreateRepositoryUser(email, nickname);
}
