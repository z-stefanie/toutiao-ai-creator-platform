# 效果评估与优化报告

## 1. 评估目标

本报告用于说明当前 AI 创作者辅助生产与分发平台的效果基线。评估重点不是证明 Mock 模型具备真实线上准确率，而是证明项目已经具备可持续评估能力：

- 有审核与质量样例集。
- 有可执行评估脚本。
- 有 AI 调用日志。
- 有 schema 校验和耗时统计。
- 有可进入最终提交材料的指标口径。

## 2. 评估对象

当前评估覆盖：

- 内容安全审核：涉赌、敏感、低俗、涉毒、涉黄和正常内容。
- 内容质量评分：高质量、普通质量、低信息量内容。
- AI 输出结构校验：审核和评分 eval 输出的 Zod 校验。
- AI 调用日志：来自 `AiCallLog` 表的调用类型、模型、schema 校验结果和耗时。
- 产品验收分支：离线草稿同步、发布后编辑、短图文局部重写、内容下线治理、榜单加载更多。
- 首屏性能基线：使用 Playwright navigation timing 记录热点榜单首屏加载时间。

当前默认 Provider：

```text
AI_PROVIDER=mock
AI_MODEL=mock-ai-v1
```

## 3. 评估方法

运行命令：

```bash
npm run evals
```

脚本行为：

1. 读取 `evals/audit-cases.json`。
2. 用 Mock 审核逻辑输出审核结果。
3. 用 Zod 校验审核输出结构。
4. 对比期望的通过状态、风险等级、风险类型和处置动作。
5. 读取 `evals/quality-cases.json`。
6. 用 Mock 质量评分逻辑输出质量分。
7. 用 Zod 校验评分输出结构。
8. 对比期望分数段和总分区间。
9. 读取 `prisma/dev.db` 中的 `AiCallLog`，统计 schema 成功率和平均耗时。

## 4. 当前结果

最近一次本地评估结果：

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

Playwright 热点榜单首屏性能基线：

```text
feed hot domContentLoaded=63ms
feed hot load=86ms
threshold=2500ms
```

线上 / 公网入口 Performance 记录：

```text
url=https://freedom-physicians-neighborhood-photographs.trycloudflare.com
testedAt=2026-06-11T06:46:03.789Z
testAccount=demo@toutiao.ai / demo123456
verifiedFlow=login -> generate -> publish -> hot feed -> content detail
publishedContentId=content_f4869d1c
feed hot domContentLoaded=639ms
feed hot load=639ms
feed hot FCP=656ms
feed hot LCP=1488ms
threshold=2500ms
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

## 5. 结果解读

### 5.1 审核准确率

当前 33 条审核样例全部通过，说明 Mock 规则库能稳定覆盖 MVP 演示所需的高危风险类型：

- 涉赌：`赌博`、`博彩`
- 敏感信息：`敏感信息`、`身份证`
- 低俗：`低俗`
- 涉毒：`毒品`
- 涉黄：`涉黄`
- 正常内容：不误拦

该结果只能作为本地基线，不代表真实模型在线上场景达到 100% 准确率。

### 5.2 质量评分覆盖

当前 3 条质量样例全部通过，分别覆盖：

- high：结构完整、信息密度高、素材匹配。
- medium：表达完整但信息密度有限。
- low：内容过短、标题弱、缺少标签和素材。

这说明当前评分体系已经能支撑提交材料里的“质量分进入排序”说明，但真实模型接入后仍需要人工标注样例校准。

### 5.3 Schema 稳定性

Eval schema failures 为 0，AI 调用日志 schema success 为 100%。这说明当前生成、审核、改写、评分四类 AI 输出都在结构化边界内运行。

### 5.4 性能观察

当前平均耗时约 0.1ms，这是 Mock Provider 的本地耗时，只能作为脚本和日志闭环是否可用的证据。真实 Provider 接入后，需要重新记录模型耗时、超时率和失败样例。

热点榜单首屏 Playwright performance baseline 为 `domContentLoaded=63ms`、`load=86ms`，低于 2.5 秒目标。该数据来自本地开发环境的热启动测试，适合作为当前工程链路的基线；正式提交前仍建议在部署环境补一份 Lighthouse 或浏览器 Performance 记录。

公网入口通过 Cloudflare quick tunnel 暴露生产构建服务，已完成一次在线主链路验证。榜单页通过浏览器 `PerformanceObserver` 采集到 LCP=`1488ms`，低于课题要求的 2.5 秒。该地址属于临时 quick tunnel，适合提交前验证和演示预览；正式长期提交建议替换为稳定部署地址。

真实火山方舟 OpenAI 兼容 smoke test 已覆盖生成、审核、合规改写和质量评分四类任务，最终 4/4 通过。真实模型总耗时约 67.0 秒，明显高于 Mock Provider，因此常规 E2E 和现场演示仍建议默认使用 Mock Provider，真实模型作为接入能力和结构化输出验证证据。

### 5.5 产品验收分支

当前 E2E 已覆盖：

- 离线草稿：断网输入后写入 IndexedDB，本地状态标记 `local_pending`，恢复网络后同步服务端。
- 发布后编辑：已发布内容从详情页重新进入编辑器，修改后重新审核、评分并更新原内容详情。
- 短图文局部重写：展示封面/配图建议，段落卡片支持单段重写后保存发布。
- 内容治理：运营下线 API 将内容状态置为 `offline`，内容不再进入榜单和详情消费。
- 动态榜单：hot、viral、recommended 使用不同运营权重，并在详情页展示当前榜单权重。
- 榜单加载更多：通过热点榜单分页加载更多内容，并验证首屏性能基线。

## 6. 已发现边界

- 样例数量已扩展到 33 条，但仍不能支撑真实线上“高精度 90%”声明。
- Mock 规则是关键词匹配，无法识别隐晦表达、上下文规避和语义变体。
- 质量评分是确定性公式，真实模型可能出现分数漂移，需要 Prompt 版本记录。
- 当前真实模型不支持 `response_format: json_object`，项目 Provider 已改为 prompt-only JSON 输出约束 + JSON 提取 + Zod schema 校验。
- 当前报告已包含本地 Playwright performance baseline 和公网入口 Performance LCP 数据；quick tunnel 无长期可用性保证，正式提交前可替换为稳定部署地址后复测。

## 7. 下一步优化计划

1. 将审核样例扩展到 50+，加入误杀和漏判样例。
2. 接入真实 OpenAI 兼容 Provider 后，跑同一套 evals 并和 Mock 基线对比。
3. 将 Prompt 版本、模型名、样例通过率、schema 失败率写入 `evals/prompt-iterations.md`。
4. 若替换为长期稳定部署地址，重新记录 Lighthouse / Performance LCP，并与当前 quick tunnel baseline 对比。
5. 从 `AiCallLog` 汇总长期指标：平均耗时、schema 失败率、审核拦截率、改写后发布成功率。
