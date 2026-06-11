'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { LogIn } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import type { User } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@toutiao.ai');
  const [password, setPassword] = useState('demo123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch<{ user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">登录创作者工作台</h1>
          <p className="page-subtitle">使用演示账号即可跑通 AI 创作、审核、发布和榜单链路。</p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: 520 }}>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span className="label">邮箱</span>
            <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span className="label">密码</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="notice danger">{error}</div> : null}
          <div className="button-row">
            <button className="button primary" disabled={loading} type="submit">
              <LogIn size={18} />
              {loading ? '登录中' : '登录'}
            </button>
            <Link className="button" href="/register">
              注册新账号
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

