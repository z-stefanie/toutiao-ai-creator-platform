import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTransport } from '@/lib/drafts/transport';
import { DraftScheduler } from '@/lib/drafts/scheduler';
import { IndexedDraftStore } from '@/lib/drafts/store';
import { createReplica } from '@/lib/drafts/replica';
import { remote } from './draft-fixtures';

const operation = { operationId: 'operation_1', expectedVersion: 1, localRevision: 1, kind: 'edit' as const, fields: remote };
describe('HTTP transport', () => {
  it.each([[400, 'rejected'], [401, 'auth'], [404, 'rejected'], [422, 'rejected'], [429, 'retry'], [500, 'retry'], [503, 'retry']])('maps HTTP %s to %s', async (status, type) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: { code: 'error', message: '原因' } }, { status: Number(status) }));
    expect((await createTransport(remote.id, fetcher)(operation, 'normal')).type).toBe(type);
  });
  it('maps conflict and successful envelopes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ error: { code: 'DRAFT_CONFLICT', details: { current: remote } } }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ ok: true, data: { ack: { operationId: 'operation_1' } } }));
    const transport = createTransport(remote.id, fetcher);
    expect((await transport(operation, 'normal')).type).toBe('conflict');
    expect((await transport(operation, 'normal')).type).toBe('ack');
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ 'Idempotency-Key': 'operation_1' });
  });
  it('classifies a timeout as retryable and sets a 15 second signal', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    expect((await createTransport(remote.id, fetcher)(operation, 'normal')).type).toBe('retry');
    expect(timeout).toHaveBeenCalledWith(15_000); timeout.mockRestore();
  });
  it('allows keepalive only for hidden requests under 60 KiB encoded bytes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 500 }));
    const transport = createTransport(remote.id, fetcher);
    await transport(operation, 'normal'); await transport(operation, 'hidden');
    await transport({ ...operation, fields: { ...remote, body: '字'.repeat(30_000) } }, 'hidden');
    expect(fetcher.mock.calls.map((call) => call[1]?.keepalive)).toEqual([false, true, false]);
  });
  it('treats malformed success envelopes as protocol errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }));
    expect((await createTransport(remote.id, fetcher)(operation, 'normal')).type).toBe('protocol');
  });
});

describe('IndexedDB transaction durability', () => {
  it('waits for transaction complete, not request success', async () => {
    const request = {};
    const tx = { objectStore: () => ({ put: () => request }), oncomplete: () => {}, onerror: () => {}, onabort: () => {} };
    const store = new IndexedDraftStore({ transaction: () => tx } as unknown as IDBDatabase);
    let saved = false;
    const pending = store.put(createReplica(remote)).then(() => { saved = true; });
    await Promise.resolve(); expect(saved).toBe(false); tx.oncomplete(); await pending; expect(saved).toBe(true);
  });
  it('rejects aborted write transactions', async () => {
    const tx = { objectStore: () => ({ put: () => ({}) }), oncomplete: () => {}, onerror: () => {}, onabort: () => {}, error: new Error('abort') };
    const store = new IndexedDraftStore({ transaction: () => tx } as unknown as IDBDatabase);
    const pending = store.put(createReplica(remote)); tx.onabort(); await expect(pending).rejects.toThrow('abort');
  });
});

describe('scheduling and retry', () => {
  afterEach(() => vi.useRealTimers());
  it('30 second ticks send only when dirty', async () => {
    vi.useFakeTimers(); let dirty = false; const flush = vi.fn(async () => 'success' as const);
    const scheduler = new DraftScheduler(flush, () => dirty); scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000); expect(flush).not.toHaveBeenCalled();
    dirty = true; await vi.advanceTimersByTimeAsync(30_000); expect(flush).toHaveBeenCalledTimes(1); scheduler.stop();
  });
  it('exponential jitter doubles, caps at 30 seconds and resets after success or online', async () => {
    vi.useFakeTimers();
    let result: 'retry' | 'success' = 'retry';
    const flush = vi.fn(async () => result);
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    const scheduler = new DraftScheduler(flush, () => true, { setTimeout, clearTimeout, setInterval, clearInterval }, () => 0);
    scheduler.start(); await scheduler.trigger();
    for (const delay of [1000, 2000, 4000, 8000, 15000, 15000]) {
      expect(timeout.mock.calls.at(-1)?.[1]).toBe(delay);
      await vi.advanceTimersByTimeAsync(delay);
    }
    result = 'success'; await scheduler.trigger('normal', true);
    result = 'retry'; await scheduler.trigger(); expect(timeout.mock.calls.at(-1)?.[1]).toBe(1000);
    const count = flush.mock.calls.length; await scheduler.trigger('normal', true); expect(flush).toHaveBeenCalledTimes(count + 1);
    scheduler.stop(); await vi.advanceTimersByTimeAsync(90_000); expect(flush).toHaveBeenCalledTimes(count + 1);
    timeout.mockRestore();
  });
});
