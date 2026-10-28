'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Draft } from '@/lib/types';
import { ApiError, apiFetch } from '@/lib/client-api';
import { openDraftStore, type DraftStore } from '@/lib/drafts/store';
import { isDirty, reconcile } from '@/lib/drafts/replica';
import { DraftSession } from '@/lib/drafts/session';
import { DraftScheduler } from '@/lib/drafts/scheduler';
import { createTransport } from '@/lib/drafts/transport';
import { DraftTabLock } from '@/lib/drafts/tab-lock';

const subscribeEmpty = () => () => {};
const emptySnapshot = () => null;

export function useDraftSync(ownerId: string, draftId: string) {
  const [session, setSession] = useState<DraftSession | null>(null);
  const [error, setError] = useState('');
  const control = useRef<{ save: () => Promise<boolean>; reload: () => Promise<void>; takeOver: () => void } | null>(null);
  const view = useSyncExternalStore(session?.subscribe ?? subscribeEmpty, session?.getSnapshot ?? emptySnapshot, emptySnapshot);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    let current: DraftSession | null = null;
    let store: DraftStore | undefined;
    let lock: DraftTabLock | undefined;
    let scheduler: DraftScheduler | undefined;
    let removeEvents = () => {};
    setSession(null);
    setError('');
    try { void navigator.storage?.persist?.().catch(() => {}); } catch { /* Storage persistence is only an eviction preference. */ }

    async function release() {
      generation += 1;
      scheduler?.stop(); scheduler = undefined;
      removeEvents(); removeEvents = () => {};
      const old = current; current = null;
      if (old) await old.dispose();
    }
    async function load(readOnly: boolean) {
      await release();
      const token = ++generation;
      if (!store || cancelled) return;
      const [local, remote] = await Promise.all([
        store.get(ownerId, draftId),
        apiFetch<{ draft: Draft }>(`/api/drafts/${draftId}`).then((result) => result.draft).catch((failure) => failure instanceof ApiError && failure.status === 404 ? 'not_found' as const : null)
      ]);
      if (cancelled || token !== generation) return;
      const reconciled = reconcile(local, remote);
      if (!reconciled.replica) { setError(reconciled.error ?? '草稿加载失败'); return; }
      const next = new DraftSession(reconciled.replica, store, createTransport(draftId), { persisted: reconciled.replica === local, online: navigator.onLine, readOnly });
      current = next;
      next.setNotice(reconciled.message);
      setSession(next);
      setError('');
      if (readOnly) return;
      await next.persist();
      if (cancelled || token !== generation) return;
      const activeScheduler = new DraftScheduler((mode) => next.flush(mode), () => next.getSnapshot().dirty);
      scheduler = activeScheduler;
      activeScheduler.start();
      const online = () => { next.setOnline(true); void activeScheduler.trigger('normal', true); };
      const offline = () => next.setOnline(false);
      const hidden = () => { void activeScheduler.trigger('hidden'); };
      const visibility = () => { if (document.visibilityState === 'hidden') hidden(); };
      const beforeUnload = (event: BeforeUnloadEvent) => {
        const { dirty, durable, storageFailed } = next.getSnapshot();
        if (dirty && (!durable || storageFailed)) { event.preventDefault(); event.returnValue = ''; }
      };
      window.addEventListener('online', online); window.addEventListener('offline', offline);
      window.addEventListener('pagehide', hidden); document.addEventListener('visibilitychange', visibility);
      window.addEventListener('beforeunload', beforeUnload);
      removeEvents = () => {
        window.removeEventListener('online', online); window.removeEventListener('offline', offline);
        window.removeEventListener('pagehide', hidden); document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('beforeunload', beforeUnload);
      };
      if (isDirty(reconciled.replica) || reconciled.replica.conflict) void activeScheduler.trigger();
    }
    const failed = (failure: unknown) => { if (!cancelled) setError(failure instanceof Error ? failure.message : '本机草稿读取失败'); };
    void openDraftStore().then(async (opened) => {
      if (cancelled) { opened.close(); return; }
      store = opened;
      lock = new DraftTabLock(`draft:${ownerId}:${draftId}`, {
        acquired: () => load(false), released: release,
        beforeYield: async () => {
          const active = current;
          if (!active || active.getSnapshot().frozen) return false;
          active.setFrozen(true);
          const saved = active.getSnapshot().durable ? await active.persist() : await active.flushFully();
          if (!saved) {
            active.setFrozen(false);
            active.setNotice('修改尚未安全保存，暂时无法让出编辑权，请保存后重试');
          }
          return saved;
        },
        waiting: () => { void load(true).catch(failed); }, failed
      });
      control.current = {
        save: async () => {
          const active = current;
          if (!active || active.getSnapshot().readOnly) return false;
          active.allowRetry();
          return (await scheduler?.trigger('normal', true)) === 'success' && !active.getSnapshot().dirty;
        },
        reload: () => lock?.isWriter() ? load(false) : Promise.resolve(),
        takeOver: () => lock?.takeOver()
      };
      lock.start();
    }).catch(failed);
    return () => {
      cancelled = true;
      control.current = null;
      generation += 1;
      void (async () => { await lock?.stop(); await release(); store?.close(); })();
    };
  }, [ownerId, draftId]);

  return { session, view, error,
    save: () => control.current?.save() ?? Promise.resolve(false),
    reload: () => control.current?.reload() ?? Promise.resolve(),
    takeOver: () => control.current?.takeOver()
  };
}
