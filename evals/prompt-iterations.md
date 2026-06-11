# Prompt 调优记录

## 目标

本文件记录 AI 生成、审核、合规改写和质量评分的 Prompt 迭代。当前项目默认使用 Mock Provider 跑通稳定闭环，真实模型接入后应继续在这里记录版本、样例表现和失败原因。

## 版本记录

| 版本 | 能力 | 核心变化 | 评估结论 | 后续动作 |
| --- | --- | --- | --- | --- |
| v0 | 生成 | 只要求模型生成标题和正文 | 结构不稳定，无法直接进入编辑器 | 增加摘要、标签、配图建议和 reasoningSummary |
| v1 | 生成 | 固定 JSON 字段：title、summary、body、imageSuggestions、tags、reasoningSummary | 结构可被 Zod 校验，适合进入草稿链路 | 真实模型接入后补充失败样例 |
| v1 | 审核 | 覆盖涉黄、涉赌、涉毒、敏感信息、低俗内容 | Mock 样例可稳定识别高危关键词 | 扩充近义表达、隐晦表达和误杀样例 |
| v1 | 改写 | 要求保留原意并移除违规表达 | 可支持审核失败后的再次发布 | 增加改写前后 diff 质量评估 |
| v1 | 评分 | 从原创性、结构、可读性、信息密度、标题吸引力、图文匹配度评分 | 可进入榜单排序解释 | 引入人工标注样例校准分数段 |
| v2 | 审核/改写/评分 | 为真实模型补充英文枚举、对象数组和 dimensions 对象约束 | 火山方舟 OpenAI 兼容 smoke test 4/4 通过 | 继续收集真实模型 schema 失败样例 |

## 真实模型 Smoke Test

2026-06-11 使用火山方舟 OpenAI 兼容接口完成 smoke test：

```text
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=ep-20260610224007-dm42x
```

结果：

```text
generate_content OK 26572ms
audit_content OK 6429ms
rewrite_compliant OK 10334ms
score_quality OK 23667ms
summary 4/4 passed
```

关键调整：

- 不依赖 `response_format: json_object`，因为当前模型不支持该参数。
- 要求审核枚举使用英文值：`none`、`low`、`medium`、`high`，以及 `porn`、`gambling`、`drug`、`sensitive`、`vulgar`、`other`。
- 要求 `hitSpans` 和 `changedSpans` 返回对象数组，而不是字符串数组。
- 要求 `dimensions` 返回对象，并包含固定维度键。
- Provider 对模型输出先做 JSON 提取和控制字符修复，再进入 Zod schema。

## 当前 Prompt 原则

- 所有模型输出必须是 JSON，不允许 Markdown 包裹。
- 生成内容必须拆成标题、摘要、正文、配图建议、标签和推理摘要。
- 审核结果必须包含通过状态、风险等级、风险分类、命中片段、处置动作和建议。
- 高危内容必须拦截或要求改写，不能直接发布。
- 质量评分必须包含总分、维度分和改进建议。

## 下一轮调优计划

1. 接入真实 OpenAI 兼容服务后，用 `evals/audit-cases.json` 跑安全样例。
2. 将模型误判样例追加到 audit cases，区分漏判和误杀。
3. 用 `evals/quality-cases.json` 校准评分分段，避免所有内容集中在中高分。
4. 对 Prompt 版本增加日期、模型名、样例数量和指标变化。
