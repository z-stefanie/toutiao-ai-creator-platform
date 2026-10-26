import type { Draft as PrismaDraft } from '@prisma/client';
import type { Draft } from '@/lib/types';

export function mapDraft(draft: PrismaDraft): Draft {
  return {
    id: draft.id,
    ownerId: draft.ownerId,
    contentId: draft.contentId ?? undefined,
    title: draft.title,
    summary: draft.summary,
    body: draft.body,
    assetIds: JSON.parse(draft.assetIdsJson) as string[],
    tags: JSON.parse(draft.tagsJson) as string[],
    version: draft.version,
    syncStatus: draft.syncStatus as Draft['syncStatus'],
    lastSavedAt: draft.lastSavedAt.toISOString(),
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString()
  };
}
