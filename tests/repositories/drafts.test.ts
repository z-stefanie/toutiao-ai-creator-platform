import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import type { Draft } from '@/lib/types';
import type { DraftOperation } from '@/lib/drafts/fields';
import { remote } from '../unit/draft-fixtures';

const auth = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock('@/server/auth/session', () => ({ getCurrentUser: auth.user }));
const directory = mkdtempSync(join(tmpdir(), 'toutiao-draft-tests-'));
const database = join(directory, 'test.db');
process.env.DATABASE_URL = `file:${database}`;
process.env.AI_PROVIDER = 'mock';
let repo: typeof import('@/server/repositories/draft-repository');
let app: typeof import('@/server/repositories/app-repository');
let prisma: typeof import('@/server/db/prisma').prisma;
let patch: typeof import('@/app/api/drafts/[draftId]/route').PATCH;
let publish: typeof import('@/app/api/contents/publish/route').POST;
let draft: Draft;
const owner = 'test_owner';

beforeAll(async () => {
  const db = new DatabaseSync(database);
  db.exec(readFileSync('prisma/generated-schema.sql', 'utf8'));
  db.close();
  ({ prisma } = await import('@/server/db/prisma'));
  repo = await import('@/server/repositories/draft-repository');
  app = await import('@/server/repositories/app-repository');
  ({ PATCH: patch } = await import('@/app/api/drafts/[draftId]/route'));
  ({ POST: publish } = await import('@/app/api/contents/publish/route'));
  await prisma.user.create({ data: { id: owner, email: 'owner@example.com', nickname: '测试', role: 'creator' } });
});
beforeEach(async () => {
  auth.user.mockResolvedValue({ id: owner });
  draft = await app.createDraftForUser(owner, remote);
});
afterAll(async () => { await prisma.$disconnect(); rmSync(directory, { recursive: true, force: true }); });

function operation(overrides: Partial<DraftOperation> = {}) {
  const input: DraftOperation = { operationId: crypto.randomUUID(), localRevision: 1, expectedVersion: 1, kind: 'edit', fields: { ...remote, body: '新正文' }, ...overrides };
  return { ...input, requestHash: repo.hashDraftOperation(input) };
}
function request(op: DraftOperation, key: string | null = op.operationId) {
  const { operationId, ...input } = op;
  expect(operationId).toBeTruthy();
  return new NextRequest(`http://localhost/api/drafts/${draft.id}`, { method: 'PATCH', headers: key ? { 'Idempotency-Key': key } : {}, body: JSON.stringify(input) });
}
const context = () => ({ params: Promise.resolve({ draftId: draft.id }) });

describe('atomic draft repository', () => {
  it('eight concurrent writers produce exactly one applied and seven conflicts', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => repo.saveDraftOperation(owner, draft.id, operation())));
    expect(results.filter((result) => result.status === 'applied')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'conflict')).toHaveLength(7);
    expect((await app.getDraftForUser(owner, draft.id))?.version).toBe(2);
  }, 20_000);
  it('replays an identical operation and rejects different content with the same key', async () => {
    const input = operation();
    const first = await repo.saveDraftOperation(owner, draft.id, input);
    const second = await repo.saveDraftOperation(owner, draft.id, input);
    expect(first.status).toBe('applied'); expect(second.status).toBe('replayed');
    if ('ack' in first && 'ack' in second) expect(second.ack).toEqual(first.ack);
    expect((await repo.saveDraftOperation(owner, draft.id, operation({ ...input, fields: { ...remote, body: 'different' } }))).status).toBe('key_reused');
    expect((await app.getDraftForUser(owner, draft.id))?.version).toBe(2);
  });
  it('two concurrent identical keys both receive the same ACK with one write', async () => {
    const input = operation();
    const results = await Promise.all([repo.saveDraftOperation(owner, draft.id, input), repo.saveDraftOperation(owner, draft.id, input)]);
    expect(results.map((r) => r.status).sort()).toEqual(['applied', 'replayed']);
    expect(results.map((r) => 'ack' in r ? r.ack : null)[0]).toEqual(results.map((r) => 'ack' in r ? r.ack : null)[1]);
    expect((await app.getDraftForUser(owner, draft.id))?.version).toBe(2);
  });
  it('conceals other owners and missing drafts, and rejects future version 999', async () => {
    expect((await repo.saveDraftOperation('stranger', draft.id, operation())).status).toBe('not_found');
    expect((await repo.saveDraftOperation(owner, 'missing', operation())).status).toBe('not_found');
    const result = await repo.saveDraftOperation(owner, draft.id, operation({ expectedVersion: 999 }));
    expect(result).toMatchObject({ status: 'conflict', current: { version: 1, body: remote.body } });
    expect(await repo.listDraftSnapshots('stranger', draft.id)).toBeNull();
    const snapshot = (await repo.listDraftSnapshots(owner, draft.id))![0];
    expect(await repo.getDraftSnapshot('stranger', draft.id, snapshot.id)).toBeNull();
  });
  it('creates snapshots and throttles autosaves for ten minutes', async () => {
    expect((await repo.listDraftSnapshots(owner, draft.id))!.map((s) => s.reason)).toEqual(['created']);
    const start = new Date(Date.now() + 11 * 60_000);
    for (let index = 0; index < 3; index += 1) await repo.saveDraftOperation(owner, draft.id,
      operation({ expectedVersion: index + 1 }), new Date(start.getTime() + index * 1_000));
    expect(await prisma.draftSnapshot.count({ where: { draftId: draft.id, reason: 'autosave' } })).toBe(1);
    await repo.saveDraftOperation(owner, draft.id, operation({ expectedVersion: 4 }), new Date(start.getTime() + 11 * 60_000));
    expect(await prisma.draftSnapshot.count({ where: { draftId: draft.id, reason: 'autosave' } })).toBe(2);
  });
  it('preserves before and after merge/restore, trimming to the latest fifty', async () => {
    const start = Date.now() + 1_000;
    const created = (await repo.listDraftSnapshots(owner, draft.id))![0];
    for (let index = 0; index < 30; index += 1) {
      await repo.saveDraftOperation(owner, draft.id, operation({ expectedVersion: index + 1, kind: index % 2 ? 'restore' : 'merge', fields: { ...remote, body: `version-${index + 2}` } }), new Date(start + index * 1_000));
    }
    const rows = await prisma.draftSnapshot.findMany({ where: { draftId: draft.id } });
    expect(rows).toHaveLength(50); expect(rows.find((r) => r.id === created.id)).toBeUndefined();
    expect(rows.find((r) => r.reason === 'restore_after' && r.version === 31)?.body).toBe('version-31');
    expect(rows.find((r) => r.reason === 'restore_before' && r.version === 30)?.body).toBe('version-30');
  });
  it('deletes receipts older than seven days on the next successful write', async () => {
    const old = operation();
    await repo.saveDraftOperation(owner, draft.id, old, new Date(Date.now() - 8 * 86400_000));
    await repo.saveDraftOperation(owner, draft.id, operation({ expectedVersion: 2 }));
    expect(await prisma.draftMutation.findFirst({ where: { draftId: draft.id, operationId: old.operationId } })).toBeNull();
  });
});

describe('draft routes', () => {
  it('maps 400, 401, 404, 409 and 422 without leaking other owners', async () => {
    const op = operation();
    expect((await patch(request(op, null), context())).status).toBe(400);
    expect((await patch(request(op, 'bad'), context())).status).toBe(400);
    expect((await patch(request(operation({ localRevision: 0 })), context())).status).toBe(400);
    auth.user.mockResolvedValueOnce(null);
    expect((await patch(request(op), context())).status).toBe(401);
    auth.user.mockResolvedValueOnce({ id: 'stranger' });
    expect((await patch(request(op), context())).status).toBe(404);
    const conflict = await patch(request(operation({ expectedVersion: 999 })), context());
    expect(conflict.status).toBe(409); expect((await conflict.json()).error.details.current.body).toBe(remote.body);
    expect((await patch(request(op), context())).status).toBe(200);
    expect((await patch(request(operation({ ...op, fields: remote })), context())).status).toBe(422);
  });
  it('allows empty edits but refuses incomplete publication and stale versions', async () => {
    expect((await patch(request(operation({ fields: { ...remote, title: '', body: '' } })), context())).status).toBe(200);
    const send = (version?: number) => publish(new NextRequest('http://localhost/api/contents/publish', { method: 'POST', body: JSON.stringify({ draftId: draft.id, version }) }));
    const stale = await send(1); expect(stale.status).toBe(409); expect((await stale.json()).error.details.currentVersion).toBe(2);
    const incomplete = await send(2); expect(incomplete.status).toBe(400); expect((await incomplete.json()).error.code).toBe('DRAFT_INCOMPLETE');
  });
  it('AI routes operate on supplied content and never change cloud content or version', async () => {
    const paragraph = await import('@/app/api/ai/rewrite-paragraph/route');
    const compliant = await import('@/app/api/ai/rewrite-compliant/route');
    const first = await paragraph.POST(new NextRequest('http://localhost/api/ai/rewrite-paragraph', { method: 'POST', body: JSON.stringify({ draftId: draft.id, paragraphIndex: 0, paragraph: '本机未保存段落' }) }));
    expect((await first.json()).data.rewrittenParagraph).toContain('本机未保存段落');
    const second = await compliant.POST(new NextRequest('http://localhost/api/ai/rewrite-compliant', { method: 'POST', body: JSON.stringify({ draftId: draft.id, title: '本机标题', summary: '', body: '本机正文' }) }));
    expect((await second.json()).data.rewritten.body).toContain('本机正文');
    expect(await app.getDraftForUser(owner, draft.id)).toMatchObject({ version: 1, body: remote.body });
  });
  it('publishes the checked version and creates its snapshot in the transaction', async () => {
    const response = await publish(new NextRequest('http://localhost/api/contents/publish', { method: 'POST', body: JSON.stringify({ draftId: draft.id, version: 1 }) }));
    expect(response.status).toBe(200); expect((await response.json()).data.published).toBe(true);
    expect(await prisma.draftSnapshot.count({ where: { draftId: draft.id, reason: 'publish', version: 1 } })).toBe(1);
  });
});
