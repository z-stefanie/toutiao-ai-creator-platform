# 2026-06-11 技术留存：部署与线上性能证据

## 本轮目标

完成 Goal 1：把项目部署到可访问环境，拿到在线体验地址，并补齐榜单页 LCP / Performance 证据。

## 部署方式

本轮采用生产构建 + Cloudflare quick tunnel：

```text
npm run db:generate
npm run db:push
npm run db:seed
npm run build
tmux new-session -d -s toutiao-next 'cd <project-root> && AI_PROVIDER=mock npm run start -- -p 3002'
tmux new-session -d -s toutiao-tunnel '/tmp/cloudflared tunnel --url http://127.0.0.1:3002'
```

生产服务：

```text
http://localhost:3002
```

公网体验地址：

```text
https://freedom-physicians-neighborhood-photographs.trycloudflare.com
```

说明：

- 该地址是 Cloudflare quick tunnel 临时地址，需要保持本机生产服务和 `cloudflared tunnel` 进程运行。
- quick tunnel 无长期 SLA；正式提交如需长期稳定访问，建议替换为 Vercel、服务器或命名 Cloudflare Tunnel 后复测。

## 验证脚本

新增：

```text
scripts/verify-deployment.mjs
```

运行：

```bash
DEPLOY_URL=https://freedom-physicians-neighborhood-photographs.trycloudflare.com node scripts/verify-deployment.mjs
```

脚本覆盖：

- 打开公网 `/login`。
- 使用演示账号登录。
- 进入 `/create` 生成草稿。
- 发布并审核。
- 通过公网 `/api/feed/hot?limit=50` 验证内容进入热点榜单。
- 进入 `/content/:id?feed=hot` 验证详情页和排序解释。
- 打开 `/feed/hot` 采集 Performance 指标。

## 在线验证结果

验证时间：

```text
2026-06-11T06:46:03.789Z
```

测试账号：

```text
demo@toutiao.ai / demo123456
```

验证结果：

```json
{
  "ok": true,
  "deployUrl": "https://freedom-physicians-neighborhood-photographs.trycloudflare.com",
  "testedAt": "2026-06-11T06:46:03.789Z",
  "testAccount": "demo@toutiao.ai / demo123456",
  "publishedContentId": "content_f4869d1c",
  "feedHot": {
    "domContentLoadedMs": 639,
    "loadMs": 639,
    "firstContentfulPaintMs": 656,
    "largestContentfulPaintMs": 1488
  }
}
```

结论：

- 公网 URL 可访问。
- 测试账号可登录。
- 主链路可跑通：登录 -> 生成 -> 发布审核 -> 热点榜单 -> 内容详情。
- 榜单页 LCP 为 `1488ms`，低于课题要求的 `2500ms`。

## 文档更新

已更新：

- `README.md`：新增在线体验地址、测试账号、部署验证结果和验证命令。
- `docs/evaluation-report.md`：新增公网入口 Performance 记录和 LCP 结论。
- `docs/submission-checklist.md`：将在线地址、测试账号、评估报告、性能优化证据同步为当前状态。
