# 2026-06-10 技术留存：Step 9 真实模型 Smoke Test

## 本轮目标

使用真实火山方舟 OpenAI 兼容接口做 smoke test，验证项目真实 AI Provider 的接入边界：

- `AI_BASE_URL` 是否应为 OpenAI 兼容 base URL。
- `AI_MODEL` 是否可使用方舟 endpoint id。
- 真实接口是否能返回项目要求的结构化 JSON。
- 生成、审核、合规改写、质量评分四类任务是否能通过 Zod schema。
- 不将 API Key 写入仓库、文档或提交内容。

## 本次配置

本次按火山方舟 OpenAI 兼容模式验证：

```text
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
AI_MODEL=ep-20260610224007-dm42x
```

API Key 只通过当前 shell 进程交互输入，没有写入 `.env.local`、README、worklog 或脚本。

## 验证过程

先做直接接口请求，结论如下：

- 带 `response_format: { type: "json_object" }` 时，服务返回 400：当前模型不支持该参数。
- 移除 `response_format` 后，接口返回 200，模型可以在 prompt 约束下输出可解析 JSON。

据此调整工程边界：

- OpenAI 兼容 Provider 不再依赖 JSON mode。
- Provider 在 system prompt 中要求只返回合法 JSON。
- Provider 先提取 JSON，再进入 Zod schema。
- 解析层补充保守修复：仅将 JSON 字符串内部的原始控制字符转义，处理模型正文中未转义换行的问题。
- 业务 prompt 补充英文枚举和对象结构要求，避免模型返回中文分类或字符串数组。

## Smoke Test 脚本

项目内置脚本：

```bash
npm run ai:smoke
```

运行时需要通过环境变量提供真实模型配置：

```bash
AI_PROVIDER=openai-compatible \
AI_BASE_URL=https://ark.cn-beijing.volces.com/api/v3 \
AI_MODEL=<endpoint-id> \
AI_API_KEY=<api-key> \
npm run ai:smoke
```

脚本覆盖四类项目核心 AI 输出：

1. `generate_content`：短图文生成结构。
2. `audit_content`：安全审核结构。
3. `rewrite_compliant`：合规改写结构。
4. `score_quality`：内容质量评分结构。

每类输出都使用 Zod schema 校验，与项目服务端字段保持一致。

## 本次结果

最终真实模型 smoke test 通过：

```text
[smoke] generate_content OK 26572ms fields=title,summary,body,coverSuggestion,imageSuggestions,tags,reasoningSummary
[smoke] audit_content OK 6429ms fields=passed,riskLevel,categories,hitSpans,action,suggestion
[smoke] rewrite_compliant OK 10334ms fields=title,body,changedSpans
[smoke] score_quality OK 23667ms fields=total,dimensions,reasons,improvementSuggestions
[smoke] summary 4/4 passed
```

总耗时约 67.0 秒。生成和评分耗时较高，后续真实演示时应保留 Mock Provider 作为兜底，真实模型更适合录制前预热或专项验证。

## 验证命令

本轮已通过：

```text
npm run ai:smoke
npm run typecheck
npm run lint
npm run evals
npm run build
npm run e2e
```

E2E 结果：

```text
7 passed
feed hot domContentLoaded=63ms
feed hot load=86ms
```

## 后续建议

- 保持 E2E 和常规演示默认使用 Mock Provider，避免真实模型耗时和稳定性影响主链路。
- 提交材料中可以引用真实 smoke test 作为“已验证真实模型接入”的证据，但不要宣称真实安全准确率达到 90%。
- 下一步补生产构建验证和部署环境 Lighthouse LCP。
