import { normalizeFields, sameFields, type DraftFields, type DraftKind, type DraftOperation } from '@/lib/drafts/fields';
import { mergeDraft, type MergeSuggestion } from '@/lib/drafts/merge';
import { isDirty, type DraftReplica } from '@/lib/drafts/replica';
import type { DraftStore } from '@/lib/drafts/store';
import type { DraftTransport, FlushMode } from '@/lib/drafts/transport';

export type FlushResult = 'success' | 'retry' | 'blocked' | 'offline';
export type SessionView = {
  replica: DraftReplica;
  persistedRevision: number;
  status: string;
  badge: string;
  notice?: string;
  merge?: MergeSuggestion;
  durable: boolean;
  frozen: boolean;
  readOnly: boolean;
  dirty: boolean;
};

export class DraftSession {
  private replica: DraftReplica;
  private listeners = new Set<() => void>();
  private view!: SessionView;
  private persistedRevision = -1;
  private generation = 0;
  private storedGeneration = -1;
  private writing: Promise<boolean> | null = null;
  private syncing: Promise<FlushResult> | null = null;
  private rerun = false;
  private disposed = false;
  private frozen = false;
  private readOnly = false;
  private online = true;
  private saving = false;
  private storageError?: string;
  private failure?: 'retry' | 'auth';
  private notice?: string;
  private kindRevision: number;

  constructor(replica: DraftReplica, private store: DraftStore, private transport: DraftTransport,
    private options: { now?: () => string; operationId?: () => string; persisted?: boolean; online?: boolean; readOnly?: boolean } = {}) {
    this.replica = structuredClone(replica);
    this.kindRevision = replica.localRevision;
    this.online = options.online ?? true;
    this.readOnly = options.readOnly ?? false;
    if (options.persisted && store.durable) {
      this.persistedRevision = replica.localRevision;
      this.storedGeneration = 0;
    }
    this.refresh();
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.view;
  private now() { return this.options.now?.() ?? new Date().toISOString(); }
  private refresh() {
    const r = this.replica;
    const dirty = isDirty(r);
    const localSaved = this.store.durable && this.persistedRevision >= r.localRevision;
    let status = `已同步到云端 · 版本 ${r.serverVersion}`;
    let badge = '已同步';
    if (dirty) {
      status = localSaved ? '已保存到本机，等待同步' : '编辑中…'; badge = '待同步';
    }
    if (!this.online) {
      status = !this.store.durable ? '离线中：本机存储不可用，请不要关闭页面' : localSaved ? '离线中：修改已保存在本机，联网后自动同步' : '编辑中…';
      badge = '离线';
    } else if (this.saving) { status = '正在同步到云端…'; badge = '同步中'; }
    else if (this.failure === 'retry') { status = '同步失败，稍后自动重试'; badge = '待同步'; }
    else if (this.failure === 'auth') {
      status = this.store.durable && localSaved ? '登录已失效，请重新登录后继续同步（修改已保存在本机）' : '登录已失效，请重新登录后继续同步（请不要关闭页面）'; badge = '待同步';
    }
    if (r.rejected) { status = `同步被拒绝：${r.rejected.message}`; badge = '待同步'; }
    if (this.storageError) { status = `本机保存失败：${this.storageError}`; badge = '待同步'; }
    if (r.conflict) { status = '云端有更新的版本，需要处理冲突'; badge = '冲突'; }
    if (this.readOnly) { status = '这篇草稿正在另一个标签页中编辑'; badge = '只读'; }
    this.view = { replica: r, persistedRevision: this.persistedRevision, status, badge, notice: this.notice,
      merge: r.conflict ? mergeDraft(r.base.fields, r.working, r.conflict.remote) : undefined,
      durable: this.store.durable, frozen: this.frozen, readOnly: this.readOnly, dirty };
    this.listeners.forEach((listener) => listener());
  }
  private change(next: DraftReplica) {
    this.replica = { ...next, updatedAt: this.now() };
    this.generation += 1;
    this.refresh();
  }
  edit(fields: DraftFields, kind: DraftKind = 'edit') {
    if (this.disposed || this.readOnly || this.frozen || this.replica.conflict) return false;
    const working = normalizeFields(fields);
    if (sameFields(working, this.replica.working)) return false;
    const revision = this.replica.localRevision + 1;
    if (kind !== 'edit') this.kindRevision = revision;
    this.failure = undefined;
    this.change({ ...this.replica, working, localRevision: revision, rejected: undefined,
      pendingKind: kind === 'edit' ? this.replica.pendingKind : kind });
    void this.persist();
    return true;
  }
  setOnline(online: boolean) { this.online = online; this.refresh(); }
  setFrozen(frozen: boolean) { this.frozen = frozen; this.refresh(); }
  setNotice(notice: string | undefined) { this.notice = notice; this.refresh(); }
  allowRetry() {
    this.failure = undefined;
    if (this.replica.rejected) this.change({ ...this.replica, rejected: undefined });
    else this.refresh();
  }

  persist(): Promise<boolean> {
    if (this.writing) return this.writing;
    this.writing = this.writeLatest();
    return this.writing;
  }
  private async writeLatest() {
    await Promise.resolve();
    try {
      while (this.storedGeneration < this.generation) {
        const generation = this.generation;
        const copy = structuredClone(this.replica);
        await this.store.put(copy);
        this.storedGeneration = generation;
        if (this.store.durable) this.persistedRevision = Math.max(this.persistedRevision, copy.localRevision);
        this.storageError = undefined;
        this.refresh();
      }
      return true;
    } catch (error) {
      this.storageError = error instanceof Error ? error.message : '写入失败';
      this.refresh();
      return false;
    } finally { this.writing = null; }
  }

  flush(mode: FlushMode = 'normal'): Promise<FlushResult> {
    if (this.syncing) { this.rerun = true; return this.syncing; }
    this.syncing = this.drain(mode);
    return this.syncing;
  }
  private async drain(mode: FlushMode): Promise<FlushResult> {
    // Yield before touching the cached promise, including the no-op path.
    await Promise.resolve();
    let result: FlushResult = 'success';
    try {
      do {
        this.rerun = false;
        result = await this.sendOne(mode);
      } while (this.rerun && result === 'success' && !this.disposed);
      return result;
    } finally {
      this.syncing = null;
      this.saving = false;
      this.refresh();
    }
  }
  private async sendOne(mode: FlushMode): Promise<FlushResult> {
    if (this.disposed || this.readOnly || this.replica.rejected) return 'blocked';
    if (this.replica.conflict) {
      const suggestion = mergeDraft(this.replica.base.fields, this.replica.working, this.replica.conflict.remote);
      if (suggestion.conflicts.length) return 'blocked';
      this.resolveConflict(suggestion.fields, suggestion.remoteChanges);
    }
    if (!this.online) { await this.persist(); return 'offline'; }
    if (!this.replica.inFlight) {
      if (!isDirty(this.replica)) return 'success';
      if (sameFields(this.replica.working, this.replica.base.fields)) {
        this.change({ ...this.replica, ackedRevision: this.replica.localRevision, pendingKind: 'edit' });
        await this.persist();
        return 'success';
      }
      if (mode !== 'hidden' && !await this.persist()) return 'blocked';
      if (this.disposed) return 'blocked';
      const operation: DraftOperation = {
        operationId: this.options.operationId?.() ?? crypto.randomUUID(),
        expectedVersion: this.replica.serverVersion, localRevision: this.replica.localRevision,
        kind: this.replica.pendingKind, fields: structuredClone(this.replica.working)
      };
      this.change({ ...this.replica, inFlight: operation });
      const durable = this.persist();
      if (mode !== 'hidden' && !await durable) return 'blocked';
    }
    const operation = this.replica.inFlight;
    if (!operation || this.disposed) return 'blocked';
    this.saving = true;
    this.failure = undefined;
    this.refresh();
    const result = await this.transport(operation, mode).catch(() => ({ type: 'retry' as const }));
    if (this.disposed) return 'blocked';
    this.saving = false;
    if (result.type === 'ack') {
      const ack = result.ack;
      if (ack.operationId !== operation.operationId || ack.localRevision !== operation.localRevision || ack.serverVersion !== operation.expectedVersion + 1 || !Number.isFinite(Date.parse(ack.savedAt))) {
        this.change({ ...this.replica, rejected: { code: 'INVALID_ACK', message: '服务器确认与本次修改不匹配' } });
        await this.persist();
        return 'blocked';
      }
      this.change({ ...this.replica, ackedRevision: Math.max(this.replica.ackedRevision, operation.localRevision),
        serverVersion: ack.serverVersion, base: { fields: operation.fields, serverVersion: ack.serverVersion }, inFlight: undefined,
        pendingKind: this.kindRevision <= operation.localRevision ? 'edit' : this.replica.pendingKind, lastSyncedAt: ack.savedAt });
      await this.persist();
      return 'success';
    }
    if (result.type === 'conflict') {
      this.change({ ...this.replica, inFlight: undefined, conflict: { remote: result.current, detectedAt: this.now() } });
      const suggestion = mergeDraft(this.replica.base.fields, this.replica.working, result.current);
      if (!suggestion.conflicts.length) {
        this.resolveConflict(suggestion.fields, suggestion.remoteChanges);
        this.rerun = isDirty(this.replica);
        await this.persist();
        return 'success';
      }
    } else if (result.type === 'rejected') {
      this.change({ ...this.replica, inFlight: undefined, rejected: { code: result.code, message: result.message } });
    } else if (result.type === 'protocol') {
      this.change({ ...this.replica, rejected: { code: 'PROTOCOL_ERROR', message: result.message } });
    } else {
      this.failure = result.type === 'auth' ? 'auth' : 'retry';
      this.refresh();
      return result.type === 'auth' ? 'blocked' : 'retry';
    }
    await this.persist();
    return 'blocked';
  }

  resolveConflict(fields: DraftFields, remoteChanges: string[] = []) {
    const remote = this.replica.conflict?.remote;
    if (!remote || this.readOnly || this.disposed) return;
    const working = normalizeFields(fields);
    const matches = sameFields(working, remote);
    const revision = this.replica.localRevision + (matches ? 0 : 1);
    this.kindRevision = revision;
    this.notice = matches ? undefined : `已合并云端的${remoteChanges.join('、') || '修改'}`;
    this.change({ ...this.replica, working, base: { fields: normalizeFields(remote), serverVersion: remote.version },
      serverVersion: remote.version, conflict: undefined, rejected: undefined, inFlight: undefined,
      localRevision: revision, ackedRevision: matches ? revision : this.replica.ackedRevision,
      pendingKind: matches ? 'edit' : 'merge', lastSyncedAt: matches ? remote.lastSavedAt : this.replica.lastSyncedAt });
    void this.persist();
    if (!matches) void this.flush();
  }

  async flushFully() {
    this.allowRetry();
    for (let round = 0; round < 3; round += 1) {
      if (await this.flush() !== 'success') return false;
      if (!isDirty(this.replica) && !this.replica.conflict && !this.replica.rejected) return true;
    }
    return false;
  }
  async dispose() {
    this.disposed = true;
    this.frozen = true;
    this.refresh();
    if (!this.readOnly) await this.persist();
    this.listeners.clear();
  }
}
