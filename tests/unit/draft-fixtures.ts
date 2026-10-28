import type { Draft } from '@/lib/types';
import type { DraftOperation } from '@/lib/drafts/fields';
import { MemoryDraftStore } from '@/lib/drafts/store';

export const remote: Draft = {
  id: 'draft_test', ownerId: 'user_test', title: '标题', summary: '摘要', body: '一\n\n二\n\n三',
  tags: ['原有'], assetIds: ['asset_a'], version: 1, syncStatus: 'synced',
  lastSavedAt: '2026-10-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z'
};
export const acknowledge = (op: DraftOperation) => ({ type: 'ack' as const, ack: {
  operationId: op.operationId, localRevision: op.localRevision, serverVersion: op.expectedVersion + 1, savedAt: remote.lastSavedAt
} });
export class DurableStore extends MemoryDraftStore { override readonly durable = true; }
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export async function ticks() { for (let i = 0; i < 20; i += 1) await Promise.resolve(); }
