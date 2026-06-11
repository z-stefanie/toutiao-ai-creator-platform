# 2026-06-10 技术留存：OpenAI 兼容 Provider 与 AI 调用日志闭环

## 本轮目标

接入 OpenAI 兼容 AI Provider，并建立 AI 调用日志闭环：

- 保留 Mock Provider 作为本地开发、演示和 E2E 兜底。
- 新增 OpenAI 兼容 Provider，支持通过环境变量切换。
- 生成、审核、合规改写、质量评分都走统一 AI Service。
- 所有 AI 输出继续使用 Zod 校验。
- 新增 AI 调用日志表和 repository 方法，为后续效果评估与优化报告留证据。

## 已完成内容

- 新增 AI Service：`src/server/ai/ai-service.ts`。
- 新增 OpenAI 兼容适配器：`src/server/ai/openai-compatible-provider.ts`。
- 新增 AI 输出 schema：`src/server/ai/output-schemas.ts`。
- 新增 AI 调用类型和日志类型：`src/lib/types.ts`。
- 新增 Prisma `AiCallLog` 表：`prisma/schema.prisma`。
- 新增 `createAiCallLog` repository 方法：`src/server/repositories/app-repository.ts`。
- 将生成接口切到统一 AI Service：`src/app/api/ai/generate-content/route.ts`。
- 将合规改写接口切到统一 AI Service：`src/app/api/ai/rewrite-compliant/route.ts`。
- 将发布前审核和质量评分切到统一 AI Service：`src/app/api/contents/publish/route.ts`。
- 更新 `.env.example` 和 `README.md`，补充 AI Provider 配置、日志表说明和查询命令。
- 更新 seed 脚本，重置演示数据时同步清空 AI 调用日志。

## 设计取舍

### 1. Provider 统一入口

Route Handler 不直接调用 Mock 或 OpenAI Provider，而是统一调用 AI Service：

```text
Route Handler
  -> ai-service
  -> mock-provider / openai-compatible-provider
  -> zod schema validation
  -> createAiCallLog
```

这样后续替换火山方舟、OpenAI 或其他兼容模型时，只需要控制 Provider Adapter 和环境变量，不需要改业务 API。

### 2. Mock 作为可演示兜底

默认 `AI_PROVIDER=mock`，不需要网络和密钥，保证本地开发、训练营演示、Playwright E2E 都稳定可跑。

切换真实模型时使用：

```env
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.openai.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="gpt-4o-mini"
```

兼容值：

- `mock`
- `openai`
- `openai-compatible`

### 3. Zod 校验是 AI 输出边界

四类 AI 能力分别有独立结构化 schema：

- `generatedContentOutputSchema`
- `auditOutputSchema`
- `rewriteOutputSchema`
- `qualityScoreOutputSchema`

Provider 原始输出只有通过 Zod 校验后才会返回给业务链路。

### 4. 日志不阻断创作链路

AI 调用日志写入失败时不会中断用户创作、审核或发布。原因是日志属于评估证据链，不应该成为 MVP 主链路的单点失败。

## AI 调用日志字段

`AiCallLog` 当前记录：

- `callType`：调用类型，包含 `generate_content`、`audit_content`、`rewrite_compliant`、`score_quality`。
- `provider`：`mock`、`openai` 或 `openai-compatible`。
- `model`：模型名。
- `durationMs`：调用耗时。
- `inputSummary`：输入摘要。
- `outputSummary`：输出摘要。
- `schemaValid`：Zod 校验结果。
- `errorMessage`：异常信息，可为空。
- `createdAt`：创建时间。

这些字段可以支撑后续 Prompt 版本对比、模型稳定性统计、schema 失败样例归因和审核质量评估。

## 验证结果

已通过：

```text
npm run db:generate
npm run db:push
npm run typecheck
npm run lint
npm run build
npm run e2e
```

E2E 结果：

```text
2 passed
```

AI 调用日志查询：

```bash
sqlite3 prisma/dev.db "select callType, provider, model, schemaValid, count(*) from AiCallLog group by callType, provider, model, schemaValid order by callType;"
```

查询结果：

```text
audit_content|mock|mock-ai-v1|1|6
generate_content|mock|mock-ai-v1|1|4
rewrite_compliant|mock|mock-ai-v1|1|2
score_quality|mock|mock-ai-v1|1|4
```

这说明 MVP 主链路和审核分支都已经产生 AI 调用日志，并且四类 AI 输出都通过 schema 校验。

## 后续建议

- 增加 `evals/`：沉淀审核样例、质量评分样例和 Prompt 调优记录。
- 在有真实密钥时补一次 OpenAI 兼容 Provider smoke test，并记录模型名、耗时、失败样例。
- 将 AI 调用日志扩展为效果评估报表，例如 schema 失败率、平均耗时、审核拦截率和改写后发布成功率。
- 为高风险审核场景增加更多 E2E 或接口级测试样例。
