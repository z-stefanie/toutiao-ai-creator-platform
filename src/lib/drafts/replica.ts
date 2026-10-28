import type { Draft } from '@/lib/types';
import { normalizeFields, type DraftFields, type DraftKind, type DraftOperation } from '@/lib/drafts/fields';

export type DraftReplica = {
  schemaVersion: 1;
  ownerId: string;
  draftId: string;
  base: { fields: DraftFields; serverVersion: number };
  working: DraftFields;
  localRevision: number;
  ackedRevision: number;
  serverVersion: number;
  pendingKind: DraftKind;
  inFlight?: DraftOperation;
  conflict?: { remote: Draft; detectedAt: string };
  rejected?: { code: string; message: string };
  lastSyncedAt?: string;
  updatedAt: string;
};

export const isDirty = (replica: DraftReplica) => !!replica.inFlight || replica.localRevision > replica.ackedRevision;

export function createReplica(remote: Draft): DraftReplica {
  const fields = normalizeFields(remote);
  return {
    schemaVersion: 1, ownerId: remote.ownerId, draftId: remote.id,
    base: { fields, serverVersion: remote.version }, working: fields,
    localRevision: 0, ackedRevision: 0, serverVersion: remote.version,
    pendingKind: 'edit', lastSyncedAt: remote.lastSavedAt, updatedAt: remote.updatedAt
  };
}

export function reconcile(local: DraftReplica | undefined, remote: Draft | 'not_found' | null): { replica?: DraftReplica; message?: string; error?: string } {
  if (remote === 'not_found') return { error: '草稿不存在或无权访问' };
  let message: string | undefined;
  if (local && local.schemaVersion !== 1) {
    local = undefined;
    message = '本机草稿格式不受支持，已使用云端版本';
  }
  if (!local) return remote ? { replica: createReplica(remote), message } : { error: '当前离线，且本机没有这篇草稿' };
  if (!remote) return { replica: local, message: '离线中，显示的是本机保存的内容' };
  if (local.conflict) return { replica: { ...local, conflict: { ...local.conflict, remote } } };
  if (isDirty(local)) return { replica: local, message: '已恢复本机未同步的修改' };
  return { replica: local.serverVersion === remote.version ? local : createReplica(remote) };
}
