import type { FeedType, RankingConfig, RankingMetric } from '@/lib/types';

export const rankingConfigs: Record<FeedType, RankingConfig> = {
  hot: {
    type: 'hot',
    title: '热点榜单',
    description: '综合质量、热度、新鲜度和反馈，适合展示当前最值得看的内容。',
    weights: {
      quality: 0.4,
      heat: 0.3,
      freshness: 0.2,
      feedback: 0.1
    }
  },
  viral: {
    type: 'viral',
    title: '爆文榜单',
    description: '强化实时热度和用户反馈，适合观察传播表现。',
    weights: {
      quality: 0.2,
      heat: 0.45,
      freshness: 0.1,
      feedback: 0.25
    }
  },
  recommended: {
    type: 'recommended',
    title: '推荐榜单',
    description: '强化质量分和反馈信号，避免只按短期热度排序。',
    weights: {
      quality: 0.55,
      heat: 0.15,
      freshness: 0.15,
      feedback: 0.15
    }
  }
};

export function getRankingConfig(type: FeedType): RankingConfig {
  return rankingConfigs[type] ?? rankingConfigs.hot;
}

export function calculateFeedbackScore(metric: Pick<RankingMetric, 'likeCount' | 'commentCount' | 'shareCount'>) {
  return Math.min(96, Math.round(metric.likeCount / 3 + metric.commentCount * 1.5 + metric.shareCount * 2));
}

export function calculateWeightedRankingScore(metric: RankingMetric, config: RankingConfig) {
  const feedbackScore = metric.feedbackScore ?? calculateFeedbackScore(metric);
  return Number(
    (
      metric.qualityScore * config.weights.quality +
      metric.heatScore * config.weights.heat +
      metric.freshnessScore * config.weights.freshness +
      feedbackScore * config.weights.feedback
    ).toFixed(1)
  );
}
