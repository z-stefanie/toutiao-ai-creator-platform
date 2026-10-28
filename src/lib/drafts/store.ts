import type { DraftReplica } from '@/lib/drafts/replica';

export interface DraftStore {
  readonly durable: boolean;
  get(ownerId: string, draftId: string): Promise<DraftReplica | undefined>;
  put(replica: DraftReplica): Promise<void>;
  close(): void;
}

export class MemoryDraftStore implements DraftStore {
  readonly durable: boolean = false;
  private replicas = new Map<string, DraftReplica>();
  async get(ownerId: string, draftId: string) {
    return structuredClone(this.replicas.get(JSON.stringify([ownerId, draftId])));
  }
  async put(replica: DraftReplica) {
    this.replicas.set(JSON.stringify([replica.ownerId, replica.draftId]), structuredClone(replica));
  }
  close() {}
}

export class IndexedDraftStore implements DraftStore {
  readonly durable = true;
  constructor(private db: IDBDatabase) {}
  get(ownerId: string, draftId: string): Promise<DraftReplica | undefined> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('replicas', 'readonly');
      const request = tx.objectStore('replicas').get([ownerId, draftId]);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('本机读取事务已中止'));
    });
  }
  put(replica: DraftReplica): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('replicas', 'readwrite');
      tx.objectStore('replicas').put(replica);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('本机写入事务已中止'));
    });
  }
  close() { this.db.close(); }
}

export async function openDraftStore(): Promise<DraftStore> {
  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('toutiao-drafts', 1);
      let abandoned = false;
      request.onupgradeneeded = () => {
        request.result.createObjectStore('replicas', { keyPath: ['ownerId', 'draftId'] });
      };
      request.onsuccess = () => {
        if (abandoned) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { abandoned = true; reject(new Error('本机数据库被占用')); };
    });
    return new IndexedDraftStore(db);
  } catch {
    return new MemoryDraftStore();
  }
}
