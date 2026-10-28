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

export const draftOperationSchema = z.object({
  expectedVersion: z.number().int().positive(),
  localRevision: z.number().int().positive(),
  kind: z.enum(['edit', 'merge', 'restore']),
  fields: z.object({
    title: z.string().max(120),
    summary: z.string().max(280),
    body: z.string().max(100000),
    tags: z.array(z.string()).max(50),
    assetIds: z.array(z.string()).max(50)
  })
});

export const publishSchema = z.object({
  draftId: z.string(),
  version: z.number().int().positive().optional()
});

export const rewriteSchema = z.object({
  draftId: z.string(),
  title: z.string().max(120),
  summary: z.string().max(280),
  body: z.string().max(100000)
});

export const rewriteParagraphSchema = z.object({
  draftId: z.string(),
  paragraphIndex: z.number().int().nonnegative(),
  paragraph: z.string().min(1).max(5000)
});
