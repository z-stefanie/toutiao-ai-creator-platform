import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const registerSchema = loginSchema.extend({
  nickname: z.string().min(1).max(32).optional()
});

export const createPromptSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(240).optional().default(''),
  template: z.string().min(8).max(2400),
  category: z
    .enum(['article', 'short_post', 'review', 'rewrite', 'audit', 'quality'])
    .default('article')
});

export const generateContentSchema = z.object({
  topic: z.string().min(2).max(120),
  audience: z.string().min(1).max(80).default('今日头条读者'),
  tone: z.string().min(1).max(80).default('清晰、有信息量'),
  promptId: z.string().optional(),
  assetIds: z.array(z.string()).default([])
});

export const updateDraftSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(280).default(''),
  body: z.string().min(1),
  tags: z.array(z.string()).default([]),
  assetIds: z.array(z.string()).default([]),
  version: z.number().int().nonnegative().optional()
});

export const syncDraftSchema = z.object({
  changes: updateDraftSchema,
  localUpdatedAt: z.string()
});

export const publishSchema = z.object({
  draftId: z.string()
});

export const rewriteSchema = z.object({
  draftId: z.string()
});

export const rewriteParagraphSchema = z.object({
  draftId: z.string(),
  paragraphIndex: z.number().int().nonnegative()
});
