import { expect, test, type Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /今天从一条可发布链路开始/ })).toBeVisible();
}

async function generateDraft(page: Page, topic: string) {
  await page.goto('/create');
  await page.getByRole('textbox', { name: '主题' }).fill(topic);
  await expect(page.getByText('city-workspace.svg · passed')).toBeVisible();
  await page.getByRole('button', { name: '生成草稿' }).click();
  await expect(page).toHaveURL(/\/editor\/draft_/);
  await expect(page.getByRole('heading', { name: '图文编辑器' })).toBeVisible();
}

function draftIdFromUrl(page: Page) {
  const match = page.url().match(/\/editor\/([^/?#]+)/);
  expect(match).not.toBeNull();
  return match?.[1] ?? '';
}

test('creator can generate, save, publish, and read ranked content', async ({ page }) => {
  const topic = `E2E 主链路 ${Date.now()}`;

  await login(page);
  await generateDraft(page, topic);

  await expect(page.getByText('封面建议')).toBeVisible();
  await expect(page.getByText('AI 配图建议')).toBeVisible();
  await page.getByRole('button', { name: '局部重写第 1 段' }).click();
  await expect(page.getByText('第 1 段已完成局部重写，可继续逐段确认。')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '段落 1' })).toHaveValue(/局部重写/);

  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByText(/草稿已保存，版本/)).toBeVisible();

  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('发布成功')).toBeVisible();
  await expect(page.getByText(/质量分 \d+/)).toBeVisible();

  await page.getByRole('link', { name: '去热点榜单' }).click();
  await expect(page).toHaveURL(/\/feed\/hot$/);

  const feedResponse = await page.request.get('/api/feed/hot?limit=50');
  const feedPayload = await feedResponse.json();
  expect(feedPayload.ok).toBe(true);
  const publishedItem = feedPayload.data.items.find((item: { title: string }) =>
    item.title.includes(`${topic}：给`)
  );
  expect(publishedItem).toBeTruthy();

  await page.goto(`/content/${publishedItem.id}?feed=hot`);
  await expect(page).toHaveURL(/\/content\/content_/);
  await expect(page.getByText('排序解释')).toBeVisible();
  await expect(page.getByText('热点榜单权重：质量 40% · 热度 30% · 新鲜度 20% · 反馈 10%')).toBeVisible();
  await expect(
    page.getByText('activeRankingScore = quality * w1 + heat * w2 + freshness * w3 + feedback * w4')
  ).toBeVisible();
});

test('offline draft edits are mirrored locally and synced after reconnect', async ({ page, context }) => {
  const topic = `E2E 离线草稿 ${Date.now()}`;

  await login(page);
  await generateDraft(page, topic);
  const draftId = draftIdFromUrl(page);

  const bodyBox = page.getByRole('textbox', { name: '正文' });
  const offlineText = `离线补写 ${Date.now()}`;
  await context.setOffline(true);
  await bodyBox.fill(`${await bodyBox.inputValue()}\n\n${offlineText}`);

  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByText(/离线草稿已保存到本地|离线编辑已写入本地镜像/)).toBeVisible();
  await expect(page.getByText('local_pending')).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText(/离线草稿已同步，版本/)).toBeVisible({ timeout: 10_000 });

  const draftResponse = await page.request.get(`/api/drafts/${draftId}`);
  const draftPayload = await draftResponse.json();
  expect(draftPayload.ok).toBe(true);
  expect(draftPayload.data.draft.body).toContain(offlineText);
});

test('published content can be edited and updates detail page', async ({ page }) => {
  const topic = `E2E 发布后编辑 ${Date.now()}`;
  const editedTitle = `${topic} 更新版`;
  const editedBody = `发布后二次编辑正文 ${Date.now()}`;

  await login(page);
  await generateDraft(page, topic);

  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('发布成功')).toBeVisible();
  await page.getByRole('link', { name: '查看详情' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(topic) })).toBeVisible();
  const contentUrl = page.url();

  await page.getByRole('link', { name: '编辑已发布内容' }).click();
  await expect(page).toHaveURL(/\/editor\/draft_/);
  await page.getByRole('textbox', { name: '标题' }).fill(editedTitle);
  await page.getByRole('textbox', { name: '正文' }).fill(editedBody);
  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('发布成功')).toBeVisible();
  await page.getByRole('link', { name: '查看详情' }).click();

  await expect(page).toHaveURL(contentUrl);
  await expect(page.getByRole('heading', { name: editedTitle })).toBeVisible();
  await expect(page.getByText(editedBody)).toBeVisible();
});

test('audit blocks risky content and compliant rewrite can publish', async ({ page }) => {
  const topic = `E2E 审核分支 ${Date.now()}`;

  await login(page);
  await generateDraft(page, topic);

  const bodyBox = page.getByRole('textbox', { name: '正文' });
  await bodyBox.fill(`${await bodyBox.inputValue()}\n\n这里加入赌博风险词，用于验证审核拦截。`);

  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('审核未通过')).toBeVisible();
  await expect(page.getByText('gambling: 赌博')).toBeVisible();

  await page.getByRole('button', { name: '合规改写' }).click();
  await expect(page.getByText('已生成合规替代内容，请确认后再次发布。')).toBeVisible();

  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('发布成功')).toBeVisible();
});

test('feed loads more items and records a first-screen performance baseline', async ({ page }) => {
  await login(page);

  for (let index = 0; index < 5; index += 1) {
    const createResponse = await page.request.post('/api/ai/generate-content', {
      data: {
        topic: `E2E 榜单加载 ${Date.now()} ${index}`,
        audience: '今日头条读者',
        tone: '清晰、有信息量',
        assetIds: ['asset_city']
      }
    });
    const createPayload = await createResponse.json();
    expect(createPayload.ok).toBe(true);

    const publishResponse = await page.request.post('/api/contents/publish', {
      data: { draftId: createPayload.data.draft.id }
    });
    const publishPayload = await publishResponse.json();
    expect(publishPayload.ok).toBe(true);
    expect(publishPayload.data.published).toBe(true);
  }

  await page.goto('/feed/hot');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.card')).toHaveCount(4);

  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      domContentLoadedMs: navigation.domContentLoadedEventEnd - navigation.startTime,
      loadMs: navigation.loadEventEnd - navigation.startTime
    };
  });
  console.log(
    `[perf] feed hot domContentLoaded=${Math.round(timing.domContentLoadedMs)}ms load=${Math.round(timing.loadMs)}ms`
  );
  expect(timing.domContentLoadedMs).toBeLessThan(2500);

  await page.getByRole('button', { name: '加载更多' }).click();
  await expect.poll(async () => page.locator('.card').count()).toBeGreaterThan(4);
});

test('feed ranking configs use different operational weights', async ({ page }) => {
  await login(page);

  const hotResponse = await page.request.get('/api/feed/hot?limit=8');
  const viralResponse = await page.request.get('/api/feed/viral?limit=8');
  const recommendedResponse = await page.request.get('/api/feed/recommended?limit=8');
  const hotPayload = await hotResponse.json();
  const viralPayload = await viralResponse.json();
  const recommendedPayload = await recommendedResponse.json();

  expect(hotPayload.ok).toBe(true);
  expect(viralPayload.ok).toBe(true);
  expect(recommendedPayload.ok).toBe(true);
  expect(viralPayload.data.rankingConfig.weights.heat).toBeGreaterThan(hotPayload.data.rankingConfig.weights.heat);
  expect(recommendedPayload.data.rankingConfig.weights.quality).toBeGreaterThan(
    hotPayload.data.rankingConfig.weights.quality
  );

  const scores = hotPayload.data.items.map((item: { rankingMetric: { activeRankingScore: number } }) =>
    item.rankingMetric.activeRankingScore
  );
  expect(scores).toEqual([...scores].sort((left, right) => right - left));

  await page.goto(`/content/${hotPayload.data.items[0].id}?feed=viral`);
  await expect(page.getByText('爆文榜单权重：质量 20% · 热度 45% · 新鲜度 10% · 反馈 25%')).toBeVisible();
});

test('governance can take published content offline', async ({ page }) => {
  const topic = `E2E 内容下线 ${Date.now()}`;

  await login(page);
  await generateDraft(page, topic);
  await page.getByRole('button', { name: '发布并审核' }).click();
  await expect(page.getByText('发布成功')).toBeVisible();
  await page.getByRole('link', { name: '查看详情' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(topic) })).toBeVisible();

  const contentId = page.url().match(/\/content\/([^/?#]+)/)?.[1];
  expect(contentId).toBeTruthy();
  const offlineResponse = await page.request.post(`/api/contents/${contentId}/offline`);
  const offlinePayload = await offlineResponse.json();
  expect(offlinePayload.ok).toBe(true);
  expect(offlinePayload.data.content.status).toBe('offline');
  expect(offlinePayload.data.governanceAction.reviewStatus).toBe('manual_review_required');

  const detailResponse = await page.request.get(`/api/feed/${contentId}`);
  const detailPayload = await detailResponse.json();
  expect(detailPayload.ok).toBe(false);
  expect(detailPayload.error.code).toBe('CONTENT_NOT_FOUND');
});
