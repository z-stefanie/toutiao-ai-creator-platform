'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCcw, Save, ShieldAlert } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { DraftHistory } from '@/components/draft-history';
import { useDraftSync } from '@/hooks/use-draft-sync';
import { ApiError, apiFetch, formatDateTime } from '@/lib/client-api';
import { parseTags, splitParagraphs, type DraftFields } from '@/lib/drafts/fields';
import { chooseMerge, type MergeChoice } from '@/lib/drafts/merge';
import type { DraftSession, SessionView } from '@/lib/drafts/session';
import type { AuditResult, Content, Draft, QualityScore } from '@/lib/types';

type PublishResult = { published: boolean; audit: AuditResult; qualityScore: QualityScore | null; content: Content | null };
type AiSuggestions = { coverSuggestion: string; imageSuggestions: string[] };

export default function EditorPage() {
  return <AuthGate>{(user) => <EditorContent ownerId={user.id} />}</AuthGate>;
}

function EditorContent({ ownerId }: { ownerId: string }) {
  const { draftId } = useParams<{ draftId: string }>();
  const sync = useDraftSync(ownerId, draftId);
  const { session, view } = sync;
  const [result, setResult] = useState<PublishResult | null>(null);
  const [message, setMessage] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState({ canonical: '', text: '' });
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions>({
    coverSuggestion: '优先使用已选素材中最能概括主题的一张作为封面。',
    imageSuggestions: ['主题场景图', '数据或流程图', '结论卡片图']
  });
  useEffect(() => {
    const raw = window.sessionStorage.getItem(`draft-ai-suggestions-${draftId}`);
    if (!raw) return;
    try { setAiSuggestions(JSON.parse(raw) as AiSuggestions); }
    catch { window.sessionStorage.removeItem(`draft-ai-suggestions-${draftId}`); }
  }, [draftId]);

  if (sync.error) return <main className="page"><div className="notice danger">{sync.error}</div></main>;
  if (!session || !view) return <main className="page"><div className="notice">正在加载草稿…</div></main>;
  const active = session;
  const { working: fields } = view.replica;
  const paragraphs = splitParagraphs(fields.body);
  const disabled = view.readOnly || view.frozen || !!view.replica.conflict;
  const tagsCanonical = fields.tags.join('，');
  const tagsText = tagsInput.canonical === tagsCanonical ? tagsInput.text : tagsCanonical;

  function edit(patch: Partial<DraftFields>) { active.edit({ ...active.getSnapshot().replica.working, ...patch }); }
  async function saveNow() {
    setMessage('');
    if (await sync.save()) setMessage(`草稿已保存，版本 ${active.getSnapshot().replica.serverVersion}`);
  }
  async function publish() {
    setMessage(''); setResult(null); active.setFrozen(true);
    try {
      if (!await active.flushFully()) {
        setMessage(`草稿还没有同步到云端，暂时不能发布：${active.getSnapshot().status}`); return;
      }
      const data = await apiFetch<PublishResult>('/api/contents/publish', {
        method: 'POST', body: JSON.stringify({ draftId, version: active.getSnapshot().replica.serverVersion })
      });
      setResult(data);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'DRAFT_CHANGED') {
        setMessage('草稿在别处被修改，请确认最新内容后再发布'); await sync.reload();
      } else setMessage(error instanceof Error ? error.message : '发布失败，请重试');
    } finally { active.setFrozen(false); }
  }
  async function rewrite() {
    const initial = active.getSnapshot().replica;
    try {
      const data = await apiFetch<{ rewritten: { title: string; body: string } }>('/api/ai/rewrite-compliant', {
        method: 'POST', body: JSON.stringify({ draftId, ...initial.working })
      });
      if (active.getSnapshot().replica.localRevision !== initial.localRevision || active.getSnapshot().frozen || active.getSnapshot().replica.conflict) {
        setMessage('内容在生成期间被修改，已放弃本次改写，请重试'); return;
      }
      active.edit({ ...initial.working, title: data.rewritten.title, body: data.rewritten.body });
      setMessage('已生成合规替代内容，请确认后再次发布。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '改写失败，请重试'); }
  }
  function updateParagraph(index: number, value: string) {
    const next = splitParagraphs(active.getSnapshot().replica.working.body); next[index] = value; edit({ body: next.join('\n\n') });
  }
  async function rewriteParagraph(index: number) {
    const paragraph = splitParagraphs(active.getSnapshot().replica.working.body)[index];
    try {
      const data = await apiFetch<{ rewrittenParagraph: string }>('/api/ai/rewrite-paragraph', {
        method: 'POST', body: JSON.stringify({ draftId, paragraphIndex: index, paragraph })
      });
      if (splitParagraphs(active.getSnapshot().replica.working.body)[index] !== paragraph || active.getSnapshot().frozen || active.getSnapshot().replica.conflict) {
        setMessage('这一段在生成期间被修改，已放弃本次改写，请重试'); return;
      }
      updateParagraph(index, data.rewrittenParagraph);
      setMessage(`第 ${index + 1} 段已完成局部重写，可继续逐段确认。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '改写失败，请重试'); }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">图文编辑器</h1>
          <p className="page-subtitle">修改实时保存在本机，联网时自动同步到云端（至少每 30 秒一次）</p>
        </div>
        <div className="button-row">
          <button className="button" disabled={view.frozen} onClick={() => setHistoryOpen(!historyOpen)} type="button">历史版本</button>
          <button className="button" disabled={disabled} onClick={() => void saveNow()} type="button"><Save size={18} />保存草稿</button>
          <button className="button primary" disabled={disabled} onClick={() => void publish()} type="button"><CheckCircle2 size={18} />发布并审核</button>
        </div>
      </div>
      {!view.durable ? <div className="notice warning">当前浏览器无法使用本地存储，关闭页面前请确认已同步到云端</div> : null}
      {view.readOnly ? <div className="notice"><button className="button" type="button" onClick={sync.takeOver}>在此处编辑</button></div> : null}
      {historyOpen ? <DraftHistory draftId={draftId} session={active} view={view} onClose={() => setHistoryOpen(false)} /> : null}
      {view.replica.conflict ? <ConflictPanel key={view.replica.conflict.detectedAt} session={active} view={view} /> : null}
      {view.replica.rejected?.code === 'DRAFT_NOT_FOUND' ? <SaveCopy fields={fields} /> : null}
      <div className="grid two">
        <section className="panel"><div className="form">
          <label className="field"><span className="label">标题</span><input className="input" value={fields.title} disabled={disabled} onChange={(event) => edit({ title: event.target.value })} /></label>
          <label className="field"><span className="label">摘要</span><input className="input" value={fields.summary} disabled={disabled} onChange={(event) => edit({ summary: event.target.value })} /></label>
          <label className="field"><span className="label">正文</span><textarea className="textarea" value={fields.body} disabled={disabled} onChange={(event) => edit({ body: event.target.value })} /></label>
          <section className="stack"><h2>段落创意卡片</h2>
            {paragraphs.map((paragraph, index) => <div className="card" key={`paragraph-${index + 1}`}>
              <div className="button-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}><strong>第 {index + 1} 段</strong>
                <button className="button" disabled={disabled} onClick={() => void rewriteParagraph(index)} type="button"><RefreshCcw size={16} />局部重写第 {index + 1} 段</button>
              </div>
              <textarea aria-label={`段落 ${index + 1}`} className="textarea" value={paragraph} disabled={disabled} onChange={(event) => updateParagraph(index, event.target.value)} />
            </div>)}
          </section>
          <label className="field"><span className="label">标签，用逗号分隔</span><input className="input" value={tagsText} disabled={disabled} onChange={(event) => {
            const tags = parseTags(event.target.value); setTagsInput({ text: event.target.value, canonical: tags.join('，') }); edit({ tags });
          }} /></label>
        </div></section>
        <aside className="panel"><h2>发布控制台</h2><div className="stack">
          <div className="notice"><strong>封面建议</strong><p>{aiSuggestions.coverSuggestion}</p></div>
          <div className="notice"><strong>AI 配图建议</strong><div className="badge-row" style={{ marginTop: 8 }}>
            {aiSuggestions.imageSuggestions?.map((suggestion) => <span className="badge" key={suggestion}>{suggestion}</span>)}
          </div></div>
          <div className="notice" role="status" data-testid="sync-status">{view.status}</div>
          <div>最近同步 {formatDateTime(view.replica.lastSyncedAt)}</div>
          <div className="badge-row"><span className="badge">版本 {view.replica.serverVersion}</span><span className="badge" data-testid="sync-badge">{view.badge}</span></div>
          {view.notice ? <div className="notice">{view.notice}</div> : null}
          {message ? <div className="notice">{message}</div> : null}
          {result ? <PublishResultPanel result={result} onRewrite={rewrite} disabled={disabled} /> : <div className="notice">可在正文中输入“赌博”或“敏感信息”验证 Mock 审核拦截，再使用合规改写。</div>}
        </div></aside>
      </div>
    </main>
  );
}

function SaveCopy({ fields }: { fields: DraftFields }) {
  const [created, setCreated] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true); setError('');
    try {
      const data = await apiFetch<{ draft: Draft }>('/api/drafts', { method: 'POST', body: JSON.stringify({ ...fields, title: `${fields.title || '未命名草稿'}（冲突副本）`.slice(0, 120) }) });
      setCreated(data.draft.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : '另存失败'); }
    finally { setSaving(false); }
  }
  return <div className="stack"><button className="button" type="button" disabled={!fields.body.trim() || saving} onClick={() => void save()}>把我的版本另存为新草稿</button>
    {created ? <Link href={`/editor/${created}`}>查看另存的新草稿</Link> : null}{error ? <div className="notice danger">{error}</div> : null}</div>;
}

function ConflictPanel({ session, view }: { session: DraftSession; view: SessionView }) {
  const [choices, setChoices] = useState<Record<string, MergeChoice>>({});
  const suggestion = view.merge;
  if (!suggestion) return null;
  return <section className="panel" aria-label="冲突处理"><h2>处理草稿冲突</h2>
    <p>请选择每处冲突要保留的内容，两份内容在确认前都会保留。</p>
    {suggestion.conflicts.map((conflict, index) => <fieldset key={conflict.id} className="card"><legend>冲突 {index + 1} · {conflict.field === 'body' ? '正文' : conflict.field === 'title' ? '标题' : '摘要'}</legend>
      <div className="grid two"><div><strong>我的</strong><p style={{ whiteSpace: 'pre-wrap' }}>{conflict.local || '（空）'}</p></div><div><strong>云端</strong><p style={{ whiteSpace: 'pre-wrap' }}>{conflict.remote || '（空）'}</p></div></div>
      <div className="button-row">{(['local', 'remote', ...(conflict.field === 'body' ? ['both'] : [])] as MergeChoice[]).map((choice) =>
        <label key={choice}><input type="radio" disabled={view.readOnly} name={conflict.id} checked={choices[conflict.id] === choice} onChange={() => setChoices({ ...choices, [conflict.id]: choice })} />{choice === 'local' ? '用我的' : choice === 'remote' ? '用云端' : '两者都保留'}</label>
      )}</div></fieldset>)}
    <button className="button primary" type="button" disabled={view.readOnly || suggestion.conflicts.some((conflict) => !choices[conflict.id])} onClick={() => session.resolveConflict(chooseMerge(suggestion, choices))}>确认合并</button>
    <SaveCopy fields={view.replica.working} />
  </section>;
}

function PublishResultPanel({ result, onRewrite, disabled }: { result: PublishResult; onRewrite: () => Promise<void>; disabled: boolean }) {
  if (!result.published) {
    return (
      <div className="notice danger">
        <div className="button-row" style={{ justifyContent: 'space-between' }}>
          <strong>
            <ShieldAlert size={18} /> 审核未通过
          </strong>
          <button className="button" disabled={disabled} onClick={() => void onRewrite()} type="button">
            <RefreshCcw size={18} />
            合规改写
          </button>
        </div>
        <p>{result.audit.suggestion}</p>
        <div className="badge-row">
          {result.audit.hitSpans.map((hit) => (
            <span className="badge danger" key={`${hit.category}-${hit.text}`}>
              {hit.category}: {hit.text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="notice success">
      <strong>发布成功</strong>
      <p>
        质量分 {result.qualityScore?.total ?? '-'}，内容已进入榜单排序。审核建议：
        {result.audit.suggestion}
      </p>
      {result.content ? (
        <div className="button-row">
          <Link className="button primary" href={`/content/${result.content.id}`}>
            查看详情
          </Link>
          <Link className="button" href="/feed/hot">
            去热点榜单
          </Link>
        </div>
      ) : null}
    </div>
  );
}
