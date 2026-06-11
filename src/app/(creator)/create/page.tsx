'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { apiFetch } from '@/lib/client-api';
import type { Asset, Draft, GeneratedContent, Prompt } from '@/lib/types';

export default function CreatePage() {
  return <AuthGate>{() => <CreateContent />}</AuthGate>;
}

function CreateContent() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [topic, setTopic] = useState('AI 创作者工作台如何提升内容生产效率');
  const [audience, setAudience] = useState('个人创作者和内容运营');
  const [tone, setTone] = useState('清晰、克制、有方法论');
  const [promptId, setPromptId] = useState('');
  const [assetIds, setAssetIds] = useState<string[]>(['asset_city']);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiFetch<{ prompts: Prompt[] }>('/api/prompts').then((data) => {
      setPrompts(data.prompts);
      setPromptId(data.prompts[0]?.id ?? '');
    });
    void apiFetch<{ assets: Asset[] }>('/api/assets').then((data) => setAssets(data.assets));
  }, []);

  const selectedAssetNames = useMemo(
    () => assets.filter((asset) => assetIds.includes(asset.id)).map((asset) => asset.filename),
    [assets, assetIds]
  );

  async function generate() {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ generated: GeneratedContent; draft: Draft }>('/api/ai/generate-content', {
        method: 'POST',
        body: JSON.stringify({ topic, audience, tone, promptId, assetIds })
      });
      window.sessionStorage.setItem(
        `draft-ai-suggestions-${data.draft.id}`,
        JSON.stringify({
          coverSuggestion: data.generated.coverSuggestion,
          imageSuggestions: data.generated.imageSuggestions
        })
      );
      setPreview(data.generated);
      router.push(`/editor/${data.draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI 内容创作</h1>
          <p className="page-subtitle">输入主题、选择 Prompt 和素材，Mock AI 会生成可编辑草稿。</p>
        </div>
      </div>
      <div className="grid two">
        <section className="panel">
          <div className="form">
            <label className="field">
              <span className="label">主题</span>
              <input className="input" value={topic} onChange={(event) => setTopic(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">目标受众</span>
              <input className="input" value={audience} onChange={(event) => setAudience(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">语气风格</span>
              <input className="input" value={tone} onChange={(event) => setTone(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">Prompt</span>
              <select className="select" value={promptId} onChange={(event) => setPromptId(event.target.value)}>
                {prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span className="label">素材</span>
              <div className="stack">
                {assets.map((asset) => (
                  <label className="notice" key={asset.id}>
                    <input
                      checked={assetIds.includes(asset.id)}
                      onChange={(event) => {
                        setAssetIds((current) =>
                          event.target.checked
                            ? [...current, asset.id]
                            : current.filter((item) => item !== asset.id)
                        );
                      }}
                      type="checkbox"
                    />{' '}
                    {asset.filename} · {asset.complianceStatus}
                  </label>
                ))}
              </div>
            </div>
            {error ? <div className="notice danger">{error}</div> : null}
            <button className="button primary" disabled={loading} onClick={generate} type="button">
              <Sparkles size={18} />
              {loading ? '生成中' : '生成草稿'}
            </button>
          </div>
        </section>
        <aside className="panel">
          <h2>生成上下文</h2>
          <div className="stack">
            <div className="notice">素材：{selectedAssetNames.length ? selectedAssetNames.join('、') : '未选择'}</div>
            <div className="notice">发布前会自动进入 Mock 安全审核和质量评分。</div>
            {preview ? (
              <article className="card">
                <h3>{preview.title}</h3>
                <p>{preview.summary}</p>
              </article>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
