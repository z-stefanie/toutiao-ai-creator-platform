'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { apiFetch } from '@/lib/client-api';
import type { User } from '@/lib/types';

export default function RegisterPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('新锐创作者');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch<{ user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nickname, email, password })
      });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">注册创作者账号</h1>
          <p className="page-subtitle">MVP 使用邮箱和密码模拟认证，后续可替换为真实账号体系。</p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: 520 }}>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span className="label">昵称</span>
            <input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} />
          </label>
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
              <UserPlus size={18} />
              {loading ? '注册中' : '注册'}
            </button>
            <Link className="button" href="/login">
              返回登录
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}

