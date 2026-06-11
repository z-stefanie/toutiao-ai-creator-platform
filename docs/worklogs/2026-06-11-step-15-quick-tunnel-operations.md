# Step 15 Cloudflare Quick Tunnel 保活方案

## 1. 本次目标

评估是否可以继续使用当前 Cloudflare quick tunnel 临时地址作为评委访问入口，并明确需要保持哪些进程和操作。

当前在线地址：

```text
https://freedom-physicians-neighborhood-photographs.trycloudflare.com
```

测试账号：

```text
demo@toutiao.ai / demo123456
```

## 2. 当前运行状态

执行时间：`2026-06-11 18:12 CST`

当前 tmux 会话：

| 会话 | 作用 | 状态 |
| --- | --- | --- |
| `toutiao-next` | 运行 `next start -p 3002` | 已运行 |
| `toutiao-tunnel` | 运行 `cloudflared tunnel --url http://127.0.0.1:3002` | 已运行 |
| `toutiao-keepawake` | 运行 `caffeinate -dimsu` 防止 Mac 休眠 | 已运行 |

当前进程：

```text
next-server (v16.2.9)
/tmp/cloudflared tunnel --url http://127.0.0.1:3002
```

当前公网连通性：

```text
curl -I https://freedom-physicians-neighborhood-photographs.trycloudflare.com
HTTP/2 307
location: /feed/hot
```

## 3. 完整链路 smoke test

验证命令：

```bash
DEPLOY_URL=https://freedom-physicians-neighborhood-photographs.trycloudflare.com node scripts/verify-deployment.mjs
```

验证结果：

```json
{
  "ok": true,
  "deployUrl": "https://freedom-physicians-neighborhood-photographs.trycloudflare.com",
  "testedAt": "2026-06-11T10:12:12.291Z",
  "testAccount": "demo@toutiao.ai / demo123456",
  "publishedContentId": "content_4051de3b",
  "feedHot": {
    "domContentLoadedMs": 740,
    "loadMs": 741,
    "firstContentfulPaintMs": 756,
    "largestContentfulPaintMs": 1548
  }
}
```

验证链路：

```text
登录 -> AI 生成 -> 发布审核 -> 热点榜单 -> 内容详情
```

## 4. 保持评委可访问需要满足的条件

必须保持：

1. Mac 持续开机、联网、接电。
2. 不让 Mac 进入睡眠；当前已通过 `toutiao-keepawake` 会话运行 `caffeinate -dimsu`。
3. 不关闭 `toutiao-next` tmux 会话。
4. 不关闭 `toutiao-tunnel` tmux 会话。
5. 不重启 `cloudflared tunnel`，除非接受 URL 可能变化。
6. 不切换到会阻断 Cloudflare QUIC / HTTPS 连接的网络环境。

风险说明：

- Cloudflare quick tunnel 是临时隧道，不是长期 SLA 服务。
- 如果 `cloudflared` 进程退出，当前临时 URL 可能失效；重新启动 quick tunnel 很可能生成新 URL。
- 如果 Mac 重启、断网、休眠，评委访问会中断。
- 如果只重启 Next.js，但不重启 tunnel，URL 通常可以保持不变，只会在重启期间短暂不可用。

## 5. 日常检查命令

查看会话：

```bash
tmux ls
```

检查公网入口：

```bash
curl -I https://freedom-physicians-neighborhood-photographs.trycloudflare.com
```

查看 Next.js 日志：

```bash
tmux capture-pane -pt toutiao-next -S -80
```

查看 Cloudflare tunnel 日志：

```bash
tmux capture-pane -pt toutiao-tunnel -S -80
```

跑完整链路验证：

```bash
DEPLOY_URL=https://freedom-physicians-neighborhood-photographs.trycloudflare.com node scripts/verify-deployment.mjs
```

## 6. 故障恢复原则

优先恢复 Next.js，不轻易重启 tunnel：

```bash
tmux kill-session -t toutiao-next
tmux new-session -d -s toutiao-next 'cd <project-root> && AI_PROVIDER=mock npm run start -- -p 3002'
```

只有 tunnel 已退出或 URL 确认不可恢复时，才重启 tunnel：

```bash
tmux kill-session -t toutiao-tunnel
tmux new-session -d -s toutiao-tunnel '/tmp/cloudflared tunnel --url http://127.0.0.1:3002'
```

注意：重启 tunnel 后需要从日志中读取新 URL，并同步更新 README、提交文档和演示材料。

结束评审后可停止防睡眠：

```bash
tmux kill-session -t toutiao-keepawake
```

## 7. 建议结论

如果评审窗口较短，并且可以保证 Mac 接电、联网、不休眠、不重启，当前 quick tunnel 可以作为临时体验地址使用。

如果需要跨天、长期稳定、提交后无人值守，仍建议切换到云服务器、Vercel、命名 Cloudflare Tunnel 或其他持久部署方式。
