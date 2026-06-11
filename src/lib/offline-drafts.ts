'use client';

import type { Draft } from '@/lib/types';

export type OfflineDraft = Draft & {
  localUpdatedAt: string;
};

const DB_NAME = 'toutiao-ai-offline-drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDraftDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDraftDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        if (!db) {
          resolve(null);
          return;
        }

        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = action(store);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      })
  );
}

export async function saveOfflineDraft(draft: Draft) {
  const localDraft: OfflineDraft = {
    ...draft,
    localUpdatedAt: new Date().toISOString()
  };
  await withStore('readwrite', (store) => store.put(localDraft));
}

export async function getOfflineDraft(draftId: string): Promise<OfflineDraft | null> {
  return withStore<OfflineDraft>('readonly', (store) => store.get(draftId));
}

export async function removeOfflineDraft(draftId: string) {
  await withStore('readwrite', (store) => store.delete(draftId));
}
