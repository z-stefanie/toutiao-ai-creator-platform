# Step 24 - 测试说明文档覆盖核对

## 背景

本轮问题是核对飞书提交模板中「代码压缩包 - 测试说明：单元测试覆盖情况与运行方式」是否已经有对应项目文档。

模板来源：

- `（内部链接已移除）`

通过 `lark-cli drive +inspect` 确认该 Wiki 底层为 docx，标题为「作业提交文档模版 副本」。

## 模板要求

通过 `lark-cli docs +fetch --scope keyword` 定位到「代码压缩包」小节，模板要求包含：

- 目录结构与启动说明：README 包含环境依赖、安装与启动步骤。
- 测试说明：单元测试覆盖情况与运行方式。

## 当前项目材料

当前已有相关材料，但不是独立的「单元测试覆盖情况与运行方式」文档。

### 已覆盖的来源

- `README.md`
  - 包含验证命令：`npm run typecheck`、`npm run build`、`npm run lint`、`npm run evals`、`npm run e2e`。
  - 包含真实模型 smoke test：`npm run ai:smoke`。
  - 包含 E2E 测试说明：`playwright.config.ts`、`tests/e2e/mvp-flow.spec.ts` 和覆盖范围。
  - 包含 evals 样例说明：`evals/audit-cases.json`、`evals/quality-cases.json`、`evals/scripts/run-evals.mjs`。
- `docs/project-technical-document.md`
  - 「工程化与验证」章节列出验证命令、E2E 覆盖范围和真实模型 smoke test 运行方式。
- `docs/evaluation-report.md`
  - 说明 evals、E2E 产品验收分支、真实模型 smoke test 和性能基线。
- `docs/submission-checklist.md`
  - 将「README 启动与测试说明」标记为 done，并指向 `README.md`。

### 未覆盖或需要谨慎表述的点

- `package.json` 中没有独立的 `test` 或 `unit` 脚本。
- 当前测试目录只有 `tests/e2e/mvp-flow.spec.ts`，未发现 Jest/Vitest 单元测试配置或单元测试文件。
- 因此不能直接写「单元测试覆盖率 xx%」或暗示已经有独立单元测试覆盖报告。

## 结论

现有材料可以支撑「测试说明与运行方式」，但若严格按模板文案中的「单元测试覆盖情况」填写，需要把口径改成：

- 当前以 E2E、evals、类型检查、Lint、构建和真实模型 smoke test 为主要自动化验证。
- 暂无独立单元测试覆盖率报告。
- 后续可补充 Vitest/Jest 单元测试和 coverage 报告。

## 建议

如果要让提交材料更稳，建议新增一份 `docs/test-instructions.md`，专门整理：

- 测试策略总览。
- 各验证命令运行方式。
- E2E 覆盖范围。
- evals 样例覆盖范围。
- 真实模型 smoke test 运行方式。
- 当前无独立单元测试覆盖率报告的边界说明。
