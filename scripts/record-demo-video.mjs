import { chromium } from '@playwright/test';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const baseUrl = (process.env.DEMO_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const outputRoot = path.resolve(process.env.DEMO_VIDEO_DIR ?? 'artifacts/demo-video');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outputRoot, timestamp);
const viewport = { width: 1280, height: 720 };

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', headless: true });
  } catch (error) {
    console.warn(
      `[demo] Could not launch Chrome channel, falling back to bundled Chromium: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return chromium.launch({ headless: true });
  }
}

async function wait(seconds) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function setCaption(page, title, body) {
  await page.evaluate(
    ({ title: nextTitle, body: nextBody }) => {
      const styleId = '__toutiao_demo_caption_style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          #__toutiao_demo_caption {
            position: fixed;
            left: 32px;
            right: 32px;
            bottom: 24px;
            z-index: 2147483647;
            display: grid;
            gap: 8px;
            padding: 16px 18px;
            border: 1px solid rgba(255, 255, 255, 0.28);
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.88);
            color: #fff;
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
            pointer-events: none;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          #__toutiao_demo_caption strong {
            font-size: 18px;
            line-height: 1.35;
          }
          #__toutiao_demo_caption span {
            font-size: 15px;
            line-height: 1.55;
            color: rgba(255, 255, 255, 0.88);
          }
        `;
        document.head.appendChild(style);
      }

      let caption = document.getElementById('__toutiao_demo_caption');
      if (!caption) {
        caption = document.createElement('div');
        caption.id = '__toutiao_demo_caption';
        caption.innerHTML = '<strong></strong><span></span>';
        document.body.appendChild(caption);
      }

      caption.querySelector('strong').textContent = nextTitle;
      caption.querySelector('span').textContent = nextBody;
    },
    { title, body }
  );
}

async function goto(page, pathname, caption) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'networkidle' });
  await setCaption(page, caption.title, caption.body);
}

async function clickAndWaitForUrl(page, locator, urlPattern, fallbackPathname) {
  await locator.click();
  try {
    await page.waitForURL(urlPattern, { timeout: 8_000 });
  } catch {
    await page.goto(`${baseUrl}${fallbackPathname}`, { waitUntil: 'networkidle' });
  }
}

async function loginFromDemoPage(page) {
  await page.getByRole('button', { name: '登录' }).click();
  try {
    await page.waitForURL(/\/dashboard$/, { timeout: 8_000 });
  } catch {
    const response = await page.request.post(`${baseUrl}/api/auth/login`, {
      data: {
        email: 'demo@toutiao.ai',
        password: 'demo123456'
      }
    });
    if (!response.ok()) {
      throw new Error(`Fallback login failed with status ${response.status()}.`);
    }
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
  }
}

async function safeScroll(page, y) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), y);
  await wait(2);
}

async function findPublishedItem(page, topic) {
  const feedResponse = await page.request.get(`${baseUrl}/api/feed/hot?limit=30`);
  const feedPayload = await feedResponse.json();
  if (!feedPayload.ok) {
    throw new Error('Hot feed API did not return ok=true.');
  }
  const item = feedPayload.data.items.find((candidate) => candidate.title.includes(topic));
  if (!item) {
    throw new Error(`Published item for topic "${topic}" was not found in hot feed.`);
  }
  return item;
}

await mkdir(runDir, { recursive: true });

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport,
  recordVideo: {
    dir: runDir,
    size: viewport
  }
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);

try {
  const topic = `AI Coding 时代的内容生产闭环 ${Date.now()}`;

  await goto(page, '/login', {
    title: '登录与主线概览',
    body: '演示使用 Mock Provider，保证现场稳定；真实模型接入会在结尾用 smoke test 证据说明。'
  });
  await wait(8);
  await loginFromDemoPage(page);
  await setCaption(page, '创作者工作台', '工作台聚合创作入口、最近草稿、榜单反馈和当前 Mock AI 模式。');
  await wait(10);

  await clickAndWaitForUrl(page, page.getByRole('link', { name: 'AI 创作' }).first(), /\/create$/, '/create');
  await setCaption(page, 'AI 内容创作', '输入主题、受众和语气，结合 Prompt 与素材生成结构化短图文草稿。');
  await page.getByRole('textbox', { name: '主题' }).fill(topic);
  await page.getByRole('textbox', { name: '目标受众' }).fill('今日头条内容创作者');
  await page.getByRole('textbox', { name: '语气风格' }).fill('清晰、克制、有信息量');
  await wait(8);
  await page.getByRole('button', { name: '生成草稿' }).click();
  await page.waitForURL(/\/editor\/draft_/);
  await page.getByRole('heading', { name: '图文编辑器' }).waitFor();

  await setCaption(page, '短图文智能编辑器', 'AI 生成完整草稿后，人可以修改标题、摘要、正文，并查看封面建议和 AI 配图建议。');
  await wait(10);
  await safeScroll(page, 360);
  await setCaption(page, '逐段确认与局部重写', '段落创意卡片支持局部重写，避免一键生成后不可控。');
  await page.getByRole('button', { name: '局部重写第 1 段' }).click();
  await page.getByText('第 1 段已完成局部重写，可继续逐段确认。').waitFor();
  await wait(12);
  await safeScroll(page, 0);
  await page.getByRole('button', { name: '保存草稿' }).click();
  await page.getByText(/草稿已保存，版本/).waitFor();

  await setCaption(page, '发布前安全审核', '现在故意加入风险词，验证规则预筛和 Mock 审核会在发布前拦截高危表达。');
  const bodyBox = page.getByRole('textbox', { name: '正文' });
  await bodyBox.fill(`${await bodyBox.inputValue()}\n\n这里加入赌博风险词，用于验证审核拦截和合规改写。`);
  await wait(8);
  await page.getByRole('button', { name: '发布并审核' }).click();
  await page.getByText('审核未通过').waitFor();
  await page.getByText('gambling: 赌博').waitFor();
  await setCaption(page, '审核拦截结果', '审核未通过，命中 gambling: 赌博；内容不会进入榜单分发。');
  await wait(12);

  await page.getByRole('button', { name: '合规改写' }).click();
  await page.getByText('已生成合规替代内容，请确认后再次发布。').waitFor();
  await setCaption(page, '合规改写', '系统生成合规替代表达，创作者确认后可以再次发布。');
  await wait(10);
  await page.getByRole('button', { name: '发布并审核' }).click();
  await page.getByText('发布成功').waitFor();
  await setCaption(page, '发布成功与质量评分', '内容通过审核后进入质量评分，质量分会参与后续榜单排序。');
  await wait(12);

  await clickAndWaitForUrl(page, page.getByRole('link', { name: '去热点榜单' }), /\/feed\/hot$/, '/feed/hot');
  await page.getByRole('heading', { name: '热点榜单' }).waitFor();
  await setCaption(page, '热点榜单分发', '发布内容进入信息流分发；热点榜单综合质量、热度、新鲜度和反馈。');
  await wait(12);

  await clickAndWaitForUrl(page, page.getByRole('link', { name: '爆文' }).first(), /\/feed\/viral$/, '/feed/viral');
  await setCaption(page, '动态加权榜单', '切换到爆文榜单后，热度和反馈权重更高；推荐榜单则更偏质量。');
  await wait(10);
  await clickAndWaitForUrl(page, page.getByRole('link', { name: '推荐' }).first(), /\/feed\/recommended$/, '/feed/recommended');
  await wait(8);

  const publishedItem = await findPublishedItem(page, topic);
  await goto(page, `/content/${publishedItem.id}?feed=hot`, {
    title: '内容详情与排序解释',
    body: '详情页展示质量分、热度分、新鲜度、反馈分和 activeRankingScore 公式。'
  });
  await page.getByRole('heading', { name: '排序解释' }).waitFor();
  await safeScroll(page, 760);
  await wait(12);

  await setCaption(
    page,
    '技术证据与边界',
    'E2E、evals、AI 调用日志、线上 LCP 1488ms 已留存；真实模型 smoke test 生成/审核/改写/评分 4/4 通过。'
  );
  await safeScroll(page, 0);
  await wait(6);
  await safeScroll(page, 760);
  await wait(6);

  await goto(page, '/dashboard', {
    title: '当前版本定位',
    body: '这是可演示 MVP：主链路完整、边界清楚；生产化还需要真实账号体系、对象存储和稳定部署。'
  });
  await wait(12);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        topic,
        contentId: publishedItem.id,
        outputDir: runDir
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
        baseUrl,
        outputDir: runDir,
        error: error instanceof Error ? error.message : 'Unknown demo recording error.'
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

const files = await stat(runDir).then(() => runDir);
console.log(`[demo] Video artifacts are under ${files}`);
