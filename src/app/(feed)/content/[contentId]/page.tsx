'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, formatDateTime } from '@/lib/client-api';
import type { FeedItem, FeedType, RankingConfig } from '@/lib/types';

export default function ContentDetailPage() {
  const params = useParams<{ contentId: string }>();
  const searchParams = useSearchParams();
  const feedType = readFeedType(searchParams.get('feed'));
  const [content, setContent] = useState<FeedItem | null>(null);
  const [rankingConfig, setRankingConfig] = useState<RankingConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiFetch<{ content: FeedItem; rankingConfig: RankingConfig }>(
      `/api/feed/${params.contentId}?feed=${feedType}`
    )
      .then((data) => {
        setContent(data.content);
        setRankingConfig(data.rankingConfig);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '内容加载失败'));
  }, [feedType, params.contentId]);

  if (error) {
    return (
      <main className="page">
        <div className="notice danger">{error}</div>
      </main>
    );
  }

  if (!content) {
    return (
      <main className="page">
        <div className="notice">正在加载内容详情...</div>
      </main>
    );
  }

  return (
    <main className="page article">
      <div className="page-header">
        <div>
          <div className="badge-row" style={{ marginBottom: 12 }}>
            <span className="badge success">质量 {content.qualityScore?.total ?? '-'}</span>
            <span className="badge">排序 {content.rankingMetric?.activeRankingScore ?? '-'}</span>
            <span className="badge">热度 {content.rankingMetric?.heatScore ?? '-'}</span>
            <span className="badge">反馈 {content.rankingMetric?.feedbackScore ?? '-'}</span>
          </div>
          <h1 className="page-title">{content.title}</h1>
          <p className="page-subtitle">
            {content.author.nickname} · {formatDateTime(content.publishedAt)}
          </p>
        </div>
        {content.draftId ? (
          <Link className="button" href={`/editor/${content.draftId}`}>
            编辑已发布内容
          </Link>
        ) : null}
      </div>

      {content.coverUrl ? (
        <Image
          alt={content.title}
          src={content.coverUrl}
          width={960}
          height={540}
          priority
          style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid var(--line)' }}
        />
      ) : null}

      <article className="panel" style={{ marginTop: 18 }}>
        <p className="article-body">{content.body}</p>
      </article>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>排序解释</h2>
        {rankingConfig ? (
          <p className="meta">
            {rankingConfig.title}权重：质量 {(rankingConfig.weights.quality * 100).toFixed(0)}% · 热度{' '}
            {(rankingConfig.weights.heat * 100).toFixed(0)}% · 新鲜度{' '}
            {(rankingConfig.weights.freshness * 100).toFixed(0)}% · 反馈{' '}
            {(rankingConfig.weights.feedback * 100).toFixed(0)}%
          </p>
        ) : null}
        <p className="meta">activeRankingScore = quality * w1 + heat * w2 + freshness * w3 + feedback * w4</p>
        <div className="metric-row">
          <div className="metric">
            <strong>{content.qualityScore?.total ?? '-'}</strong>
            <span className="meta">质量分</span>
          </div>
          <div className="metric">
            <strong>{content.rankingMetric?.heatScore ?? '-'}</strong>
            <span className="meta">热度分</span>
          </div>
          <div className="metric">
            <strong>{content.rankingMetric?.freshnessScore ?? '-'}</strong>
            <span className="meta">新鲜度</span>
          </div>
          <div className="metric">
            <strong>{content.rankingMetric?.feedbackScore ?? '-'}</strong>
            <span className="meta">反馈分</span>
          </div>
          <div className="metric">
            <strong>{content.rankingMetric?.activeRankingScore ?? '-'}</strong>
            <span className="meta">当前榜单排序分</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function readFeedType(value: string | null): FeedType {
  return value === 'viral' || value === 'recommended' ? value : 'hot';
}
