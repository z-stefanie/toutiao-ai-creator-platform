# 作业提交文档草稿

> 本文档用于迁移到飞书提交模板。详细材料见同目录下的项目介绍、技术文档、审核体系、评估报告和自评文档。

## 基本信息

| 项目 | 内容 |
| --- | --- |
| 项目名称 | 头条 AI 创作者辅助生产与分发平台 |
| 作者 | 待填写 |
| 技术栈 | Next.js App Router / React / TypeScript / Prisma / SQLite / OpenAI-compatible AI Provider / Zod / Playwright |

## 体验地址

在线访问地址：

```text
https://freedom-physicians-neighborhood-photographs.trycloudflare.com
```

测试账号 / 密码：

```text
demo@toutiao.ai / demo123456
```

演示视频：

```text
飞书链接：（内部链接已移除）
本地文件：artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm
时长：00:03:01.36
分辨率：1280x720
说明：视频默认使用 Mock Provider 跑通演示链路，并用字幕说明真实模型 smoke test 4/4 通过。
```

说明：

- 当前在线地址为 Cloudflare quick tunnel 临时地址，需要保持本机 tmux 会话 `toutiao-next` 和 `toutiao-tunnel` 运行。
- 如需正式长期提交地址，建议替换为稳定部署环境后复测。

## 项目介绍文档

详细文档：

```text
docs/project-introduction.md
```

一句话简介：

```text
这是一个面向内容创作者的 AI 辅助生产与分发平台，围绕创作、审核、改写、评分、分发和反馈解释，跑通从灵感到榜单详情的端到端闭环。
```

核心功能：

- 用户登录、注册和退出。
- Prompt 与素材管理。
- AI 生成短图文草稿。
- 编辑器保存、段落局部重写、封面建议、配图建议。
- IndexedDB 离线草稿和恢复同步。
- 发布前安全审核和高危内容拦截。
- 一键合规改写。
- 内容质量评分。
- 热点、爆文、推荐三类榜单。
- 内容详情页排序解释。
- 发布后编辑和内容下线。

功能完成度摘要：

| 模块 | 状态 |
| --- | --- |
| 用户中心 | done |
| AI 内容创作 | done |
| 内容审核与合规改写 | done |
| 质量评分与榜单排序 | done |
| 草稿自动保存与离线同步 | done |
| 发布后编辑 | done |
| 短图文创意编辑器 | done |
| 高精度内容安全识别 | partial，样例集基线已建，真实泛化仍需扩展 |
| 智能排序热点榜单 | done |
| 开放 API 集成 | not applicable |

## 项目技术文档

详细文档：

```text
docs/project-technical-document.md
docs/architecture-and-implementation-plan.md
```

系统架构摘要：

```text
Next.js Pages / Route Handlers
  -> Server Services
  -> Repository
  -> Prisma + SQLite
  -> AI Service
  -> Mock Provider / OpenAI-compatible Provider
  -> Zod schema validation
```

关键设计：

- Route Handler 只负责参数、鉴权、调用服务和返回统一响应。
- 业务逻辑下沉到 `src/server/*`。
- AI 输出必须经过 Zod schema。
- AI 调用日志落库，支持后续评估。
- 数据访问通过 repository 隔离，后续可迁移 PostgreSQL。
- 榜单排序使用质量、热度、新鲜度、反馈多因子动态权重。

## 审核规则与质量评估体系

详细文档：

```text
docs/audit-and-quality-system.md
```

审核覆盖：

- 涉黄。
- 涉赌。
- 涉毒。
- 敏感信息。
- 低俗内容。

审核输出：

```text
passed / riskLevel / categories / hitSpans / action / suggestion
```

质量评分维度：

- 原创性。
- 结构完整度。
- 可读性。
- 信息密度。
- 标题吸引力。
- 图文匹配度。

说明：

当前 33 条审核样例集内通过率为 100%，但这只是样例集基线，不直接代表真实线上泛化准确率。真实生产要继续扩展人工标注样例、误杀样例和漏判样例。

## 效果评估与优化报告

详细文档：

```text
docs/evaluation-report.md
evals/prompt-iterations.md
```

本地评估结果：

```text
Audit cases: 33/33 (100.0%)
Audit false positives: 0
Audit false negatives: 0
Quality cases: 3/3 (100.0%)
Eval schema failures: 0
AI call log schema success: 100.0%
```

真实模型 smoke test：

```text
provider=openai-compatible
baseUrl=https://ark.cn-beijing.volces.com/api/v3
model=ep-20260610224007-dm42x
generate_content OK 26572ms
audit_content OK 6429ms
rewrite_compliant OK 10334ms
score_quality OK 23667ms
summary 4/4 passed
```

线上 Performance：

```text
url=https://freedom-physicians-neighborhood-photographs.trycloudflare.com
verifiedFlow=login -> generate -> publish -> hot feed -> content detail
feed hot LCP=1488ms
threshold=2500ms
```

## 代码压缩包

```text
飞书链接：（内部链接已移除）
本地文件：dist/toutiao-ai-creator-platform-submission-2026-06-11.zip
```

当前仓库包含：

- `README.md`：启动、验证、在线体验说明。
- `src/`：应用源码。
- `prisma/`：schema 和 seed。
- `evals/`：审核、质量和 Prompt 评估材料。
- `tests/e2e/`：Playwright E2E。
- `docs/`：提交文档、评估报告、技术留存。

生成代码压缩包前需要排除：

- `.env*`
- `node_modules/`
- `.next/`
- `prisma/dev.db`
- `test-results/`
- `playwright-report/`
- 任何 API Key 或密钥文件。

## 项目自评

详细文档：

```text
docs/project-self-review.md
```

自评摘要：

- 当前项目已经跑通训练营要求的核心端到端链路。
- AI 能力覆盖生成、审核、改写、评分，不只是单点生成。
- 文档、评估脚本、E2E、真实模型 smoke test 和线上 LCP 形成了较完整的交付证据链。
- 当前仍是 MVP，认证、数据库、素材存储、内容治理和部署方式都有明显生产化差距。
- 对高危识别准确率保持谨慎表述：当前证明样例集基线和评估能力，不夸大为线上泛化能力。
