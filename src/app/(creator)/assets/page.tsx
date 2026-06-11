'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { apiFetch, formatDateTime } from '@/lib/client-api';
import type { Asset } from '@/lib/types';

export default function AssetsPage() {
  return <AuthGate>{() => <AssetsContent />}</AuthGate>;
}

function AssetsContent() {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    void apiFetch<{ assets: Asset[] }>('/api/assets').then((data) => setAssets(data.assets));
  }, []);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">素材管理</h1>
          <p className="page-subtitle">当前使用内置演示素材，素材合规状态会参与创作入口展示。</p>
        </div>
      </div>
      <section className="grid two">
        {assets.map((asset) => (
          <article className="panel" key={asset.id}>
            <Image
              alt={asset.filename}
              src={asset.url}
              width={960}
              height={540}
              style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid var(--line)' }}
            />
            <h2>{asset.filename}</h2>
            <div className="badge-row">
              <span className="badge success">{asset.complianceStatus}</span>
              <span className="badge">{asset.mimeType}</span>
              <span className="badge">{formatDateTime(asset.createdAt)}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

