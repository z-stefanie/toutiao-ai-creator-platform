# Toutiao 项目现状与下一步

更新日期：2026-10-26。公开基线已移除内部材料、链接和原提交身份；6 月记录中的提交号仅用于历史说明。

核心 MVP、演示视频和提交材料已经形成。下一步优先解决交付版本不一致、体验地址和材料访问验证，再按需要扩展功能。6 月的成功记录有明确日期，不能直接代表今天的运行状态。

## 当前基线

| 项目 | 状态与证据 |
| --- | --- |
| 核心流程 | 已有创作、草稿保存、审核、合规改写、质量评分、榜单分发和详情解释；另有段落重写、离线同步、发布后编辑和内容下线。见 [项目介绍](project-introduction.md)、[E2E 用例](../tests/e2e/mvp-flow.spec.ts)。 |
| 实际技术栈 | 锁定依赖为 Next.js 16.2.9、React 19.2.7、Prisma 7.8.0；服务端使用 Route Handlers，数据库为 SQLite。见 [依赖锁文件](../package-lock.json)、[数据库模型](../prisma/schema.prisma)。PostgreSQL 和对象存储仍是后续方案。 |
| 实现边界 | 认证是 Mock；AI 默认 Mock，支持 OpenAI 兼容 Provider；素材以演示资源为主。真实模型接入成功不等于产品已经生产化。见 [技术文档](project-technical-document.md)、[自评](project-self-review.md)。 |
| 工程验证 | 2026-06-11 留存记录为 typecheck、lint、build 通过，E2E 7 条通过，审核样例 33/33、质量样例 3/3。当前没有独立单元测试覆盖率报告。见 [最终工程验证](worklogs/2026-06-11-step-20-github-package-finalization.md)、[测试说明](test-instructions.md)。 |
| 真实模型 | 6 月的方舟 smoke test 覆盖生成、审核、改写、评分，结果 4/4 通过；该结果验证调用与输出结构，不证明真实审核准确率达到 90%。见 [真实模型记录](worklogs/2026-06-10-step-9-real-ai-smoke-test.md)。 |
| 部署与性能 | 2026-06-11 通过本机生产服务及 Cloudflare 临时隧道验证，榜单 LCP 为 1488 ms。该地址依赖本机进程；正式使用前需要重新验证。见 [部署记录](worklogs/2026-06-11-step-13-deployment-performance.md)。 |
| 本地版本 | 已有 3 次提交；本轮整理开始时，README、提交草稿、提交清单及测试说明、Step 23 至 26 文档仍有未提交改动。当前未配置 Git remote。 |

## 下一步

| 顺序 | 待办 | 完成标准 |
| --- | --- | --- |
| 1 | 确认当前适用的代码交付要求 | 历史中既有“不能把项目发到 GitHub”的要求，也有后续 Goal 4 的 GitHub main/master 目标。明确最终提交渠道后更新交付清单，避免把旧目标自动当成当前任务。见下方“代码交付口径”。 |
| 2 | 统一源码、文档与交付包版本 | 在确定的交付版本上完成必要验证并重新打包，包含测试说明和最新文档；核对云端附件与该版本一致。现有 ZIP 不能直接作为最新版本提交。 |
| 3 | 更新体验地址及运行证据 | 在实际交付环境重跑登录、生成、审核、分发和详情流程，记录验证日期、Provider 和 LCP。云服务器历史 SSH 排查仍没有部署成功的结论。 |
| 4 | 完成已有模板副本 | 核对作者信息、体验地址、视频、8 份文档和代码包链接；从预期评审身份检查材料可读性。模板副本已有历史记录，先继续核对已有副本。 |

### 代码交付口径

“工程学习：跨设备迁移与离线打包”中，用户明确说过课题不允许上传 GitHub。后续“交付收尾：视频、飞书与代码包”包含要求 GitHub main/master 的 Goal 4；[6 月官方文档复核记录](worklogs/2026-06-11-step-11-original-docs-goal-review.md)也采用了这一目标。

这些历史记录存在口径变化。旧[提交清单](submission-checklist.md)把 GitHub 标为 `blocked`，但恢复交付前应先确认现行规则及适用范围，再决定是否继续该项。

### 代码包版本差异

2026-10-09 检查本地 [ZIP](../dist/toutiao-ai-creator-platform-submission-2026-06-11.zip)：109 个文件，866910 字节。包内 README 与工作区内容不同，且缺少 `docs/test-instructions.md` 和后续 Step 26 留存。

[飞书上传记录](worklogs/2026-06-11-step-21-code-archive-lark-upload.md)记载的是更早的版本：108 个文件，865161 字节。云端附件最后一次可追溯上传与现有本地 ZIP 也不一致，后续需要重新形成一致的交付版本。

## 交付材料入口

视频和代码 ZIP 在 2026-10-09 仍存在于本地。以下飞书链接来自 6 月的导入或上传记录；其中视频和 ZIP 当时的链接分享状态为 `closed`，提交前需要核对预期读者能否访问。

| 材料 | 本地来源 | 飞书入口 |
| --- | --- | --- |
| 最终提交草稿 | [提交草稿](final-submission-draft.md) | 已有模板副本（内部链接已移除） |
| 项目介绍 | [项目介绍](project-introduction.md) | 项目介绍文档（内部链接已移除） |
| 技术方案 | [技术文档](project-technical-document.md) | 项目技术文档（内部链接已移除） |
| 项目自评 | [自评](project-self-review.md) | 项目自评文档（内部链接已移除） |
| 审核与质量体系 | [审核与质量体系](audit-and-quality-system.md) | 审核规则与质量评估体系（内部链接已移除） |
| 效果评估 | [评估报告](evaluation-report.md) | 效果评估与优化报告（内部链接已移除） |
| 测试说明 | [测试说明](test-instructions.md) | 测试说明文档（内部链接已移除） |
| Prompt 调优 | [Prompt 调优记录](../evals/prompt-iterations.md) | Prompt 调优文档（内部链接已移除） |
| 启动与操作说明 | [README](../README.md) | 6 月导入的 README（内部链接已移除） |
| 演示视频 | [WebM 视频](../artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm) | 视频附件（内部链接已移除） |
| 代码压缩包 | [6 月 ZIP](../dist/toutiao-ai-creator-platform-submission-2026-06-11.zip) | 6 月代码附件（内部链接已移除） |

视频最终留存参数为 3 分 01.36 秒、1280 × 720，详见[视频修正记录](worklogs/2026-06-11-step-18-demo-video-retiming-fix.md)。

模板副本已在 [Step 24](worklogs/2026-06-11-step-24-test-instructions-gap-check.md)被读取。8 份文档导入记录见 [Step 23](worklogs/2026-06-11-step-23-lark-doc-imports.md)、[Step 25](worklogs/2026-06-11-step-25-test-instructions-doc.md)、[Step 26](worklogs/2026-06-11-step-26-readme-prompt-lark-imports.md)。已有副本与已导入材料不代表最终表单已经填写完成。

## 后续维护

新决策、功能验收和交付动作完成后，更新本文对应的状态、日期和证据链接。详细过程继续留在原聊天和已有技术留存中。标题采用具体主题；只有存在独立目标时才另开聊天。

旧工作日志保留当时的结论。涉及“当前”“已完成”的判断，优先查本文及最近一次验证记录，避免把 6 月的临时地址、旧压缩包或旧差距清单直接用于新的交付。
