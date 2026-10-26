import { describe, expect, it, vi } from 'vitest';
import { DraftSession } from '@/lib/drafts/session';
import { createReplica } from '@/lib/drafts/replica';
import { MemoryDraftStore } from '@/lib/drafts/store';
import type { DraftTransport, TransportResult } from '@/lib/drafts/transport';
import { acknowledge, deferred, DurableStore, remote, ticks } from './draft-fixtures';

function setup(transport: DraftTransport = async (op) => acknowledge(op), store = new DurableStore()) {
  const send = vi.fn(transport);
  const session = new DraftSession(createReplica(remote), store, send, { persisted: true });
  return { session, send, store, edit: (body = '新的正文') => session.edit({ ...remote, body }) };
}

describe('DraftSession', () => {
  it('edits synchronously and caches views; equivalent edits are no-ops', () => {
    const { session, edit } = setup();
    const old = session.getSnapshot();
    expect(session.getSnapshot()).toBe(old);
    edit();
    expect(session.getSnapshot().replica.working.body).toBe('新的正文');
    expect(session.getSnapshot().replica.localRevision).toBe(1);
    const updated = session.getSnapshot();
    edit();
    expect(session.getSnapshot()).toBe(updated);
  });
  it('coalesces 100 keystrokes and announces persistence only after commit', async () => {
    const store = new DurableStore();
    const gate = deferred<void>();
    const original = store.put.bind(store);
    const put = vi.spyOn(store, 'put').mockImplementationOnce(async (replica) => { await gate.promise; await original(replica); });
    const { session, edit } = setup(undefined, store);
    edit('first');
    await ticks();
    for (let i = 0; i < 100; i += 1) edit(`edit-${i}`);
    expect(session.getSnapshot().status).toBe('编辑中…');
    gate.resolve();
    await session.persist();
    expect(put).toHaveBeenCalledTimes(2);
    expect((await store.get(remote.ownerId, remote.id))?.working.body).toBe('edit-99');
    expect(session.getSnapshot().status).toBe('已保存到本机，等待同步');
  });
  it('recovers from an empty flush and permits later sends', async () => {
    const { session, send, edit } = setup();
    await session.flush(); await session.flush();
    edit(); await session.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().replica.serverVersion).toBe(2);
  });
  it('single-flight coalesces triggers into at most one additional round', async () => {
    const response = deferred<TransportResult>();
    const { session, send, edit } = setup(async (op) => op.localRevision === 1 ? response.promise : acknowledge(op));
    edit(); const first = session.flush(); await ticks();
    edit('later');
    for (let i = 0; i < 10; i += 1) expect(session.flush()).toBe(first);
    response.resolve(acknowledge(send.mock.calls[0][0]));
    await first;
    expect(send).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().dirty).toBe(false);
  });
  it('late ACK confirms only the sent revision without overwriting newer typing', async () => {
    const response = deferred<TransportResult>();
    const { session, send, edit } = setup(() => response.promise);
    edit(); const first = session.flush(); await ticks(); edit('later');
    response.resolve(acknowledge(send.mock.calls[0][0])); await first;
    expect(send).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().replica).toMatchObject({ ackedRevision: 1, localRevision: 2, working: { body: 'later' } });
    expect(session.getSnapshot().badge).toBe('待同步');
  });
  it.each(['operationId', 'localRevision', 'serverVersion'] as const)('refuses mismatching ACK %s', async (key) => {
    const { session, edit } = setup(async (op) => {
      const result = acknowledge(op); Object.assign(result.ack, { [key]: key === 'operationId' ? 'wrong' : 999 }); return result;
    });
    edit(); expect(await session.flush()).toBe('blocked');
    expect(session.getSnapshot().replica.ackedRevision).toBe(0);
    expect(session.getSnapshot().replica.inFlight).toBeDefined();
    expect(session.getSnapshot().replica.rejected?.code).toBe('INVALID_ACK');
  });
  it('replays the exact operation after response loss, including after reopening', async () => {
    const { session, edit, send, store } = setup(async () => ({ type: 'retry' }));
    edit(); await session.flush();
    const operation = send.mock.calls[0][0];
    const local = await store.get(remote.ownerId, remote.id);
    expect(local?.inFlight).toEqual(operation);
    const replay = vi.fn(async (op) => acknowledge(op));
    const reopened = new DraftSession(local!, store, replay, { persisted: true });
    await reopened.flush();
    expect(replay.mock.calls[0][0]).toEqual(operation);
    expect(reopened.getSnapshot().replica.serverVersion).toBe(2);
  });
  it('auto-merges disjoint fields and sends a merge operation', async () => {
    const { session, edit, send } = setup(async (op) => op.expectedVersion === 1 ? { type: 'conflict', current: { ...remote, title: '云端标题', version: 2 } } : acknowledge(op));
    edit(); await session.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({ kind: 'merge', expectedVersion: 2, fields: { title: '云端标题', body: '新的正文' } });
    expect(session.getSnapshot().replica.base.serverVersion).toBe(3);
  });
  it('accepts a merge identical to remote without another write or notice', async () => {
    const { session, edit, send } = setup(async (op) => ({ type: 'conflict', current: { ...remote, ...op.fields, version: 2 } }));
    edit(); await session.flush();
    expect(send).toHaveBeenCalledTimes(1); expect(session.getSnapshot().dirty).toBe(false);
    expect(session.getSnapshot().notice).toBeUndefined();
  });
  it('retains conflicting versions and resolves against the new server base', async () => {
    const { session, edit } = setup(async () => ({ type: 'conflict', current: { ...remote, body: '云端正文', version: 3 } }));
    edit(); await session.flush();
    expect(session.getSnapshot().replica.inFlight).toBeUndefined();
    expect(session.getSnapshot().merge?.conflicts).toHaveLength(1);
    expect(edit('不可覆盖')).toBe(false);
    session.resolveConflict({ ...remote, body: '云端正文' });
    expect(session.getSnapshot().replica).toMatchObject({ serverVersion: 3, base: { serverVersion: 3 }, conflict: undefined });
  });
  it.each(['INVALID_DRAFT_OPERATION', 'DRAFT_NOT_FOUND', 'IDEMPOTENCY_KEY_REUSED'])('stops retrying rejection %s until another edit', async (code) => {
    const { session, edit, send } = setup(async () => ({ type: 'rejected', code, message: code }));
    edit(); await session.flush(); await session.flush();
    expect(send).toHaveBeenCalledTimes(1); expect(session.getSnapshot().replica.inFlight).toBeUndefined();
    edit('second'); await session.flush(); expect(send).toHaveBeenCalledTimes(2);
  });
  it('retains uncertain operation on 401 and recovers after manual retry', async () => {
    const { session, edit, send } = setup(async () => ({ type: 'auth' }));
    edit(); await session.flush();
    expect(session.getSnapshot().replica.inFlight).toBeDefined();
    expect(session.getSnapshot().status).toContain('登录已失效');
    send.mockImplementation(async (op) => acknowledge(op)); session.allowRetry(); await session.flush();
    expect(session.getSnapshot().dirty).toBe(false);
  });
  it('returning to base content requires no request', async () => {
    const { session, edit, send } = setup(); edit(); session.edit(remote); await session.flush();
    expect(send).not.toHaveBeenCalled(); expect(session.getSnapshot().dirty).toBe(false);
  });
  it('reports quota failures and never claims durable storage in memory mode', async () => {
    const store = new DurableStore(); vi.spyOn(store, 'put').mockRejectedValue(new DOMException('quota full', 'QuotaExceededError'));
    const { session, edit, send } = setup(undefined, store); edit(); await session.persist();
    expect(session.getSnapshot().status).toContain('本机保存失败'); await session.flush(); expect(send).not.toHaveBeenCalled();
    const memory = new DraftSession(createReplica(remote), new MemoryDraftStore(), async (op) => acknowledge(op));
    memory.edit({ ...remote, body: 'memory' }); await memory.persist();
    expect(memory.getSnapshot().status).not.toContain('已保存到本机'); expect(await memory.flushFully()).toBe(true);
  });
  it('freezes publication input and stops future writes on disposal', async () => {
    const { session, edit, send } = setup(); session.setFrozen(true); expect(edit()).toBe(false);
    session.setFrozen(false); edit(); await session.dispose(); expect(edit('later')).toBe(false);
    expect(await session.flush()).toBe('blocked'); expect(send).not.toHaveBeenCalled();
  });
  it('sends hidden flush in parallel with persistence', async () => {
    const store = new DurableStore(); const gate = deferred<void>(); vi.spyOn(store, 'put').mockImplementation(() => gate.promise);
    const { session, edit, send } = setup(undefined, store); edit(); const flush = session.flush('hidden'); await ticks();
    expect(send).toHaveBeenCalledTimes(1); gate.resolve(); await flush;
  });
});
