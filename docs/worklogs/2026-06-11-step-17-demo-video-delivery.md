# 2026-06-11 技术留存：Step 17 演示视频交付

> 后续 Step 18 已重新录制修正版视频，解决字幕时间码与真实时间不匹配、后段画面静止的问题。当前最终视频仍使用稳定文件名 `artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm`，以 Step 18 验证结果为准。

## 本轮目标

完成 Goal 3：交付 3-5 分钟演示视频脚本、录制路径和最终视频文件，覆盖创作、审核、合规改写、分发、详情和技术证据。

## 新增内容

新增演示脚本：

```text
docs/demo-script.md
```

该脚本包含：

- 时间轴。
- 页面路径。
- 点击动作。
- 解说词 / 字幕。
- 预期画面。
- 录制验收清单。

新增自动录制脚本：

```text
scripts/record-demo-video.mjs
```

新增 npm 命令：

```bash
npm run demo:record
```

## 录制方式

录制脚本使用 Playwright 自动操作页面，并启用 `recordVideo` 生成 WebM 文件。

录制默认地址：

```text
http://localhost:3000
```

录制默认使用：

```text
AI_PROVIDER=mock
```

原因：

- Mock Provider 响应稳定，适合 3-5 分钟演示节奏。
- 真实模型 smoke test 已单独验证，视频中用字幕说明结果，不把长耗时真实模型调用放进现场演示链路。

## 视频覆盖链路

最终视频覆盖：

```text
登录
  -> 创作者工作台
  -> AI 内容创作
  -> 短图文编辑器
  -> 段落局部重写
  -> 发布前审核拦截
  -> 合规改写
  -> 再次发布
  -> 热点 / 爆文 / 推荐榜单
  -> 内容详情与排序解释
  -> 技术证据字幕
```

其中字幕明确说明：

- 默认演示使用 Mock Provider。
- 真实模型 smoke test 覆盖生成、审核、合规改写、质量评分，结果 4/4 通过。
- 工程证据包括 E2E、evals、AI 调用日志和线上 LCP 1488ms。

## 最终视频产物

稳定文件名：

```text
artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm
```

当前最终 Playwright 输出目录：

```text
artifacts/demo-video/2026-06-11T11-10-03-043Z/
```

录制结果：

```json
{
  "ok": true,
  "baseUrl": "http://localhost:3000",
  "contentId": "content_c09c8b4f"
}
```

视频文件验证：

```text
size=10M
duration=00:03:01.36
resolution=1280x720
codec=vp8/webm
```

## 同步更新

同步更新：

- `README.md`
  - 增加演示视频录制命令和最终视频路径。
- `docs/submission-checklist.md`
  - 将 3-5 分钟演示视频状态改为 `done`。
  - 推荐下一步变为上传飞书附件或云盘链接。
- `docs/final-submission-draft.md`
  - 填入本地视频文件路径、时长、分辨率和说明。
- `docs/project-self-review.md`
  - 将“演示视频待补”改为“已产出本地 WebM，待上传为链接”。
- `.gitignore`
  - 增加 `artifacts/`，避免生成视频和中间失败片段进入代码版本管理。

## 遇到的问题与处理

1. 本地 Next.js 开发服务在默认沙箱内监听端口返回 `listen EPERM`。
   - 处理：使用已授权的提升权限启动 `npm run dev -- -p 3000`。
2. Playwright 录制需要 ffmpeg 组件，本机缓存最初缺失。
   - 处理：执行 `npx playwright install ffmpeg` 安装 Playwright 自带 ffmpeg。
3. 使用 `127.0.0.1` 访问 Next dev 时触发 HMR allowed origin 限制。
   - 处理：录制默认地址改为 `http://localhost:3000`。
4. 字幕中的“排序解释”与页面标题同名，导致选择器 strict mode 冲突。
   - 处理：改为等待 `getByRole('heading', { name: '排序解释' })`。

## 当前剩余提交缺口

Goal 3 完成后，主要剩余缺口是：

- 将 WebM 视频上传为飞书附件、云盘链接或其他可访问视频链接。
- 创建飞书提交模板副本并回填视频、文档、在线地址和代码包。
- 生成最终代码压缩包。
- 做最终敏感信息扫描和 Git 状态清理。
- 如官方必须要求 GitHub，仍需处理 `main/master` 分支和远端提交。
