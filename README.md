# 头条 AI 创作者辅助生产与分发平台

项目现状、下一步待办和交付材料见 [项目现状与下一步](docs/project-status.md)（2026-10-09 更新）。下文在线体验与验证结果保留 2026 年 6 月的记录，正式使用前需复核。

这是字节跳动前端训练营今日头条业务课题的 MVP 工程骨架。当前版本优先跑通一条最小纵向主链路：

```text
登录态模拟
  -> AI Provider 生成图文草稿
  -> 编辑器保存草稿
  -> 发布前安全审核
  -> 质量评分
  -> 发布内容进入榜单
  -> 内容详情页展示排序解释
```

## 技术栈

- Next.js App Router
- React + TypeScript
- Route Handlers 作为轻量 API 层
- Zod 做请求参数和 AI 结构化输出边界
- OpenAI 兼容 AI Provider Adapter，默认保留 Mock Provider 作为本地和 E2E 兜底
- Prisma + SQLite 本地数据库，后续可按架构文档切换为 PostgreSQL
- Repository 数据访问层，API 不直接依赖数据库表
- lucide-react 图标
- Playwright E2E

## 目录结构

```text
src/app/                         Next.js 页面与 Route Handlers
src/components/                  通用前端组件
src/features/feed/               榜单页面组件
src/hooks/                       编辑器自动保存与离线同步 Hook
src/lib/                         客户端 API、类型和榜单配置
src/server/ai/                   AI Service、Mock Provider、OpenAI-compatible Provider
src/server/audit/                发布前规则预筛
src/server/repositories/         Prisma Repository 数据访问层
src/server/ranking/              榜单排序计算
prisma/                          数据模型、schema 应用脚本和 seed 数据
evals/                           审核/质量样例、Prompt 迭代和评估脚本
tests/e2e/                       Playwright 端到端测试
docs/                            需求、架构、评估、提交材料和技术留存
scripts/                         部署验证、演示录制和提交压缩包脚本
public/demo-assets/              演示素材
```

## 本地启动

安装依赖：

```bash
npm ci
```

准备本地数据库：

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

启动开发服务：

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

演示账号：

```text
邮箱：demo@toutiao.ai
密码：demo123456
```

MVP 认证会接受任意邮箱和非空密码；以上账号用于统一演示口径。

## 在线体验

2026-06-11 验证过的临时在线体验地址：

```text
https://freedom-physicians-neighborhood-photographs.trycloudflare.com
```

测试账号：

```text
邮箱：demo@toutiao.ai
密码：demo123456
```

该地址由 Cloudflare quick tunnel 暴露本机生产服务，需要保持本地 `npm run start` 和 `cloudflared tunnel` 进程运行。当前进程在 tmux 会话 `toutiao-next`、`toutiao-tunnel` 中；正式提交前如需长期稳定访问，应替换为 Vercel、服务器或命名 Cloudflare Tunnel 等持久部署地址。

本次在线部署验证结果：

```text
URL: https://freedom-physicians-neighborhood-photographs.trycloudflare.com
验证时间: 2026-06-11 14:46 CST
测试账号: demo@toutiao.ai / demo123456
验证链路: 登录 -> AI 生成 -> 发布审核 -> 热点榜单 -> 内容详情
热点榜单 LCP: 1488ms
```

## AI Provider 配置

本地默认使用 `mock`，无需外部网络和密钥，适合开发、演示和 E2E：

```env
AI_PROVIDER="mock"
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY=""
AI_MODEL="gpt-4o-mini"
```

切换 OpenAI 兼容服务时：

```env
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o-mini"
```

`AI_PROVIDER` 支持 `mock`、`openai`、`openai-compatible`。生成、审核、合规改写、质量评分都通过统一 AI Service 调用，并使用 Zod 校验结构化输出。

OpenAI 兼容 Provider 不依赖 `response_format: json_object`，因此可以适配不支持 JSON mode 的模型；模型输出会先做 JSON 提取，再进入 Zod schema 校验。

## 验证命令

```bash
npm run typecheck
npm run build
npm run lint
npm run evals
npm run e2e
```

真实模型 smoke test 需要提供 OpenAI 兼容环境变量后单独运行：

```bash
npm run ai:smoke
```

在线部署验证需要提供 `DEPLOY_URL`：

```bash
DEPLOY_URL=https://freedom-physicians-neighborhood-photographs.trycloudflare.com node scripts/verify-deployment.mjs
```

生成提交代码压缩包：

```bash
npm run submission:archive
```

该命令会根据 Git 可提交文件清单生成 `dist/toutiao-ai-creator-platform-submission-2026-06-11.zip`，并自动排除 `.env*`、`node_modules`、`.next`、数据库、测试报告、演示视频产物和缓存文件。

## 主要页面

- `/login`：登录。
- `/register`：注册。
- `/dashboard`：创作者工作台。
- `/prompts`：Prompt 管理。
- `/assets`：素材管理。
- `/create`：AI Mock 生成入口。
- `/editor/[draftId]`：短图文编辑器、段落卡片、局部重写、草稿保存、发布前审核、合规改写。
- `/feed/hot`：热点榜单。
- `/feed/viral`：爆文榜单。
- `/feed/recommended`：推荐榜单。
- `/content/[contentId]`：内容详情与排序解释。

## 演示路径

1. 打开 `/login`，使用演示账号登录。
2. 进入 `/create`，输入主题、选择 Prompt 和素材。
3. 点击“生成草稿”，进入编辑器。
4. 在编辑器修改标题、摘要、正文、标签。
5. 点击“保存草稿”，确认版本号和保存状态更新。
6. 在“段落创意卡片”中点击“局部重写第 1 段”，确认单段内容被改写。
7. 查看封面建议和 AI 配图建议。
8. 断开网络后继续编辑并保存，可看到 `local_pending`，恢复网络后自动同步。
9. 点击“发布并审核”，正常内容会通过 Mock 审核并进入榜单。
10. 在正文中加入“赌博”或“敏感信息”，再次发布可验证规则预筛和 Mock 审核拦截。
11. 点击“合规改写”，确认风险词被替换，再次发布。
12. 打开 `/feed/hot`，查看发布内容进入榜单，并滚动或点击“加载更多”验证分页加载。
13. 切换 `/feed/viral` 和 `/feed/recommended`，查看不同运营权重榜单。
14. 点击内容卡片进入详情页，查看质量分、热度分、新鲜度、反馈分和当前榜单权重。
15. 点击“编辑已发布内容”，修改后再次审核发布，详情页会更新为新版内容。

## 演示视频录制

演示脚本位于：

```text
docs/demo-script.md
```

自动录制命令：

```bash
npm run demo:record
```

录制默认访问 `http://localhost:3000`，使用 Mock Provider 跑完整链路，并在画面中叠加字幕说明真实模型 smoke test 4/4 通过。当前最终视频文件：

```text
artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm
```

已上传飞书云空间：

```text
（内部链接已移除）
```

视频时长 `00:03:01.36`，分辨率 `1280x720`。`artifacts/` 是本地生成产物，已从代码版本管理中排除；提交时可作为单独视频附件上传。

## 当前实现边界

- 认证是 Mock 认证，使用 HttpOnly Cookie 保存本地会话。
- 数据通过 Prisma repository 读写本地 SQLite 文件 `prisma/dev.db`，该文件不进入 Git。
- AI 生成、审核、合规改写、质量评分默认走 Mock Provider，也可通过环境变量切换到 OpenAI 兼容服务。
- AI 生成结果包含封面建议和配图建议，编辑器支持段落卡片和单段局部重写。
- 审核前有规则预筛层，当前覆盖涉黄、涉赌、涉毒、敏感信息、低俗内容等 27 个风险词。
- 编辑器支持 IndexedDB 本地草稿镜像，离线编辑会标记 `local_pending`，网络恢复后自动同步服务端。
- 已发布内容可从详情页重新进入编辑器，修改后重新审核、评分并更新线上详情。
- 内容治理支持最小下线 API：下线后内容不再进入榜单和详情消费。
- 素材上传尚未接入真实对象存储，当前使用 `public/demo-assets` 中的演示素材。
- 榜单分页支持滚动加载和手动加载更多，hot / viral / recommended 使用不同运营权重，排序公式可解释。

## 后续替换点

- 将 Prisma datasource 从本地 SQLite 切换为 PostgreSQL。
- 为真实模型补充小规模 smoke test 和 Prompt 版本评估集。
- 将素材管理接入对象存储和真实合规校验。
- 将内容治理扩展为人工复核队列、恢复和版本回滚。
- 继续扩展 `evals/` 下的审核样例和 Prompt 调优记录。
- 补充 Lighthouse 线上性能记录和真实模型耗时对比。

## 数据层说明

- Prisma schema 位于 `prisma/schema.prisma`。
- 本地数据库配置示例位于 `.env.example`。
- Prisma Client 初始化位于 `src/server/db/prisma.ts`。
- Repository 位于 `src/server/repositories/app-repository.ts`。
- Seed 数据位于 `prisma/seed.mjs`。
- AI 调用日志写入 `AiCallLog` 表，记录调用类型、provider、模型、耗时、输入摘要、输出摘要、schema 校验结果和错误信息。

Prisma 7 的 `prisma db push` 在当前环境返回空的 schema engine error，因此 `npm run db:push` 使用 `prisma migrate diff` 从 schema 生成 SQL，再通过 `prisma/apply-schema.mjs` 幂等应用到本地 SQLite。Prisma schema 仍然是表结构来源。

## AI 调用日志

AI 调用日志用于支撑后续“效果评估与优化报告”。每一次生成、审核、合规改写、质量评分都会记录到数据库，E2E 后可用以下命令查看闭环证据：

```bash
sqlite3 prisma/dev.db "select callType, provider, model, schemaValid, count(*) from AiCallLog group by callType, provider, model, schemaValid order by callType;"
```

如果使用默认 mock 配置，正常会看到 `generate_content`、`audit_content`、`rewrite_compliant`、`score_quality` 四类调用均有 `schemaValid=1` 记录。

## 效果评估

评估样例和脚本位于 `evals/`，默认使用稳定 Mock 逻辑，不依赖外部模型服务：

- `evals/audit-cases.json`：安全审核样例，当前 33 条，覆盖涉赌、敏感、低俗、涉毒、涉黄和正常内容。
- `evals/quality-cases.json`：质量评分样例，覆盖高质量、普通、低信息量内容。
- `evals/prompt-iterations.md`：Prompt 调优记录。
- `evals/scripts/run-evals.mjs`：输出审核准确率、误判数量、质量评分覆盖率、schema 失败数和 AI 调用日志统计。

运行：

```bash
npm run evals
```

## E2E 测试

E2E 配置位于 `playwright.config.ts`，测试用例位于 `tests/e2e/mvp-flow.spec.ts`。

当前覆盖：

- 成功主链路：登录、AI 生成、草稿保存、发布审核、热点榜单、内容详情排序解释。
- 短图文编辑器：封面/配图建议、段落卡片、单段局部重写、保存发布。
- 离线草稿：断网输入、本地 `local_pending`、恢复网络后同步服务端。
- 发布后编辑：详情页重新进入编辑器、再次审核评分、详情页更新。
- 审核分支：风险词拦截、合规改写、再次发布。
- 内容治理：发布内容下线后不再进入榜单和详情消费。
- 榜单加载与性能：动态运营权重、加载更多内容，并记录热点榜单首屏 Playwright performance baseline。

## 持续集成

GitHub Actions 对 main 和 PR 执行类型检查、Lint、Vitest、Mock Evals 和 Playwright E2E。依赖锁定到公共 npm 源；验证使用 Node.js 22 和 Mock AI，不需要模型密钥。

## 文档

- 项目现状与下一步：[docs/project-status.md](docs/project-status.md)
- 结构化需求：[docs/task-structured-requirements.md](docs/task-structured-requirements.md)
- 架构与实施方案：[docs/architecture-and-implementation-plan.md](docs/architecture-and-implementation-plan.md)
- 审核规则与质量体系：[docs/audit-and-quality-system.md](docs/audit-and-quality-system.md)
- 效果评估报告：[docs/evaluation-report.md](docs/evaluation-report.md)
- 测试说明：[docs/test-instructions.md](docs/test-instructions.md)
- 技术留存：[docs/worklogs](docs/worklogs)
