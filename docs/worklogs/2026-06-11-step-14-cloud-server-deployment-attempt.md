# Step 14 云服务器部署连通性检查

## 1. 本次目标

将当前项目从临时 Cloudflare quick tunnel 迁移到用户提供的云服务器，形成更稳定的公网体验地址。

目标服务器：

- 公网 IP：`192.0.2.10`
- 私网 IP：`192.0.2.20`
- 计划部署模式：Next.js production + SQLite + mock AI provider + systemd 常驻服务；公网通过 80 端口访问，必要时由 Nginx 反向代理到本机 3000 端口。

## 2. 已执行检查

执行时间：`2026-06-11 17:14 CST`

已使用本地私钥文件进行 SSH 登录验证。私钥内容未读取、未记录、未写入项目目录；仅复制到 `/tmp/toutiao-deploy.pem` 并收紧临时副本权限用于连接测试。

连通性结果：

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| `ping 192.0.2.10` | 4/4 成功，平均约 `166.696ms` | 公网 IP 有响应，主机或网关在线 |
| `ssh root@192.0.2.10 -p 22` | `Operation timed out` | 连接未进入 SSH 认证阶段，疑似安全组 / 防火墙未放行 22 |
| `nc 192.0.2.10 22` | 超时 | 22/TCP 被丢弃或未放行 |
| `nc 192.0.2.10 2222` | 超时 | 常见备用 SSH 端口未开放 |
| `nc 192.0.2.10 22022` | 超时 | 常见备用 SSH 端口未开放 |
| `curl http://192.0.2.10` | 80 端口连接失败 | 当前未部署 Web 服务，或 80 未开放 |
| `curl http://192.0.2.10:3000` | 3000 端口连接失败 | 当前未部署 Next.js 服务，或 3000 未开放 |
| `ping 192.0.2.20` | 100% 丢包 | 私网 IP 不能从当前网络直接访问，符合 VPC 私网预期 |
| `ssh root@192.0.2.20` | 超时 | 私网入口不可用于本机部署 |

当前本机公网出口 IP：

```text
192.0.2.30
```

## 3. 阻塞判断

当前阻塞点在云服务器网络入口，而不是项目代码或 SSH 私钥。

关键证据是：`192.0.2.10` 能 ping 通，但 22/TCP 超时；SSH 日志显示连接在 `Connecting to 192.0.2.10 [192.0.2.10] port 22` 后超时，尚未进入密钥认证环节。

因此，本轮未能进入服务器执行安装、上传、构建和启动操作。

## 4. 需要在云控制台确认的事项

优先处理：

1. 给该云服务器绑定的安全组 / 防火墙增加入站规则：
   - 协议：TCP
   - 端口：`22`
   - 来源：`192.0.2.30/32`
   - 说明：仅允许当前本机出口 IP SSH 登录。
2. 确认服务器系统用户名：
   - 首选尝试：`root`
   - 如果镜像禁用 root 登录，需要提供真实用户名，例如 `ubuntu`、`admin`、`ec2-user`。
3. 确认 SSH 端口是否为 `22`：
   - 如果不是 22，需要提供自定义端口。

部署前建议一并开放：

1. HTTP：
   - 协议：TCP
   - 端口：`80`
   - 来源：`0.0.0.0/0`
   - 用途：评委公网访问。
2. HTTPS，可选：
   - 协议：TCP
   - 端口：`443`
   - 来源：`0.0.0.0/0`
   - 用途：后续绑定域名和证书。
3. 直接访问 Next.js，可选：
   - 协议：TCP
   - 端口：`3000`
   - 来源：`0.0.0.0/0`
   - 用途：无 Nginx 时临时访问。若使用 Nginx 反代，则不需要对公网开放 3000。

## 5. 恢复后执行计划

SSH 放通后，继续执行：

1. 登录服务器，确认系统、CPU 架构、内存、磁盘、Node.js、npm、systemd、Nginx 状态。
2. 若 Node.js 版本缺失或过低，安装 Node.js LTS。
3. 上传当前项目到 `/opt/toutiao`，排除 `.git`、`node_modules`、`.next`、`.env*`、`prisma/dev.db`、测试报告和缓存。
4. 在服务器执行：

```bash
npm install
AI_PROVIDER=mock npm run db:generate
AI_PROVIDER=mock npm run db:push
AI_PROVIDER=mock npm run db:seed
AI_PROVIDER=mock npm run build
```

5. 创建 `toutiao.service`，使用 systemd 常驻运行：

```text
WorkingDirectory=/opt/toutiao
Environment=NODE_ENV=production
Environment=AI_PROVIDER=mock
Environment=PORT=3000
ExecStart=<npm_path> run start -- -p 3000
Restart=always
```

6. 配置 Nginx 将 `http://192.0.2.10` 反向代理到 `http://127.0.0.1:3000`。
7. 从本机执行公网验证：

```bash
DEPLOY_URL=http://192.0.2.10 node scripts/verify-deployment.mjs
```

8. 将验证结果更新到 `README.md`、`docs/evaluation-report.md`、`docs/submission-checklist.md`。

## 6. 当前结论

云服务器本身有公网响应，但 SSH 入口尚未开放。待云控制台放行 22/TCP 后，可继续自动完成代码上传、远端构建、服务托管和公网 smoke test。

## 7. 安全组截图复查与二次验证

执行时间：`2026-06-11 17:30 CST`

用户截图显示安全组 `toutiao-demo-sg` 已包含以下关键入向规则：

| 协议 | 端口 | 来源 | 说明 | 判断 |
| --- | --- | --- | --- | --- |
| TCP | `22` | `192.0.2.30/32` | SSH deployment | 规则内容正确，只允许当前本机出口 IP SSH 登录 |
| TCP | `80` | `0.0.0.0/0` | HTTP public access | 规则内容正确，适合作为评委访问入口 |
| TCP | `3000` | `0.0.0.0/0` | Next.js demo | 可作为临时直连备用；正式部署更建议用 80 反代 |
| TCP | `443` | `0.0.0.0/0` | HTTPS | 预留 HTTPS，后续有域名证书后使用 |
| ICMP | ALL | `0.0.0.0/0` | Ping | 已验证公网 IP 可 ping 通 |

二次实测结果：

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| 当前本机出口 IP | `192.0.2.30` | 与安全组 22 规则来源一致 |
| `ping 192.0.2.10` | 3/3 成功，平均约 `178.814ms` | 公网 IP 仍在线 |
| `nc 192.0.2.10 22` | `Operation timed out` | 22/TCP 仍未建立连接 |
| `nc 192.0.2.10 80` | `Connection refused` | 80/TCP 已能到达主机，但当前没有 Web 服务监听 |
| `nc 192.0.2.10 3000` | `Connection refused` | 3000/TCP 已能到达主机，但当前没有 Next.js 服务监听 |

更新判断：

- 安全组规则文本本身看起来正确。
- 80/3000 返回 `Connection refused`，说明这两个端口的公网流量大概率已经能到达服务器，只是服务尚未启动。
- 22 返回 `Operation timed out`，说明 SSH 入口仍被丢弃；这不像密钥错误，也不像用户名错误，因为连接尚未进入认证阶段。

建议继续检查：

1. 在安全组页面的“关联/关联实例/关联网卡”中确认 `toutiao-demo-sg` 已绑定到公网 IP `192.0.2.10` 对应的网卡。
2. 使用云厂商控制台的 VNC / Workbench / 远程登录进入服务器，检查 SSH 服务：

```bash
sudo systemctl status sshd || sudo systemctl status ssh
sudo ss -ltnp | grep ':22'
sudo ufw status
sudo iptables -S
```

3. 如果 SSH 服务未启动：

```bash
sudo systemctl enable --now sshd || sudo systemctl enable --now ssh
```

4. 如果系统防火墙拦截 22：

```bash
sudo ufw allow 22/tcp
sudo ufw reload
```

若服务器使用了非 22 SSH 端口，需要提供实际端口后继续连接。
