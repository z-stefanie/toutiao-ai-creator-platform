'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { apiFetch } from '@/lib/client-api';

export function AuthGate({ children }: { children: (user: User) => React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ user: User }>('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <main className="page">
        <div className="notice">正在确认登录态...</div>
      </main>
    );
  }

  if (!user) return null;
  return <>{children(user)}</>;
}

