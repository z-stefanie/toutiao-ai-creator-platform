import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: '头条 AI 创作者平台',
  description: 'AI creator assistance, content safety, and ranked distribution MVP.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <Link className="brand" href="/dashboard">
              <span className="brand-mark">头</span>
              <span>AI 创作者平台</span>
            </Link>
            <nav className="nav" aria-label="主导航">
              <Link href="/dashboard">工作台</Link>
              <Link href="/create">AI 创作</Link>
              <Link href="/prompts">Prompt</Link>
              <Link href="/assets">素材</Link>
              <Link href="/feed/hot">热点</Link>
              <Link href="/feed/viral">爆文</Link>
              <Link href="/feed/recommended">推荐</Link>
              <Link href="/login">登录</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

