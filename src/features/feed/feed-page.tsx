'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Loader2 } from 'lucide-react';
import { apiFetch, formatDateTime } from '@/lib/client-api';
import type { FeedItem, FeedType, RankingConfig } from '@/lib/types';

const feedMeta: Record<FeedType, { title: string; subtitle: string; endpoint: string }> = {
  hot: {
    title: '热点榜单',
    subtitle: '按质量分、阅读热度和发布时间综合排序，展示当前最值得看的内容。',
    endpoint: '/api/feed/hot'
  },
  viral: {
    title: '爆文榜单',
    subtitle: '优先展示阅读、点赞、评论和分享表现更高的内容。',
    endpoint: '/api/feed/viral'
  },
  recommended: {
    title: '推荐榜单',
    subtitle: '优先展示质量评分更高、结构和信息密度更稳定的内容。',
    endpoint: '/api/feed/recommended'
  }
};

export function FeedPage({ type }: { type: FeedType }) {
  const meta = feedMeta[type];
  const [items, setItems] = useState<FeedItem[]>([]);
  const [rankingConfig, setRankingConfig] = useState<RankingConfig | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (cursor?: string | null) => {
      setLoading(true);
      setError('');
      try {
        const url = cursor ? `${meta.endpoint}?cursor=${cursor}&limit=4` : `${meta.endpoint}?limit=4`;
        const data = await apiFetch<{
          items: FeedItem[];
          nextCursor: string | null;
          rankingConfig: RankingConfig;
        }>(url);
        setItems((current) => (cursor ? [...current, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
        setRankingConfig(data.rankingConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : '榜单加载失败');
      } finally {
        setLoading(false);
      }
    },
    [meta.endpoint]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading) {
        void load(nextCursor);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [load, loading, nextCursor]);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{meta.title}</h1>
          <p className="page-subtitle">{meta.subtitle}</p>
        </div>
        <div className="badge-row">
          <Link className="button" href="/feed/hot">
            热点
          </Link>
          <Link className="button" href="/feed/viral">
            爆文
          </Link>
          <Link className="button" href="/feed/recommended">
            推荐
          </Link>
        </div>
      </div>

      {error ? <div className="notice danger">{error}</div> : null}
      {rankingConfig ? (
        <div className="notice">
          运营权重：质量 {(rankingConfig.weights.quality * 100).toFixed(0)}% · 热度{' '}
          {(rankingConfig.weights.heat * 100).toFixed(0)}% · 新鲜度{' '}
          {(rankingConfig.weights.freshness * 100).toFixed(0)}% · 反馈{' '}
          {(rankingConfig.weights.feedback * 100).toFixed(0)}%
        </div>
      ) : null}

      <section className="feed-list">
        {items.map((item) => (
          <Link className="card" href={`/content/${item.id}?feed=${type}`} key={item.id}>
            <div className="badge-row" style={{ marginBottom: 10 }}>
              <span className="badge success">质量 {item.qualityScore?.total ?? '-'}</span>
              <span className="badge">热度 {item.rankingMetric?.heatScore ?? '-'}</span>
              <span className="badge">反馈 {item.rankingMetric?.feedbackScore ?? '-'}</span>
              <span className="badge">排序 {item.rankingMetric?.activeRankingScore ?? '-'}</span>
              <span className="badge">{formatDateTime(item.publishedAt)}</span>
            </div>
            <h2 className="feed-card-title">
              <Flame size={20} /> {item.title}
            </h2>
            <p className="feed-card-summary">{item.summary}</p>
            <div className="badge-row">
              {item.tags.map((tag) => (
                <span className="badge" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </section>

      <div ref={sentinelRef} style={{ minHeight: 48, paddingTop: 18 }}>
        {loading ? (
          <div className="notice">
            <Loader2 size={16} /> 正在加载更多内容...
          </div>
        ) : nextCursor ? (
          <button className="button" onClick={() => void load(nextCursor)} type="button">
            加载更多
          </button>
        ) : (
          <div className="notice">已加载当前全部内容。发布新内容后会进入这里。</div>
        )}
      </div>
    </main>
  );
}
