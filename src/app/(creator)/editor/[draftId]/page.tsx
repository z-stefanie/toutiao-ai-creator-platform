'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCcw, Save, ShieldAlert } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { useAutosaveDraft } from '@/hooks/use-autosave-draft';
import { apiFetch, formatDateTime } from '@/lib/client-api';
import { getOfflineDraft, saveOfflineDraft } from '@/lib/offline-drafts';
import type { AuditResult, Content, Draft, QualityScore } from '@/lib/types';

type PublishResult = {
  published: boolean;
  audit: AuditResult;
  qualityScore: QualityScore | null;
  content: Content | null;
};

type AiSuggestions = {
  coverSuggestion: string;
  imageSuggestions: string[];
};

export default function EditorPage() {
  return <AuthGate>{() => <EditorContent />}</AuthGate>;
}

function EditorContent() {
  const params = useParams<{ draftId: string }>();
  const draftId = params.draftId;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [message, setMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestions>({
    coverSuggestion: '优先使用已选素材中最能概括主题的一张作为封面。',
    imageSuggestions: ['主题场景图', '数据或流程图', '结论卡片图']
  });

  const applyDraft = useCallback((nextDraft: Draft) => {
    setDraft(nextDraft);
    setTitle(nextDraft.title);
    setSummary(nextDraft.summary);
    setBody(nextDraft.body);
    setTagsText(nextDraft.tags.join('，'));
    setAssetIds(nextDraft.assetIds);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ draft: Draft }>(`/api/drafts/${draftId}`)
      .then(async (data) => {
        const localDraft = await getOfflineDraft(draftId);
        const nextDraft = localDraft?.syncStatus === 'local_pending' ? localDraft : data.draft;
        if (localDraft?.syncStatus === 'local_pending') {
          setMessage('已恢复离线草稿，网络恢复后将自动同步。');
        } else {
          await saveOfflineDraft(data.draft);
        }
        if (!cancelled) applyDraft(nextDraft);
      })
      .catch(async () => {
        const localDraft = await getOfflineDraft(draftId);
        if (!cancelled && localDraft) {
          setMessage('网络不可用，已从 IndexedDB 恢复本地草稿。');
          applyDraft(localDraft);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applyDraft, draftId]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(`draft-ai-suggestions-${draftId}`);
    if (!raw) return;
    try {
      const suggestions = JSON.parse(raw) as AiSuggestions;
      setAiSuggestions({
        coverSuggestion: suggestions.coverSuggestion || '优先使用已选素材中最能概括主题的一张作为封面。',
        imageSuggestions: suggestions.imageSuggestions?.length
          ? suggestions.imageSuggestions
          : ['主题场景图', '数据或流程图', '结论卡片图']
      });
    } catch {
      window.sessionStorage.removeItem(`draft-ai-suggestions-${draftId}`);
    }
  }, [draftId]);

  const payload = useMemo(() => {
    if (!draft) return null;
    return {
      title,
      summary,
      body,
      tags: tagsText
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      assetIds,
      version: draft.version
    };
  }, [assetIds, body, draft, summary, tagsText, title]);

  const autosave = useAutosaveDraft(draftId, payload, draft, setDraft);
  const paragraphs = useMemo(() => splitParagraphs(body), [body]);

  async function saveNow() {
    const saved = await autosave.saveNow();
    if (saved) setDraft(saved);
  }

  async function publish() {
    setMessage('');
    setResult(null);
    await saveNow();
    const data = await apiFetch<PublishResult>('/api/contents/publish', {
      method: 'POST',
      body: JSON.stringify({ draftId })
    });
    setResult(data);
  }

  async function rewrite() {
    const data = await apiFetch<{ draft: Draft }>('/api/ai/rewrite-compliant', {
      method: 'POST',
      body: JSON.stringify({ draftId })
    });
    setDraft(data.draft);
    setTitle(data.draft.title);
    setSummary(data.draft.summary);
    setBody(data.draft.body);
    setTagsText(data.draft.tags.join('，'));
    setMessage('已生成合规替代内容，请确认后再次发布。');
  }

  function updateParagraph(index: number, value: string) {
    const nextParagraphs = [...paragraphs];
    nextParagraphs[index] = value;
    setBody(nextParagraphs.join('\n\n'));
  }

  async function rewriteParagraph(index: number) {
    await saveNow();
    const data = await apiFetch<{ draft: Draft; rewrittenParagraph: string }>('/api/ai/rewrite-paragraph', {
      method: 'POST',
      body: JSON.stringify({ draftId, paragraphIndex: index })
    });
    applyDraft(data.draft);
    setMessage(`第 ${index + 1} 段已完成局部重写，可继续逐段确认。`);
  }

  if (!draft) {
    return (
      <main className="page">
        <div className="notice">正在加载草稿...</div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">图文编辑器</h1>
          <p className="page-subtitle">
            每 30 秒自动保存；离线写入 IndexedDB，恢复网络后自动同步。
          </p>
        </div>
        <div className="button-row">
          <button className="button" onClick={saveNow} type="button">
            <Save size={18} />
            保存草稿
          </button>
          <button className="button primary" onClick={publish} type="button">
            <CheckCircle2 size={18} />
            发布并审核
          </button>
        </div>
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="form">
            <label className="field">
              <span className="label">标题</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">摘要</span>
              <input className="input" value={summary} onChange={(event) => setSummary(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">正文</span>
              <textarea className="textarea" value={body} onChange={(event) => setBody(event.target.value)} />
            </label>
            <section className="stack">
              <h2>段落创意卡片</h2>
              {paragraphs.map((paragraph, index) => (
                <div className="card" key={`paragraph-${index + 1}`}>
                  <div className="button-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong>第 {index + 1} 段</strong>
                    <button className="button" onClick={() => void rewriteParagraph(index)} type="button">
                      <RefreshCcw size={16} />
                      局部重写第 {index + 1} 段
                    </button>
                  </div>
                  <textarea
                    aria-label={`段落 ${index + 1}`}
                    className="textarea"
                    value={paragraph}
                    onChange={(event) => updateParagraph(index, event.target.value)}
                  />
                </div>
              ))}
            </section>
            <label className="field">
              <span className="label">标签，用逗号分隔</span>
              <input className="input" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
            </label>
          </div>
        </section>

        <aside className="panel">
          <h2>发布控制台</h2>
          <div className="stack">
            <div className="notice">
              <strong>封面建议</strong>
              <p>{aiSuggestions.coverSuggestion}</p>
            </div>
            <div className="notice">
              <strong>AI 配图建议</strong>
              <div className="badge-row" style={{ marginTop: 8 }}>
                {aiSuggestions.imageSuggestions.map((suggestion) => (
                  <span className="badge" key={suggestion}>
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
            <div className="notice">
              {autosave.message} · 最近保存 {formatDateTime(draft.lastSavedAt)}
            </div>
            <div className="badge-row">
              <span className="badge">版本 {draft.version}</span>
              <span
                className={`badge ${
                  autosave.status === 'error'
                    ? 'danger'
                    : autosave.status === 'local_pending'
                      ? 'warning'
                      : 'success'
                }`}
              >
                {autosave.status}
              </span>
              <span className={`badge ${draft.syncStatus === 'local_pending' ? 'warning' : 'success'}`}>
                {draft.syncStatus}
              </span>
            </div>
            {message ? <div className="notice success">{message}</div> : null}
            {result ? (
              <PublishResultPanel result={result} onRewrite={rewrite} />
            ) : (
              <div className="notice">
                可在正文中输入“赌博”或“敏感信息”验证 Mock 审核拦截，再使用合规改写。
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function PublishResultPanel({ result, onRewrite }: { result: PublishResult; onRewrite: () => Promise<void> }) {
  if (!result.published) {
    return (
      <div className="notice danger">
        <div className="button-row" style={{ justifyContent: 'space-between' }}>
          <strong>
            <ShieldAlert size={18} /> 审核未通过
          </strong>
          <button className="button" onClick={() => void onRewrite()} type="button">
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

function splitParagraphs(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
