import { describe, expect, it } from 'vitest';
import { updateDraftSchema } from '@/server/schemas';

describe('draft creation validation', () => {
  it('accepts complete content and supplies optional field defaults', () => {
    expect(updateDraftSchema.parse({ title: '草稿', body: '正文' })).toEqual({
      title: '草稿', body: '正文', summary: '', tags: [], assetIds: []
    });
  });

  it.each([{ title: '', body: '正文' }, { title: '草稿', body: '' }])(
    'rejects incomplete new drafts: %j',
    (input) => expect(updateDraftSchema.safeParse(input).success).toBe(false)
  );

  it('enforces title and summary limits without truncating user content', () => {
    expect(updateDraftSchema.safeParse({ title: '字'.repeat(121), body: '正文' }).success).toBe(false);
    expect(updateDraftSchema.safeParse({ title: '草稿', summary: '字'.repeat(281), body: '正文' }).success).toBe(false);
  });
});
