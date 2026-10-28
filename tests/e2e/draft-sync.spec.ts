import { expect, test, type Page } from '@playwright/test';
import type { Draft } from '../../src/lib/types';
import { login, generateDraft, draftIdFromUrl } from './helpers';

const body = (page: Page) => page.getByRole('textbox', { name: '正文', exact: true });
const status = (page: Page) => page.getByTestId('sync-status');

async function cloud(page: Page, id = draftIdFromUrl(page)): Promise<Draft> {
  const response = await page.request.get(`/api/drafts/${id}`);
  expect(response.status()).toBe(200);
  return (await response.json()).data.draft;
}

async function save(page: Page) {
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(status(page)).toContainText('已同步到云端');
}

async function openDraft(page: Page, id: string) {
  await page.goto(`/editor/${id}`);
  await expect(page.getByRole('heading', { name: '图文编辑器' })).toBeVisible();
}

test('online edits survive closing before cloud synchronization', async ({ page, context }) => {
  await login(page);
  await generateDraft(page, '在线关页恢复');
  const id = draftIdFromUrl(page);
  const text = '在线关页前尚未同步的内容';
  await page.route(`**/api/drafts/${id}`, (route) => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue());
  await body(page).fill(text);
  await expect(status(page)).toContainText('已保存到本机');
  await page.close();
  const reopened = await context.newPage();
  await openDraft(reopened, id);
  await expect(body(reopened)).toHaveValue(text);
  await expect(status(reopened)).toContainText('已同步到云端');
  expect((await cloud(reopened)).body).toBe(text);
});

test('offline edits survive close and synchronize on online reopen', async ({ page, context }) => {
  await login(page);
  await generateDraft(page, '断网关页恢复');
  const id = draftIdFromUrl(page);
  await context.setOffline(true);
  await body(page).fill('离线持久化的正文');
  await expect(status(page)).toHaveText('离线中：修改已保存在本机，联网后自动同步');
  await page.close();
  await context.setOffline(false);
  const reopened = await context.newPage();
  await openDraft(reopened, id);
  await expect(body(reopened)).toHaveValue('离线持久化的正文');
  await expect(status(reopened)).toContainText('已同步到云端');
  expect((await cloud(reopened)).body).toBe('离线持久化的正文');
});

test('lost response replays the same operation without incrementing twice', async ({ page }) => {
  await login(page);
  await generateDraft(page, '幂等重放');
  const initial = await cloud(page);
  const keys: string[] = [];
  await page.route(`**/api/drafts/${initial.id}`, async (route) => {
    if (route.request().method() !== 'PATCH') { await route.continue(); return; }
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length === 1) { await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await body(page).fill('服务端写入成功但响应丢失');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(status(page)).toHaveText('同步失败，稍后自动重试');
  await expect(status(page)).toContainText('已同步到云端', { timeout: 10000 });
  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(new Set(keys).size).toBe(1);
  expect((await cloud(page)).version).toBe(initial.version + 1);
  await expect(page.getByRole('region', { name: '冲突处理' })).toHaveCount(0);
});

test('late acknowledgment does not confirm edits made during the request', async ({ page }) => {
  await login(page);
  await generateDraft(page, '旧响应晚到');
  const id = draftIdFromUrl(page);
  let received = false;
  let fulfilled = false;
  await page.route(`**/api/drafts/${id}`, async (route) => {
    if (route.request().method() !== 'PATCH' || received) { await route.continue(); return; }
    const response = await route.fetch();
    received = true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.fulfill({ response }); fulfilled = true;
  });
  await body(page).fill('第一次编辑');
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await body(page).fill('请求期间继续编辑');
  await expect.poll(() => fulfilled).toBe(true);
  await expect(status(page)).toHaveText('已保存到本机，等待同步');
  await expect(body(page)).toHaveValue('请求期间继续编辑');
  await save(page);
  expect((await cloud(page)).body).toBe('请求期间继续编辑');
});

test('independent devices automatically merge changes to different paragraphs', async ({ page, browser, baseURL }) => {
  await login(page);
  await generateDraft(page, '多设备自动合并');
  await body(page).fill('原始第一段\n\n原始第二段');
  await save(page);
  const id = draftIdFromUrl(page);
  const otherContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  try {
    const other = await otherContext.newPage();
    await login(other); await openDraft(other, id);
    await body(page).fill('设备甲第一段\n\n原始第二段');
    await body(other).fill('原始第一段\n\n设备乙第二段');
    await save(page); await save(other);
    expect((await cloud(other)).body).toBe('设备甲第一段\n\n设备乙第二段');
    await expect(other.getByText(/已合并云端的正文/)).toBeVisible();
  } finally { await otherContext.close(); }
});

test('conflicting devices preserve both versions and can save a separate copy', async ({ page, browser, baseURL }) => {
  await login(page);
  await generateDraft(page, '多设备手动合并');
  await body(page).fill('相同段落'); await save(page);
  const id = draftIdFromUrl(page);
  const otherContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  try {
    let other = await otherContext.newPage();
    await login(other); await openDraft(other, id);
    await body(page).fill('云端段落'); await body(other).fill('我的段落');
    await other.getByRole('textbox', { name: '标题', exact: true }).fill('长'.repeat(120));
    await save(page);
    await other.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect(other.getByRole('region', { name: '冲突处理' })).toBeVisible();
    await expect(body(other)).toBeDisabled();
    await other.getByRole('button', { name: '把我的版本另存为新草稿' }).click();
    const link = other.getByRole('link', { name: '查看另存的新草稿' });
    await expect(link).toBeVisible();
    const copyId = (await link.getAttribute('href'))?.split('/').pop();
    expect(copyId).toBeTruthy();
    expect(copyId).not.toBe(id);
    const copy = await cloud(other, copyId);
    expect(copy.body).toBe('我的段落');
    expect(copy.title).toHaveLength(120);
    expect(copy.title.endsWith('（冲突副本）')).toBe(true);
    await expect(other.getByRole('region', { name: '冲突处理' })).toBeVisible();
    await other.close();
    other = await otherContext.newPage();
    await openDraft(other, id);
    await expect(other.getByRole('region', { name: '冲突处理' })).toBeVisible();
    await expect(body(other)).toHaveValue('我的段落');
    await other.getByRole('radio', { name: '两者都保留' }).check();
    await other.getByRole('button', { name: '确认合并' }).click();
    await expect(status(other)).toContainText('已同步到云端');
    expect((await cloud(other)).body).toBe('云端段落\n\n我的段落');
  } finally { await otherContext.close(); }
});

test('a waiting tab acquires the writer lock and reloads the latest local replica', async ({ page, context }) => {
  await login(page);
  await generateDraft(page, '多标签页被动接管');
  const id = draftIdFromUrl(page);
  const other = await context.newPage();
  await openDraft(other, id);
  await expect(status(other)).toHaveText('这篇草稿正在另一个标签页中编辑');
  await expect(body(other)).toBeDisabled();
  await body(page).fill('接管时必须重新读取的本机内容');
  await expect(status(page)).toContainText('已保存到本机');
  await page.close();
  await expect(body(other)).toBeEnabled();
  await expect(body(other)).toHaveValue('接管时必须重新读取的本机内容');
  await expect(status(other)).toContainText('已同步到云端');
});

test('unavailable IndexedDB degrades to memory without claiming local durability', async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.open = () => { throw new DOMException('Storage is disabled', 'SecurityError'); };
    const observer = new MutationObserver(() => {
      const text = document.querySelector('[data-testid="sync-status"]')?.textContent ?? '';
      if (text.includes('已保存到本机')) document.documentElement.dataset.falseDurability = 'true';
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
  });
  await login(page);
  await generateDraft(page, '本地存储不可用');
  const warning = page.getByText('当前浏览器无法使用本地存储，关闭页面前请确认已同步到云端');
  await expect(warning).toBeVisible();
  await body(page).fill('内存中编辑也可以同步');
  await save(page);
  expect((await cloud(page)).body).toBe('内存中编辑也可以同步');
  await expect(warning).toBeVisible();
  expect(await page.locator('html').getAttribute('data-false-durability')).toBeNull();
});

test('failed IndexedDB writes still synchronize and warn before unloading unsynced edits', async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = () => { throw new DOMException('quota full', 'QuotaExceededError'); };
    const observer = new MutationObserver(() => {
      const text = document.querySelector('[data-testid="sync-status"]')?.textContent ?? '';
      if (text.includes('已保存到本机')) document.documentElement.dataset.falseDurability = 'true';
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
  });
  const unloadPrevented = () => page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  await login(page);
  await generateDraft(page, '本机写入失败');
  await expect(status(page)).toHaveText('本机保存失败：quota full');
  expect(await unloadPrevented()).toBe(false);
  const initial = await cloud(page);
  const text = '本机配额不足时仍需同步到云端';
  await body(page).fill(text);
  expect(await unloadPrevented()).toBe(true);
  await page.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(page.getByText(`草稿已保存，版本 ${initial.version + 1}`, { exact: true })).toBeVisible();
  expect((await cloud(page)).body).toBe(text);
  await expect(status(page)).toHaveText('本机保存失败：quota full');
  expect(await unloadPrevented()).toBe(false);
  expect(await page.locator('html').getAttribute('data-false-durability')).toBeNull();
});

test('publishing flushes the visible edits and refuses to publish offline', async ({ page, context }) => {
  await login(page);
  await generateDraft(page, '发布可见版本');
  const id = draftIdFromUrl(page);
  const text = '点击发布之前立即输入的正文';
  await body(page).fill(text);
  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('发布成功')).toBeVisible();
  await page.getByRole('link', { name: '查看详情' }).click();
  await expect(page).toHaveURL(/\/content\/content_/);
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await openDraft(page, id);
  let publishes = 0;
  page.on('request', (request) => { if (request.url().endsWith('/api/contents/publish')) publishes += 1; });
  await context.setOffline(true);
  await body(page).fill('不能离线发布这次编辑');
  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText(/草稿还没有同步到云端，暂时不能发布：/)).toBeVisible();
  expect(publishes).toBe(0);
});

test('paragraph AI suggestions are discarded when the paragraph changes while generating', async ({ page }) => {
  await login(page);
  await generateDraft(page, 'AI 结果绑定');
  const initial = await cloud(page);
  let received = false;
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/ai/rewrite-paragraph', async (route) => {
    const response = await route.fetch(); received = true;
    await gate; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '局部重写第 1 段' }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole('textbox', { name: '段落 1', exact: true }).fill('生成过程中手动修改');
  release();
  await expect(page.getByText('这一段在生成期间被修改，已放弃本次改写，请重试')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '段落 1', exact: true })).toHaveValue('生成过程中手动修改');
  expect((await cloud(page)).version).toBe(initial.version);
});

test('active takeover transfers the writer lock and later returns it with current content', async ({ page, context }) => {
  await login(page);
  await generateDraft(page, '主动接管编辑');
  const id = draftIdFromUrl(page);
  const other = await context.newPage();
  await openDraft(other, id);
  await expect(body(other)).toBeDisabled();
  await body(page).fill('让出前的未同步编辑');
  await expect(status(page)).toContainText('已保存到本机');
  await other.getByRole('button', { name: '在此处编辑' }).click();
  await expect(body(other)).toBeEnabled();
  await expect(body(other)).toHaveValue('让出前的未同步编辑');
  await expect(status(page)).toHaveText('这篇草稿正在另一个标签页中编辑');
  await expect(body(page)).toBeDisabled();
  await body(other).fill('接管后的新内容'); await save(other);
  await other.close();
  await expect(body(page)).toBeEnabled();
  await expect(body(page)).toHaveValue('接管后的新内容');
  expect((await cloud(page)).body).toBe('接管后的新内容');
});

test('history previews paragraph differences and restores through a new version', async ({ page }) => {
  await login(page);
  await generateDraft(page, '历史版本恢复');
  const initial = await cloud(page);
  await body(page).fill('恢复前需要保留的当前正文'); await save(page);
  const edited = await cloud(page);
  await page.getByRole('button', { name: '历史版本', exact: true }).click();
  const history = page.getByRole('region', { name: '版本历史', exact: true });
  await history.getByRole('button', { name: /新建 · 版本 1/ }).click();
  await expect(history.getByRole('region', { name: '版本预览' })).toBeVisible();
  await expect(page.getByTestId('history-diff')).toContainText('删除：恢复前需要保留的当前正文');
  await expect(page.getByTestId('history-diff')).toContainText(`新增：${initial.body.split('\n\n')[0]}`);
  await history.getByRole('button', { name: '恢复此版本' }).click();
  await expect(history.getByText(/已恢复到 .* 的版本/)).toBeVisible();
  await expect(body(page)).toHaveValue(initial.body);
  const restored = await cloud(page);
  expect(restored.body).toBe(initial.body);
  expect(restored.version).toBe(edited.version + 1);
  await expect(history.getByRole('button', { name: /恢复前 · 版本/ })).toBeVisible();
  await expect(history.getByRole('button', { name: /恢复后 · 版本/ })).toBeVisible();
  await history.getByRole('button', { name: /恢复前 · 版本/ }).click();
  await history.getByRole('button', { name: '恢复此版本' }).click();
  await expect(body(page)).toHaveValue('恢复前需要保留的当前正文');
  await expect(status(page)).toContainText('已同步到云端');
  expect((await cloud(page)).version).toBe(restored.version + 1);
});

test('compliant AI suggestions are discarded if any local field changes', async ({ page }) => {
  await login(page);
  await generateDraft(page, '合规改写绑定修订');
  await body(page).fill('赌博内容用于验证审核拒绝');
  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('审核未通过')).toBeVisible();
  const before = await cloud(page);
  let received = false;
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/ai/rewrite-compliant', async (route) => {
    const response = await route.fetch(); received = true;
    await gate; await route.fulfill({ response });
  });
  await page.getByRole('button', { name: '合规改写', exact: true }).click();
  await expect.poll(() => received).toBe(true);
  await page.getByRole('textbox', { name: '标题', exact: true }).fill('生成过程中修改的标题');
  release();
  await expect(page.getByText('内容在生成期间被修改，已放弃本次改写，请重试')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '标题', exact: true })).toHaveValue('生成过程中修改的标题');
  await expect(body(page)).toHaveValue('赌博内容用于验证审核拒绝');
  expect((await cloud(page)).version).toBe(before.version);
});
