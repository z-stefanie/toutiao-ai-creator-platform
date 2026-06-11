import { z } from 'zod';

export const generatedContentOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  coverSuggestion: z.string().default('使用最能呈现主题场景的首张素材作为封面。'),
  imageSuggestions: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  reasoningSummary: z.string().default('')
});

export const auditOutputSchema = z.object({
  passed: z.boolean(),
  riskLevel: z.enum(['none', 'low', 'medium', 'high']),
  categories: z.array(z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other'])).default([]),
  hitSpans: z
    .array(
      z.object({
        text: z.string(),
        category: z.enum(['porn', 'gambling', 'drug', 'sensitive', 'vulgar', 'other']),
        reason: z.string()
      })
    )
    .default([]),
  action: z.enum(['allow', 'warn', 'block', 'rewrite_required']),
  suggestion: z.string()
});

export const rewriteOutputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  changedSpans: z
    .array(
      z.object({
        before: z.string(),
        after: z.string(),
        reason: z.string()
      })
    )
    .default([])
});

export const qualityScoreOutputSchema = z.object({
  total: z.number().int().min(0).max(100),
  dimensions: z.object({
    originality: z.number().int().min(0).max(100),
    structure: z.number().int().min(0).max(100),
    readability: z.number().int().min(0).max(100),
    informationDensity: z.number().int().min(0).max(100),
    titleAttraction: z.number().int().min(0).max(100),
    imageTextMatch: z.number().int().min(0).max(100)
  }),
  reasons: z.array(z.string()).default([]),
  improvementSuggestions: z.array(z.string()).default([])
});

export type GeneratedContentOutput = z.infer<typeof generatedContentOutputSchema>;
export type AuditOutput = z.infer<typeof auditOutputSchema>;
export type RewriteOutput = z.infer<typeof rewriteOutputSchema>;
export type QualityScoreOutput = z.infer<typeof qualityScoreOutputSchema>;
