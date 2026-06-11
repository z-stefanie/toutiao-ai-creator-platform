import { chromium } from '@playwright/test';

const deployUrl = process.env.DEPLOY_URL?.replace(/\/+$/, '');
if (!deployUrl) {
  console.error('DEPLOY_URL is required.');
  process.exit(1);
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  const topic = `部署验证 ${Date.now()}`;

  await page.goto(`${deployUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL(/\/dashboard$/);

  await page.goto(`${deployUrl}/create`, { waitUntil: 'networkidle' });
  await page.getByRole('textbox', { name: '主题' }).fill(topic);
  await page.getByRole('button', { name: '生成草稿' }).click();
  await page.waitForURL(/\/editor\/draft_/);

  await page.getByRole('button', { name: '发布并审核' }).click();
  await page.getByText('发布成功').waitFor({ timeout: 15_000 });

  const feedResponse = await page.request.get(`${deployUrl}/api/feed/hot?limit=50`);
  const feedPayload = await feedResponse.json();
  if (!feedPayload.ok) {
    throw new Error('Feed API did not return ok=true.');
  }

  const publishedItem = feedPayload.data.items.find((item) => item.title.includes(`${topic}：给`));
  if (!publishedItem) {
    throw new Error('Published item was not found in hot feed.');
  }

  await page.goto(`${deployUrl}/content/${publishedItem.id}?feed=hot`, { waitUntil: 'networkidle' });
  await page.getByText('排序解释').waitFor({ timeout: 15_000 });

  await page.addInitScript(() => {
    window.__toutiaoLcpMs = null;
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries.at(-1);
        if (lastEntry) {
          window.__toutiaoLcpMs = Math.round(lastEntry.startTime);
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      window.__toutiaoLcpMs = null;
    }
  });
  await page.goto(`${deployUrl}/feed/hot`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const timing = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paintEntries = performance.getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
    const largestContentfulPaintEntries = performance.getEntriesByType('largest-contentful-paint');
    const largestContentfulPaint = largestContentfulPaintEntries.at(-1);
    return {
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd - navigation.startTime),
      loadMs: Math.round(navigation.loadEventEnd - navigation.startTime),
      firstContentfulPaintMs: firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : null,
      largestContentfulPaintMs:
        window.__toutiaoLcpMs ?? (largestContentfulPaint ? Math.round(largestContentfulPaint.startTime) : null)
    };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        deployUrl,
        testedAt: new Date().toISOString(),
        testAccount: 'demo@toutiao.ai / demo123456',
        publishedContentId: publishedItem.id,
        feedHot: timing
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        deployUrl,
        error: error instanceof Error ? error.message : 'Unknown deployment verification error.'
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
