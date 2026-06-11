'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Draft } from '@/lib/types';
import { apiFetch } from '@/lib/client-api';
import { saveOfflineDraft } from '@/lib/offline-drafts';

type DraftPayload = Pick<Draft, 'title' | 'summary' | 'body' | 'tags' | 'assetIds'> & {
  version?: number;
};

export function useAutosaveDraft(
  draftId: string | null,
  payload: DraftPayload | null,
  serverDraft: Draft | null,
  onDraftSaved?: (draft: Draft) => void
) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'local_pending' | 'error'>('idle');
  const [message, setMessage] = useState('等待编辑');
  const latestPayloadRef = useRef(payload);
  const latestDraftRef = useRef(serverDraft);
  const onDraftSavedRef = useRef(onDraftSaved);
  const syncingRef = useRef(false);

  useEffect(() => {
    latestPayloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    latestDraftRef.current = serverDraft;
  }, [serverDraft]);

  useEffect(() => {
    onDraftSavedRef.current = onDraftSaved;
  }, [onDraftSaved]);

  const saveLocalPending = useCallback(async (reason: string) => {
    if (!latestDraftRef.current || !latestPayloadRef.current) return null;
    const now = new Date().toISOString();
    const localDraft: Draft = {
      ...latestDraftRef.current,
      ...latestPayloadRef.current,
      syncStatus: 'local_pending',
      lastSavedAt: now,
      updatedAt: now
    };
    await saveOfflineDraft(localDraft);
    latestDraftRef.current = localDraft;
    onDraftSavedRef.current?.(localDraft);
    setStatus('local_pending');
    setMessage(reason);
    return localDraft;
  }, []);

  const syncPending = useCallback(async () => {
    if (!draftId || !latestPayloadRef.current) return null;
    if (syncingRef.current) return null;
    syncingRef.current = true;
    setStatus('saving');
    setMessage('正在同步离线草稿...');
    try {
      const data = await apiFetch<{ draft: Draft; syncedAt: string }>(`/api/drafts/${draftId}/sync`, {
        method: 'POST',
        body: JSON.stringify({
          changes: latestPayloadRef.current,
          localUpdatedAt: new Date().toISOString()
        })
      });
      await saveOfflineDraft(data.draft);
      latestDraftRef.current = data.draft;
      latestPayloadRef.current = {
        ...latestPayloadRef.current,
        version: data.draft.version
      };
      onDraftSavedRef.current?.(data.draft);
      setStatus('saved');
      setMessage(`离线草稿已同步，版本 ${data.draft.version}`);
      return data.draft;
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '离线草稿同步失败');
      return null;
    } finally {
      syncingRef.current = false;
    }
  }, [draftId]);

  const saveNow = useCallback(async () => {
    if (!draftId || !latestPayloadRef.current) return null;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return saveLocalPending('离线草稿已保存到本地，恢复网络后会自动同步。');
    }
    setStatus('saving');
    setMessage('正在保存草稿...');
    try {
      const data = await apiFetch<{ draft: Draft }>(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        body: JSON.stringify(latestPayloadRef.current)
      });
      await saveOfflineDraft(data.draft);
      latestDraftRef.current = data.draft;
      latestPayloadRef.current = {
        ...latestPayloadRef.current,
        version: data.draft.version
      };
      onDraftSavedRef.current?.(data.draft);
      setStatus('saved');
      setMessage(`草稿已保存，版本 ${data.draft.version}`);
      return data.draft;
    } catch (error) {
      if (error instanceof TypeError) {
        return saveLocalPending('网络不可用，草稿已保存到本地并标记为 local_pending。');
      }
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '草稿保存失败');
      return null;
    }
  }, [draftId, saveLocalPending]);

  useEffect(() => {
    if (!serverDraft || !payload) return;
    const nextSyncStatus =
      typeof navigator !== 'undefined' && !navigator.onLine ? 'local_pending' : serverDraft.syncStatus;
    const localDraft: Draft = {
      ...serverDraft,
      ...payload,
      syncStatus: nextSyncStatus
    };
    void saveOfflineDraft(localDraft);
    if (nextSyncStatus === 'local_pending') {
      latestDraftRef.current = localDraft;
      setStatus('local_pending');
      setMessage('离线编辑已写入本地镜像，恢复网络后会自动同步。');
    }
  }, [payload, serverDraft]);

  useEffect(() => {
    if (!draftId) return;
    const timer = window.setInterval(() => {
      void saveNow();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [draftId, saveNow]);

  useEffect(() => {
    if (!draftId) return;
    const handleOnline = () => {
      if (latestDraftRef.current?.syncStatus === 'local_pending') {
        void syncPending();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [draftId, syncPending]);

  return { status, message, saveNow, syncPending };
}
