# 2026-06-10 技术留存：审核规则、质量评分与效果评估体系

## 本轮目标

完成 Step 6：把审核规则、质量评分和效果评估从“功能说明”沉淀为可运行、可验证、可进入提交材料的证据链。

具体目标：

- 新增 `evals/` 样例和评估脚本。
- 新增审核规则与质量评估体系文档。
- 新增效果评估与优化报告雏形。
- 增加 `npm run evals`。
- 默认继续使用 Mock，保证本地和 E2E 稳定。
- 最后通过 `typecheck`、`lint`、`build`、`e2e`。

## 已完成内容

- 新增审核样例：`evals/audit-cases.json`。
- 新增质量样例：`evals/quality-cases.json`。
- 新增 Prompt 调优记录：`evals/prompt-iterations.md`。
- 新增评估脚本：`evals/scripts/run-evals.mjs`。
- 新增脚本命令：`npm run evals`。
- 新增提交材料文档：`docs/audit-and-quality-system.md`。
- 新增提交材料文档：`docs/evaluation-report.md`。
- 更新 `README.md`，补充 evals 说明和文档索引。
- 修复 E2E 主链路的榜单断言：从“必须出现在热点首屏”改为通过榜单 API 验证发布内容已进入热点榜单，再进入详情页。

## 评估设计

### 审核 evals

当前 8 条样例覆盖：

- 正常内容。
- 涉赌：`赌博`、`博彩`。
- 敏感信息：`敏感信息`、`身份证`。
- 低俗：`低俗`。
- 涉毒：`毒品`。
- 涉黄：`涉黄`。

脚本校验：

- 是否通过。
- 风险等级。
- 风险类型。
- 处置动作。
- 输出 schema 是否有效。
- 误杀数量。
- 漏判数量。

### 质量 evals

当前 3 条样例覆盖：

- `high`：结构完整、信息密度高、有素材和标签。
- `medium`：表达完整但信息密度有限。
- `low`：标题短、正文短、无标签和素材。

脚本校验：

- 总分是否在预期区间。
- 分数段是否符合预期。
- 维度分输出是否通过 schema。

### AI 调用日志

评估脚本会读取 `prisma/dev.db` 中的 `AiCallLog`，输出：

- schema 成功率。
- 平均耗时。
- 各调用类型的日志分布。

## 验证结果

已通过：

```text
npm run evals
npm run typecheck
npm run lint
npm run build
npm run e2e
```

`npm run evals` 输出：

```text
Audit cases: 8/8 (100.0%)
Audit false positives: 0
Audit false negatives: 0
Quality cases: 3/3 (100.0%)
Eval schema failures: 0
AI call log schema success: 100.0%
AI call log avg duration: 0.1ms
```

AI 调用日志分布：

```text
audit_content mock/mock-ai-v1: 12/12 schema valid, avg 0.1ms
generate_content mock/mock-ai-v1: 8/8 schema valid, avg 0.0ms
rewrite_compliant mock/mock-ai-v1: 4/4 schema valid, avg 0.3ms
score_quality mock/mock-ai-v1: 8/8 schema valid, avg 0.3ms
```

E2E 结果：

```text
2 passed
```

## 关键修复

E2E 主链路原本断言新发布内容必须出现在热点榜单首屏。随着本地数据库中历史 E2E 内容累积，榜单排序会让新内容不一定进入前 6，导致测试不稳定。

本轮将断言调整为：

```text
发布成功
  -> 打开 /feed/hot
  -> 通过 /api/feed/hot?limit=50 验证内容进入热点榜单
  -> 打开内容详情页
  -> 验证排序解释
```

这样保留了“内容进入榜单并可查看详情”的验收语义，同时避免把测试绑定到首屏排序名次。

## 后续建议

- 扩展审核样例到 50+，加入隐晦表达和误杀样例。
- 接入真实 OpenAI 兼容 Provider 后，复用同一套 evals 做模型对比。
- 将 eval 输出沉淀为可提交的截图或 JSON 结果文件。
- 补充 Lighthouse 或浏览器性能记录，完善 LCP 评估材料。
