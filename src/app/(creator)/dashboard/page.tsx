'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileText, PenLine, Radio, Sparkles } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { apiFetch, formatDateTime } from '@/lib/client-api';
import type { Draft, FeedItem } from '@/lib/types';

export default function DashboardPage() {
  return (
    <AuthGate>
      {(user) => <DashboardContent nickname={user.nickname} />}
    </AuthGate>
  );
}

function DashboardContent({ nickname }: { nickname: string }) {
  const [latestDraft, setLatestDraft] = useState<Draft | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    void apiFetch<{ draft: Draft | null }>('/api/drafts/latest').then((data) => setLatestDraft(data.draft));
    void apiFetch<{ items: FeedItem[]; nextCursor: string | null }>('/api/feed/hot?limit=4').then((data) =>
      setItems(data.items)
    );
  }, []);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{nickname}，今天从一条可发布链路开始</h1>
          <p className="page-subtitle">工作台聚合创作入口、草稿状态、已发布内容和榜单反馈。</p>
        </div>
        <Link className="button primary" href="/create">
          <Sparkles size={18} />
          AI 创作
        </Link>
      </div>

      <section className="metric-row" aria-label="内容概览">
        <div className="metric">
          <strong>{items.length}</strong>
          <span className="meta">榜单内容样例</span>
        </div>
        <div className="metric">
          <strong>{latestDraft ? '1' : '0'}</strong>
          <span className="meta">最近草稿</span>
        </div>
        <div className="metric">
          <strong>Mock</strong>
          <span className="meta">AI 生成/审核模式</span>
        </div>
        <div className="metric">
          <strong>30s</strong>
          <span className="meta">编辑器自动保存</span>
        </div>
      </section>

      <div className="grid two" style={{ marginTop: 18 }}>
        <section className="panel">
          <h2>继续创作</h2>
          {latestDraft ? (
            <div className="stack">
              <h3>{latestDraft.title}</h3>
              <p className="meta">最近保存：{formatDateTime(latestDraft.lastSavedAt)} · 版本 {latestDraft.version}</p>
              <p>{latestDraft.summary || latestDraft.body.slice(0, 100)}</p>
              <Link className="button" href={`/editor/${latestDraft.id}`}>
                <PenLine size={17} />
                打开草稿
              </Link>
            </div>
          ) : (
            <div className="notice">暂无草稿。可以从 AI 创作页生成第一篇图文。</div>
          )}
        </section>
        <section className="panel">
          <h2>发布后的分发信号</h2>
          <div className="stack">
            {items.map((item) => (
              <Link className="card" href={`/content/${item.id}`} key={item.id}>
                <div className="badge-row" style={{ marginBottom: 8 }}>
                  <span className="badge success">质量 {item.qualityScore?.total ?? '-'}</span>
                  <span className="badge">排序 {item.rankingMetric?.rankingScore ?? '-'}</span>
                </div>
                <strong>{item.title}</strong>
                <p className="meta">{item.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="grid three" style={{ marginTop: 18 }}>
        <Link className="card" href="/prompts">
          <FileText size={22} />
          <h3>Prompt 管理</h3>
          <p className="meta">维护创作模板，为 AI 生成提供稳定上下文。</p>
        </Link>
        <Link className="card" href="/assets">
          <Radio size={22} />
          <h3>素材管理</h3>
          <p className="meta">查看演示素材和基础合规状态。</p>
        </Link>
        <Link className="card" href="/feed/hot">
          <Sparkles size={22} />
          <h3>热点榜单</h3>
          <p className="meta">发布内容后进入排序分发场景。</p>
        </Link>
      </div>
    </main>
  );
}

