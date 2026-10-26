'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch, formatDateTime } from '@/lib/client-api';
import { lcsPairs } from '@/lib/drafts/diff3';
import { sameFields, splitParagraphs, type DraftFields } from '@/lib/drafts/fields';
import type { DraftSession, SessionView } from '@/lib/drafts/session';

type SnapshotInfo = { id: string; version: number; reason: string; title: string; createdAt: string };
type Snapshot = SnapshotInfo & DraftFields;
const reasons: Record<string, string> = {
  created: '新建', autosave: '自动保存', merge_before: '合并前', merge_after: '合并后',
  restore_before: '恢复前', restore_after: '恢复后', publish: '发布'
};

function paragraphDiff(before: string, after: string) {
  const current = splitParagraphs(before);
  const selected = splitParagraphs(after);
  const result: Array<{ kind: 'same' | 'added' | 'removed'; text: string }> = [];
  let left = 0;
  let right = 0;
  for (const [i, j] of [...lcsPairs(current, selected), [current.length, selected.length]]) {
    result.push(...current.slice(left, i).map((text) => ({ kind: 'removed' as const, text })));
    result.push(...selected.slice(right, j).map((text) => ({ kind: 'added' as const, text })));
    if (i < current.length) result.push({ kind: 'same', text: current[i] });
    left = i + 1; right = j + 1;
  }
  return result;
}

export function DraftHistory({ draftId, session, view, onClose }: {
  draftId: string; session: DraftSession; view: SessionView; onClose: () => void;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ snapshots: SnapshotInfo[] }>(`/api/drafts/${draftId}/snapshots`)
      .then((data) => { if (!cancelled) setSnapshots(data.snapshots); })
      .catch((error) => { if (!cancelled) setMessage(error instanceof Error ? error.message : '历史版本加载失败'); });
    return () => { cancelled = true; request.current += 1; };
  }, [draftId]);

  async function preview(id: string) {
    const token = ++request.current;
    setLoading(true); setMessage(''); setSelected(null);
    try {
      const data = await apiFetch<{ snapshot: Snapshot }>(`/api/drafts/${draftId}/snapshots/${id}`);
      if (token === request.current) setSelected(data.snapshot);
    } catch (error) { if (token === request.current) setMessage(error instanceof Error ? error.message : '预览失败'); }
    finally { if (token === request.current) setLoading(false); }
  }
  async function restore() {
    if (!selected || !session.edit(selected, 'restore')) return;
    session.setFrozen(true); setRestoring(true); setMessage('');
    try {
      if (!await session.flushFully()) {
        setMessage(`恢复内容已进入编辑器，尚未同步到云端：${session.getSnapshot().status}`); return;
      }
      setMessage(`已恢复到 ${formatDateTime(selected.createdAt)} 的版本`);
      const data = await apiFetch<{ snapshots: SnapshotInfo[] }>(`/api/drafts/${draftId}/snapshots`);
      setSnapshots(data.snapshots);
    } catch (error) { setMessage(error instanceof Error ? error.message : '恢复失败'); }
    finally { session.setFrozen(false); setRestoring(false); }
  }
  const disabled = view.readOnly || view.frozen || !!view.replica.conflict;
  return <section className="panel stack" aria-label="版本历史">
    <div className="button-row" style={{ justifyContent: 'space-between' }}><h2>版本历史</h2>
      <button className="button" type="button" disabled={restoring} onClick={onClose}>关闭历史版本</button>
    </div>
    {message ? <div className="notice" role="status">{message}</div> : null}
    {!snapshots ? <p>正在加载历史版本…</p> : snapshots.length === 0 ? <p>暂无历史版本</p> : <ul className="stack">
      {snapshots.map((snapshot) => <li key={snapshot.id}>
        <button className="button" type="button" disabled={restoring} onClick={() => void preview(snapshot.id)}>
          {reasons[snapshot.reason] ?? snapshot.reason} · 版本 {snapshot.version} · {formatDateTime(snapshot.createdAt)}
        </button>
      </li>)}
    </ul>}
    {loading ? <p>正在加载预览…</p> : null}
    {selected ? <section className="card stack" aria-label="版本预览">
      <h3>{selected.title || '（空标题）'}</h3>
      <p>{selected.summary || '（空摘要）'}</p>
      <p>标签：{selected.tags.join('、') || '无'} · 素材：{selected.assetIds.length} 项</p>
      <p>与当前正文比较：新增和删除标记表示恢复此版本后会发生的变化。</p>
      <div data-testid="history-diff">{paragraphDiff(view.replica.working.body, selected.body).map((part, index) =>
        <p className={part.kind === 'added' ? 'notice success' : part.kind === 'removed' ? 'notice danger' : ''} style={{ whiteSpace: 'pre-wrap' }} key={index}>
          {part.kind === 'added' ? '新增：' : part.kind === 'removed' ? '删除：' : ''}{part.text}
        </p>
      )}</div>
      <button className="button primary" type="button" disabled={disabled || sameFields(view.replica.working, selected)} onClick={() => void restore()}>恢复此版本</button>
    </section> : null}
  </section>;
}
