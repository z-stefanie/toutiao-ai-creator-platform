import type { Content, QualityScore, RankingMetric } from '@/lib/types';
import { calculateFeedbackScore, calculateWeightedRankingScore, getRankingConfig } from '@/lib/ranking-config';
import { timestamp } from '@/server/utils/id';

export function calculateRankingMetric(content: Content, qualityScore: QualityScore): RankingMetric {
  const randomSeed = content.id.charCodeAt(content.id.length - 1) || 4;
  const viewCount = 600 + randomSeed * 137;
  const likeCount = 40 + randomSeed * 9;
  const commentCount = 10 + randomSeed * 2;
  const shareCount = 8 + randomSeed * 2;
  const heatScore = Math.min(96, Math.round(viewCount / 32 + likeCount / 4 + commentCount + shareCount));
  const feedbackScore = calculateFeedbackScore({ likeCount, commentCount, shareCount });
  const publishedAt = content.publishedAt ? new Date(content.publishedAt).getTime() : Date.now();
  const ageHours = Math.max(0, (Date.now() - publishedAt) / 1000 / 60 / 60);
  const freshnessScore = Math.max(50, Math.round(100 - ageHours * 2));
  const hotConfig = getRankingConfig('hot');
  const rankingScore = calculateWeightedRankingScore(
    {
      contentId: content.id,
      qualityScore: qualityScore.total,
      viewCount,
      likeCount,
      commentCount,
      shareCount,
      heatScore,
      freshnessScore,
      feedbackScore,
      rankingScore: 0,
      calculatedAt: timestamp()
    },
    hotConfig
  );

  return {
    contentId: content.id,
    qualityScore: qualityScore.total,
    viewCount,
    likeCount,
    commentCount,
    shareCount,
    heatScore,
    freshnessScore,
    feedbackScore,
    rankingScore,
    calculatedAt: timestamp()
  };
}
