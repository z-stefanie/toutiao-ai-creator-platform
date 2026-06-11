# 官方提交差距清单

## 1. 对照来源

- 项目课题 PDF：官方课题 PDF（仅本地留存，不随源码分发）
- 作业提交文档模板：`（内部链接已移除）`
- 当前工程证据：`README.md`、`docs/`、`evals/`、`tests/e2e/`、`prisma/schema.prisma`、`src/`

## 2. 状态口径

- `done`：当前仓库已有可提交或可直接迁移到提交模板的材料。
- `pending`：当前只有部分素材，或需要部署、录制、人工填写、GitHub 操作后才能提交。
- `blocked`：当前材料已准备好，但缺少外部条件，例如 GitHub 远端仓库 URL 或权限。
- `not applicable`：官方模板中的选填或加分项，本项目当前不选择作为正式交付承诺。

> 注意：`done` 不代表已经填入飞书提交模板，只代表仓库内已有足够可靠的源材料。

## 3. 官方交付物差距表

| 交付物 | 官方来源 | 状态 | 当前来源文件 | 主要缺口 | 完成标准 |
| --- | --- | --- | --- | --- | --- |
| 基本信息：项目名称 | 提交模板「基本信息」 | done | `README.md` | 需要复制到飞书模板 | 飞书模板填写“头条 AI 创作者辅助生产与分发平台” |
| 基本信息：作者 | 提交模板「基本信息」 | pending | 暂无 | 需要用户填写姓名 / 工号 / 团队信息 | 飞书模板中作者信息完整 |
| 基本信息：技术栈 | 提交模板「基本信息」 | done | `README.md`、`docs/architecture-and-implementation-plan.md` | 需要压缩成模板内一句话 | 填写 Next.js / React / TypeScript / Prisma / SQLite / OpenAI-compatible AI Provider / Playwright |
| 在线访问地址 | PDF「可运行系统」；提交模板「体验地址」 | done | `README.md`、`docs/evaluation-report.md` | 当前为 Cloudflare quick tunnel 临时地址，需要保持本机生产服务和 tunnel 进程；正式提交可替换为长期部署地址 | 有可公开访问 URL 或二维码，评委无需本地启动即可访问 |
| 测试账号 / 密码 | 提交模板「体验地址」 | done | `README.md`、`scripts/verify-deployment.mjs` | 已通过公网 URL 验证登录；正式提交前如替换长期部署地址需复测 | 模板填写 `demo@toutiao.ai / demo123456`，并在线验证能登录 |
| 3-5 分钟演示视频 | 提交模板「体验地址」 | done | `docs/demo-script.md`、`scripts/record-demo-video.mjs`、`artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm`、飞书链接 `（内部链接已移除）` | 当前已上传飞书；权限复核显示 `link_share_entity=closed`，提交给评委前建议确认是否改为组织内可读 | 视频覆盖创作 -> 审核 -> 合规改写 -> 分发 -> 详情，时长 3 分 01 秒 |
| 项目介绍文档 | 提交模板「项目介绍文档」 | done | `docs/project-introduction.md`、`README.md`、`docs/task-structured-requirements.md`、E2E 用例、演示视频 | 无；提交飞书时可补视频链接 | 项目介绍文档包含简介、核心功能、亮点、截图/GIF 占位或链接、功能完成度清单 |
| 功能完成度清单 | 提交模板「项目介绍文档」 | done | `docs/project-introduction.md`、`tests/e2e/mvp-flow.spec.ts` | 无；后续可随演示视频补截图 | 清单覆盖用户中心、AI 创作、审核、榜单、三项进阶挑战，并标注 mock / demo 边界 |
| 项目技术文档 | PDF「完整技术方案与架构设计文档」；提交模板「项目技术文档」 | done | `docs/project-technical-document.md`、`docs/architecture-and-implementation-plan.md`、`README.md`、`prisma/schema.prisma` | 无；如后续更换稳定部署地址，需同步性能章节 | 能说明系统架构、技术选型、模块边界、AI 接入、数据库设计、性能与工程化 |
| 审核规则与质量评估体系 | PDF「内容安全审核规则库与质量评估体系说明」；提交模板「其他补充材料」 | done | `docs/audit-and-quality-system.md`、`src/server/audit/rule-prescreen.ts`、`evals/audit-cases.json`、`evals/quality-cases.json` | 最终模板中需避免夸大真实泛化准确率 | 文档说明安全规则库、质量评分维度、处置动作、识别-干预-反馈闭环 |
| 效果评估与优化报告 | PDF「平台效果评估与内容分发优化报告」；提交模板「效果评估与优化报告」 | done | `docs/evaluation-report.md`、`evals/prompt-iterations.md`、`docs/worklogs/2026-06-10-step-9-real-ai-smoke-test.md` | 当前 90% 只能按样例集说明，不能宣称线上泛化；quick tunnel 可用性不等同长期部署 SLA | 报告包含 mock eval、真实模型 smoke test、Prompt 调优、性能指标、排序效果、未来优化和公网 LCP |
| 代码压缩包 | 提交模板「代码压缩包」 | done | `dist/toutiao-ai-creator-platform-submission-2026-06-11.zip`、`scripts/create-submission-archive.mjs` | 压缩包位于 ignored `dist/`，提交时作为附件上传，不进入 Git | 产出可上传附件的 zip/tar 包，包含 README、源码、docs、evals、tests，不含敏感信息和缓存 |
| README 启动与测试说明 | 提交模板「代码压缩包」 | done | `README.md` | 部署后可补在线地址和部署说明 | README 包含安装、数据库初始化、启动、验证命令、E2E、真实模型 smoke test |
| GitHub 仓库与 main/master 分支 | PDF「托管于 GitHub 的完整项目代码」 | blocked | 本地已切换到 `main`；GitHub CLI 不可用；当前 GitHub 连接器可访问仓库列表为空 | 缺少 GitHub 远端仓库 URL 或可创建仓库的工具权限；本地提交可完成，但远端推送需外部仓库 | GitHub 仓库可访问，最终代码位于 `main` 或 `master` 分支 |
| 项目自评 | 提交模板「项目自评」 | done | `docs/project-self-review.md`、`docs/worklogs/`、`docs/evaluation-report.md`、演示视频 | 无；提交前可补作者个人信息和公开视频链接 | 自评包含完成度、不足、mock/真实模型边界、部署与长期优化路线 |
| 飞书提交模板副本 | 提交模板使用说明 | pending | `docs/final-submission-draft.md`、本清单和现有 Markdown 文档 | 尚未创建模板副本并填写 | 在飞书中创建提交模板副本，填入全部最终材料链接 / 附件 |
| 开放 API 集成 | 提交模板「项目介绍文档」进阶挑战示例 | not applicable | 暂无 | 本项目当前不承诺抖音 / 头条开放 API 集成 | 如不实现，在完成度清单中标注为未选择加分项；不影响核心提交 |

## 4. 功能与评分维度证据

| 官方评分维度 | 权重 | 当前证据 | 状态 | 缺口 / 注意事项 |
| --- | --- | --- | --- | --- |
| AI 工具深度应用与人机协同 | 30% | `src/server/ai/`、编辑器段落重写、审核、改写、评分、`npm run ai:smoke` | done | 演示视频需突出人类确认、局部重写、合规改写，而不是只展示 API 调用 |
| 端到端完整体验与产品氛围 | 30% | `README.md` 演示路径、`tests/e2e/mvp-flow.spec.ts` 7 条 E2E、飞书视频链接 | done | 无 |
| 架构设计与性能优化 | 20% | `docs/architecture-and-implementation-plan.md`、Playwright baseline `63ms/86ms`、公网 LCP `1488ms` | done | 当前公网 URL 是 quick tunnel，正式提交如需长期地址需替换后复测 |
| 内容安全与质量闭环 | 10% | `docs/audit-and-quality-system.md`、33 条审核样例、3 条质量样例 | pending | 不能把样例集 100% 直接表述为真实泛化 90%；需谨慎描述评估口径 |
| 工程化与交付规范 | 10% | README、E2E、evals、typecheck/lint/build 记录、worklogs、`docs/final-submission-draft.md`、代码压缩包 | pending | 仍需 GitHub 远端仓库 URL 或可创建仓库权限 |

## 5. 推荐完成顺序

1. 创建飞书提交模板副本，按 `docs/final-submission-draft.md` 填入在线地址、视频、文档、代码包和自评。
2. 如需长期稳定在线地址，将 quick tunnel 替换为 Vercel / 服务器 / 命名 Cloudflare Tunnel，并复测 LCP。
3. 提供 GitHub 远端仓库 URL，或安装/授权可创建仓库的 GitHub 工具后推送 `main`。
