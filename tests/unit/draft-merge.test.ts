import { describe, expect, it } from 'vitest';
import { diff3, lcsPairs } from '@/lib/drafts/diff3';
import { chooseMerge, mergeDraft } from '@/lib/drafts/merge';
import { normalizeFields, parseTags, sameFields } from '@/lib/drafts/fields';
import { createReplica, reconcile } from '@/lib/drafts/replica';
import { remote } from './draft-fixtures';

describe('paragraph diff3', () => {
  it('bounds LCS memory for fragmented text while preserving both conflicting copies', () => {
    const base = Array.from({ length: 1100 }, (_, index) => `base-${index}`);
    const local = base.map((text) => `local-${text}`);
    const cloud = base.map((text) => `cloud-${text}`);
    expect(lcsPairs(['prefix', ...base, 'suffix'], ['prefix', ...local, 'suffix'])).toEqual([[0, 0], [1101, 1101]]);
    const blocks = diff3(base, local, cloud);
    expect(blocks).toEqual([{ base, local, remote: cloud, merged: undefined }]);
    expect(diff3(base, base, cloud)[0].merged).toEqual(cloud);
  });
  it.each([
    [['a', 'b', 'c'], ['A', 'b', 'c'], ['a', 'b', 'C'], ['A', 'b', 'C']],
    [['a', 'b'], ['A', 'b'], ['a', 'B'], ['A', 'B']],
    [['a', 'b'], ['b'], ['b'], ['b']],
    [['a'], ['A'], ['A'], ['A']],
    [[], ['a'], [], ['a']]
  ])('merges independent, identical and deleted paragraphs: %j', (base, local, cloud, expected) => {
    const blocks = diff3(base, local, cloud);
    expect(blocks.every((b) => b.merged !== undefined)).toBe(true);
    expect(blocks.flatMap((b) => b.merged ?? [])).toEqual(expected);
  });
  it.each([
    [['a'], ['A'], ['B']],
    [['a'], [], ['B']],
    [['a'], ['x', 'a'], ['y', 'a']],
    [[], ['x'], ['y']]
  ])('preserves both sides of overlapping edits: %j', (base, local, cloud) => {
    expect(diff3(base, local, cloud).some((block) => block.merged === undefined)).toBe(true);
  });
});

describe('whole draft merge', () => {
  it('merges scalar fields and sets with additions retained and deletions respected', () => {
    const result = mergeDraft(remote, { ...remote, title: '本机', tags: ['本机新增'], assetIds: [] },
      { ...remote, summary: '云端', tags: ['原有', '云端新增'], assetIds: ['asset_a', 'asset_b'] });
    expect(result.conflicts).toEqual([]);
    expect(result.fields).toMatchObject({ title: '本机', summary: '云端', tags: ['云端新增', '本机新增'], assetIds: ['asset_b'] });
  });
  it('requires explicit conflict choices and keeps cloud paragraphs before local', () => {
    const result = mergeDraft(remote, { ...remote, title: '本机', body: '本机正文' }, { ...remote, title: '云端', body: '云端正文' });
    expect(result.conflicts).toHaveLength(2);
    expect(() => chooseMerge(result, {})).toThrow('全部冲突');
    expect(chooseMerge(result, { title: 'remote', 'body-0': 'both' })).toMatchObject({ title: '云端', body: '云端正文\n\n本机正文' });
  });
  it('normalizes set ordering without trimming controlled text input', () => {
    expect(parseTags('甲，乙,甲,')).toEqual(['乙', '甲']);
    expect(normalizeFields({ ...remote, title: '  ' }).title).toBe('  ');
    expect(sameFields({ ...remote, tags: ['a', 'b'] }, { ...remote, tags: ['b', 'a', 'a'] })).toBe(true);
  });
});

describe('reconcile on reopen', () => {
  it('404 never falls back to an unauthorized local draft', () => {
    const local = createReplica(remote);
    expect(reconcile(local, 'not_found').error).toContain('无权访问');
    expect(local.working.body).toBe(remote.body);
  });
  it('creates from remote or reports an absent offline copy', () => {
    expect(reconcile(undefined, remote).replica?.serverVersion).toBe(1);
    expect(reconcile(undefined, null).error).toContain('本机没有');
  });
  it('keeps a local offline copy with a warning', () => {
    const local = createReplica(remote);
    expect(reconcile(local, null)).toMatchObject({ replica: local, message: '离线中，显示的是本机保存的内容' });
  });
  it('refreshes an unresolved conflict without losing local content', () => {
    const local = { ...createReplica(remote), conflict: { remote, detectedAt: remote.updatedAt } };
    expect(reconcile(local, { ...remote, version: 3 }).replica?.conflict?.remote.version).toBe(3);
  });
  it('preserves dirty edits and uncertain operations until server adjudication', () => {
    const local = { ...createReplica(remote), localRevision: 2, working: { ...remote, body: '本机' } };
    expect(reconcile(local, { ...remote, version: 3 }).replica).toBe(local);
    const pending = { ...createReplica(remote), inFlight: { operationId: 'operation', fields: remote, localRevision: 1, expectedVersion: 1, kind: 'edit' as const } };
    expect(reconcile(pending, remote).replica).toBe(pending);
  });
  it('reuses equal clean versions and replaces outdated clean versions', () => {
    const local = createReplica(remote);
    expect(reconcile(local, remote).replica).toBe(local);
    expect(reconcile(local, { ...remote, version: 4, body: '新版' }).replica?.working.body).toBe('新版');
  });
  it('rejects unknown local schema versions visibly', () => {
    const local = createReplica(remote);
    Object.assign(local, { schemaVersion: 99 });
    expect(reconcile(local, remote).message).toContain('格式不受支持');
  });
});
