# 测试说明：单元测试覆盖情况与运行方式

## 1. 说明口径

本项目当前没有接入独立的 Jest / Vitest 单元测试框架，也没有生成独立的单元测试覆盖率报告。因此不能表述为“单元测试覆盖率 xx%”。

当前自动化验证采用分层策略：

- 类型检查：验证 TypeScript 类型边界。
- Lint：验证基础代码规范。
- 构建检查：验证 Next.js 生产构建可用。
- Evals：验证内容审核、质量评分和 AI 输出 schema。
- E2E：验证创作、审核、改写、分发、详情等核心产品链路。
- 真实模型 smoke test：验证 OpenAI-compatible Provider 能跑通真实模型调用。

这一口径更贴合当前项目状态：用可重复执行的工程验证覆盖主链路和关键 AI 能力，同时明确暂无独立单元测试覆盖率报告。

## 2. 当前覆盖情况

| 验证类型 | 当前状态 | 覆盖内容 |
| --- | --- | --- |
| 单元测试 | 暂未接入 | 当前没有 `npm run test` / `npm run unit` 脚本，也没有 Jest / Vitest coverage 报告 |
| 类型检查 | 已接入 | TypeScript 类型约束，覆盖前端页面、API Route、服务端模块和脚本类型 |
| Lint | 已接入 | ESLint 代码规范检查 |
| 生产构建 | 已接入 | Next.js App Router 生产构建 |
| Evals | 已接入 | 33 条审核样例、3 条质量样例、schema 校验和 AI 调用日志统计 |
| E2E | 已接入 | 7 条 Playwright 用例，覆盖主要产品链路和关键分支 |
| 真实模型 smoke test | 已接入 | 生成、审核、合规改写、质量评分 4 类真实模型调用 |

## 3. 运行前准备

首次运行需要安装依赖并初始化本地数据库：

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

默认使用 Mock AI Provider，不需要外部模型 API Key：

```bash
AI_PROVIDER=mock
```

`.env.example` 中提供了本地数据库和 AI Provider 的配置示例。真实密钥不应提交到仓库或代码压缩包。

## 4. 常规验证命令

建议按以下顺序执行：

```bash
npm run typecheck
npm run lint
npm run build
npm run evals
AI_PROVIDER=mock npm run e2e
```

各命令含义：

| 命令 | 作用 | 失败时优先检查 |
| --- | --- | --- |
| `npm run typecheck` | 执行 `tsc --noEmit`，检查类型错误 | 类型定义、接口字段、Route Handler 入参出参 |
| `npm run lint` | 执行 ESLint | 未使用变量、Hook 依赖、格式和规范问题 |
| `npm run build` | 执行 Next.js 生产构建 | 服务端 / 客户端边界、动态路由、构建期环境变量 |
| `npm run evals` | 执行审核和质量评估样例 | 规则预筛、AI schema、评估样例和 AI 调用日志 |
| `AI_PROVIDER=mock npm run e2e` | 执行 Playwright E2E | 本地服务、数据库 seed、页面文案、核心流程 |

## 5. Evals 覆盖范围

评估材料位于 `evals/`：

- `evals/audit-cases.json`：33 条审核样例。
- `evals/quality-cases.json`：3 条质量评分样例。
- `evals/prompt-iterations.md`：Prompt 调优记录。
- `evals/scripts/run-evals.mjs`：评估脚本。

审核样例覆盖：

- 正常内容。
- 涉赌。
- 敏感信息。
- 低俗内容。
- 涉毒。
- 涉黄。

质量样例覆盖：

- high：结构完整、信息密度高、素材匹配。
- medium：表达完整但信息密度有限。
- low：内容过短、标题弱、缺少标签和素材。

最近一次本地执行结果：

```text
Audit cases: 33/33 (100.0%)
Audit false positives: 0
Audit false negatives: 0
Quality cases: 3/3 (100.0%)
Eval schema failures: 0
AI call log schema success: 100.0%
```

注意：该结果是当前样例集上的本地基线，不能等同于真实线上泛化准确率。

## 6. E2E 覆盖范围

E2E 配置和用例：

- 配置文件：`playwright.config.ts`
- 用例文件：`tests/e2e/mvp-flow.spec.ts`
- 当前用例数量：7 条

当前覆盖：

- 用户登录。
- AI 生成草稿。
- 编辑器保存草稿。
- 封面建议、配图建议和段落级局部重写。
- 发布前审核。
- 风险词拦截。
- 合规改写后再次发布。
- 离线草稿写入 IndexedDB，恢复网络后同步服务端。
- 已发布内容再次编辑并更新详情页。
- 热点榜单、爆文榜单、推荐榜单的不同运营权重。
- 榜单加载更多。
- 内容详情页排序解释。
- 内容治理下线，下线后不再进入榜单和详情消费。
- 热点榜单首屏性能基线。

E2E 默认由 Playwright 自动启动本地 Next.js 服务，配置见 `playwright.config.ts`。

## 7. 真实模型 Smoke Test

真实模型 smoke test 用于验证 OpenAI-compatible Provider，不作为默认 E2E 依赖，避免外部服务稳定性和耗时影响常规验证。

运行方式：

```bash
npm run ai:smoke
```

需要提前配置：

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=<openai-compatible-base-url>
AI_API_KEY=<provider-api-key>
AI_MODEL=<model-or-endpoint>
```

当前 smoke test 覆盖：

- `generate_content`
- `audit_content`
- `rewrite_compliant`
- `score_quality`

最近一次真实模型 smoke test 结果为 4/4 通过。真实模型总耗时明显高于 Mock Provider，因此日常开发、E2E 和现场演示默认仍使用 Mock Provider。

## 8. 当前边界与后续计划

当前边界：

- 暂无独立单元测试覆盖率报告。
- Evals 样例规模有限，不能证明真实线上 90%+ 泛化准确率。
- Mock Provider 是稳定演示基线，不代表真实模型表现。
- Playwright E2E 主要覆盖产品验收链路，不替代所有函数级单元测试。

后续可以补充：

- 接入 Vitest 或 Jest。
- 为 `src/server/audit/rule-prescreen.ts` 增加规则单元测试。
- 为榜单排序公式、质量评分公式、repository 事务逻辑增加单元测试。
- 增加 `npm run test` 和 `npm run coverage`。
- 将 coverage 报告纳入提交材料。

## 9. 可填写到提交模板的摘要

当前项目暂无独立单元测试覆盖率报告，自动化验证以 E2E、evals、类型检查、Lint、生产构建和真实模型 smoke test 为主。Evals 覆盖 33 条审核样例和 3 条质量评分样例，当前本地结果为 33/33、3/3 通过，schema failures 为 0。Playwright E2E 当前 7 条用例，覆盖登录、AI 生成、编辑保存、发布审核、合规改写、离线同步、发布后编辑、榜单分发、排序解释和内容下线治理。常规运行命令为 `npm run typecheck && npm run lint && npm run build && npm run evals && AI_PROVIDER=mock npm run e2e`，真实模型验证可单独运行 `npm run ai:smoke`。
