# 2026-06-10 技术留存：进阶挑战最小闭环增强

## 本轮目标

完成 Step 8：围绕任务文档第 6 节的三个进阶挑战，补齐可演示、可验证、可解释的最小闭环。

目标包括：

- 动态加权榜单：支持 hot / viral / recommended 各自运营权重，并在详情页展示当前榜单权重。
- 高精度安全识别增强：扩展审核样例到 30+，增加规则预筛层，补最小内容下线治理 API。
- 短图文创意编辑器增强：展示封面/配图建议，正文拆成段落卡片，支持单段局部重写。
- 更新 README、评估文档和本轮技术留存，最后跑完整验证。

## 已完成内容

### 动态加权榜单

- 新增共享配置：`src/lib/ranking-config.ts`。
- 新增类型：`FeedType`、`RankingConfig`、`feedbackScore`、`activeRankingScore`。
- 更新排序计算：`src/server/ranking/ranking.ts`。
- 更新 Feed repository：按榜单配置计算 active score 后排序。
- 更新 Feed API 返回 `rankingConfig`。
- 更新榜单页：展示运营权重，内容卡片带 `?feed=` 来源。
- 更新详情页：展示当前榜单权重和 active ranking score。

当前配置：

```text
hot: quality 40%, heat 30%, freshness 20%, feedback 10%
viral: quality 20%, heat 45%, freshness 10%, feedback 25%
recommended: quality 55%, heat 15%, freshness 15%, feedback 15%
```

### 高精度安全识别增强

- 新增规则预筛层：`src/server/audit/rule-prescreen.ts`。
- Mock 审核改为复用规则预筛命中结果。
- 审核样例从 8 条扩展到 33 条：`evals/audit-cases.json`。
- 评估脚本同步扩展风险词：`evals/scripts/run-evals.mjs`。
- 新增内容下线 API：`POST /api/contents/:contentId/offline`。
- 下线后内容状态为 `offline`，不再进入榜单和详情消费。

规则预筛当前覆盖：

- 涉赌：赌博、博彩、赌局、下注、赔率、彩票套利。
- 涉毒：毒品、禁药、吸毒、贩毒、违禁药物。
- 涉黄：涉黄、色情、成人内容、裸露、黄色网站。
- 低俗：低俗、擦边、粗俗、恶俗、挑逗。
- 敏感信息：敏感信息、身份证、手机号、家庭住址、银行卡、密码。

### 短图文创意编辑器增强

- AI 生成结果新增 `coverSuggestion`。
- 创作页跳转编辑器前将封面建议和配图建议写入 sessionStorage。
- 编辑器展示封面建议和 AI 配图建议。
- 编辑器正文拆为“段落创意卡片”。
- 新增局部重写 API：`POST /api/ai/rewrite-paragraph`。
- 编辑器支持“局部重写第 N 段”，返回后更新草稿并可继续保存发布。

## 验证结果

已通过：

```text
npm run evals
npm run typecheck
npm run lint
npm run build
npm run e2e
```

`npm run evals`：

```text
Audit cases: 33/33 (100.0%)
Audit false positives: 0
Audit false negatives: 0
Quality cases: 3/3 (100.0%)
Eval schema failures: 0
AI call log schema success: 100.0%
AI call log avg duration: 0.1ms
```

AI 调用日志分布：

```text
audit_content mock/mock-ai-v1: 64/64 schema valid, avg 0.0ms
generate_content mock/mock-ai-v1: 55/55 schema valid, avg 0.1ms
rewrite_compliant mock/mock-ai-v1: 9/9 schema valid, avg 0.2ms
score_quality mock/mock-ai-v1: 55/55 schema valid, avg 0.1ms
```

E2E 结果：

```text
7 passed
```

新增 E2E 覆盖：

- 段落局部重写后保存发布。
- hot / viral / recommended 使用不同运营权重。
- 详情页展示当前榜单权重。
- 内容下线后详情 API 返回 `CONTENT_NOT_FOUND`。

性能基线：

```text
feed hot domContentLoaded=52ms
feed hot load=70ms
threshold=2500ms
```

## 当前边界

- 动态榜单权重仍是代码配置，不是运营后台可编辑表单。
- 规则预筛仍是关键词规则，真实高精度识别还需要真实模型和更多样例集。
- 内容治理目前只实现下线，未实现恢复、撤回、回滚和人工复核队列。
- 局部重写当前是确定性 Mock 文案，真实模型接入后可复用同一 API 边界。

## 后续建议

- 进入提交前收口：项目介绍、演示脚本、自评、部署说明。
- 如有真实模型 key，补 OpenAI 兼容 Provider smoke test。
- 将动态权重配置迁移到数据库或运营配置页面。
- 扩展内容治理为人工复核列表、恢复、回滚和版本快照。
