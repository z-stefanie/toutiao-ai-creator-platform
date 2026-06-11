'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { AuthGate } from '@/components/auth-gate';
import { apiFetch } from '@/lib/client-api';
import type { Prompt } from '@/lib/types';

export default function PromptsPage() {
  return <AuthGate>{() => <PromptContent />}</AuthGate>;
}

function PromptContent() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [name, setName] = useState('信息流图文模板');
  const [template, setTemplate] = useState('请生成结构清晰、信息密度高、适合今日头条信息流消费的短图文。');
  const [message, setMessage] = useState('');

  async function loadPrompts() {
    const data = await apiFetch<{ prompts: Prompt[] }>('/api/prompts');
    setPrompts(data.prompts);
  }

  useEffect(() => {
    void loadPrompts();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    const data = await apiFetch<{ prompt: Prompt }>('/api/prompts', {
      method: 'POST',
      body: JSON.stringify({ name, template, description: '用户自定义创作模板', category: 'short_post' })
    });
    setPrompts((current) => [data.prompt, ...current]);
    setMessage('Prompt 已创建，可在 AI 创作页选择。');
  }

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Prompt 管理</h1>
          <p className="page-subtitle">Prompt 是 AI 生成稳定性的源头，MVP 支持基础创建和选择。</p>
        </div>
      </div>
      <div className="grid two">
        <section className="panel">
          <h2>创建 Prompt</h2>
          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              <span className="label">名称</span>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="field">
              <span className="label">模板</span>
              <textarea className="textarea" value={template} onChange={(event) => setTemplate(event.target.value)} />
            </label>
            {message ? <div className="notice success">{message}</div> : null}
            <button className="button primary" type="submit">
              <Plus size={18} />
              创建
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>已有 Prompt</h2>
          <div className="stack">
            {prompts.map((prompt) => (
              <article className="card" key={prompt.id}>
                <div className="badge-row">
                  <span className="badge">{prompt.category}</span>
                  <span className="badge success">{prompt.status}</span>
                </div>
                <h3>{prompt.name}</h3>
                <p className="meta">{prompt.description}</p>
                <p>{prompt.template}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

