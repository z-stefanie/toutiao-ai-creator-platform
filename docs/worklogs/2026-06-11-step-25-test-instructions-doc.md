# Step 25 - 测试说明文档补充

## 背景

飞书提交模板在「代码压缩包」部分要求补充「测试说明：单元测试覆盖情况与运行方式」。上一轮核对发现项目已有测试说明素材，但分散在 README、技术文档、评估报告和提交清单中，缺少一份可直接提交的独立文档。

## 本轮新增

- 新增 `docs/test-instructions.md`。
- 更新 `README.md` 文档索引，加入测试说明入口。
- 更新 `docs/submission-checklist.md`，将测试说明独立文档和飞书链接纳入提交证据。
- 更新 `docs/final-submission-draft.md`，在「代码压缩包」部分加入测试说明链接和摘要。

## 测试说明口径

文档明确采用保守口径：

- 当前未接入独立 Jest / Vitest 单元测试框架。
- 当前没有 `npm run test` / `npm run unit` 脚本。
- 当前没有独立单元测试 coverage 报告。
- 当前自动化验证主要由类型检查、Lint、生产构建、evals、Playwright E2E 和真实模型 smoke test 组成。

该口径避免把 E2E / evals 误写成单元测试覆盖率。

## 当前覆盖信息

- Evals 审核样例：33 条。
- Evals 质量样例：3 条。
- Playwright E2E 用例：7 条。
- 真实模型 smoke test 覆盖 4 类调用：`generate_content`、`audit_content`、`rewrite_compliant`、`score_quality`。

## 本轮验证

执行：

```bash
npm run evals
```

结果：

```text
Audit cases: 33/33 (100.0%)
Audit false positives: 0
Audit false negatives: 0
Quality cases: 3/3 (100.0%)
Eval schema failures: 0
AI call log schema success: 100.0%
```

## 飞书云文档

已将 `docs/test-instructions.md` 导入为飞书新版云文档：

```text
（内部链接已移除）
```

校验结果：

- `drive +inspect` 返回 `type=docx`。
- 标题为「头条AI创作者平台 - 测试说明」。
- `docs +fetch --scope outline --max-depth 2` 能读取完整 h1/h2 大纲。
- 本轮未调整分享权限。

## 后续建议

如果后续还要进一步增强测试证据，优先补：

- `src/server/audit/rule-prescreen.ts` 的规则单元测试。
- 榜单排序公式和质量评分公式单元测试。
- repository 事务逻辑单元测试。
- `npm run test` 和 `npm run coverage`。
