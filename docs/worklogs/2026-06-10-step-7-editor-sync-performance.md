# 2026-06-10 技术留存：产品验收分支与性能证据

## 本轮目标

完成 Step 7：补齐产品验收分支与性能证据。

具体目标：

- 断网草稿恢复：IndexedDB 本地草稿镜像、离线继续编辑、`local_pending` 状态、恢复网络后同步服务端。
- 发布后二次编辑：已发布内容可重新进入编辑器，修改后重新审核、评分并更新线上内容。
- 榜单滚动加载与性能证据：E2E 覆盖加载更多，并记录热点榜单首屏性能基线。
- 文档与验证闭环：更新 README、评估报告，最后跑完整验证命令。

## 已完成内容

- 新增 IndexedDB 工具：`src/lib/offline-drafts.ts`。
- 增强自动保存 hook：`src/hooks/use-autosave-draft.ts`。
  - 在线保存成功后写入本地镜像。
  - 离线时写入 IndexedDB 并标记 `local_pending`。
  - 监听 `online` 事件，恢复网络后调用 sync API。
  - 增加同步并发保护，避免多次 online 事件导致版本冲突。
- 增强编辑器：`src/app/(creator)/editor/[draftId]/page.tsx`。
  - 加载草稿时优先恢复本地 `local_pending` 镜像。
  - 展示 autosave 状态和 draft `syncStatus`。
- 增强内容详情：`src/app/(feed)/content/[contentId]/page.tsx`。
  - 展示“编辑已发布内容”入口。
- 增强 repository：`src/server/repositories/app-repository.ts`。
  - 内容详情聚合时返回关联 `draftId`。
- 扩展类型：`src/lib/types.ts`。
  - `FeedItem` 增加可选 `draftId`。
- 扩展 E2E：`tests/e2e/mvp-flow.spec.ts`。
  - 离线草稿本地保存与恢复同步。
  - 发布后编辑并更新详情。
  - 榜单加载更多。
  - 热点榜单首屏 Playwright performance baseline。
- 更新 `README.md` 和 `docs/evaluation-report.md`。

## 离线草稿设计

本轮采用浏览器原生 IndexedDB，不引入额外依赖。

```text
编辑器字段变化
  -> 写入 IndexedDB 本地镜像
  -> 如果 navigator.onLine=false，标记 syncStatus=local_pending
  -> 用户点击保存时仍保留本地草稿
  -> 网络恢复触发 online 事件
  -> POST /api/drafts/:draftId/sync
  -> 服务端更新 draft，返回 synced 版本
```

关键取舍：

- 不改后端数据模型，继续复用已有 `syncStatus` 和 sync API。
- IndexedDB 只保存当前草稿镜像，不做复杂多设备合并。
- 如果恢复网络触发多次 online 事件，hook 使用 `syncingRef` 防止重复同步造成版本冲突。

## 发布后编辑设计

已有发布逻辑中，draft 会记录 `contentId`。再次发布同一 draft 时，repository 会用同一个 `contentId` 覆盖旧内容，并重新写入审核结果、质量分和排序指标。

本轮补齐了缺失入口：

```text
内容详情
  -> 编辑已发布内容
  -> /editor/:draftId
  -> 修改标题/正文
  -> 发布并审核
  -> 原 contentId 详情页更新
```

## 性能基线

E2E 中记录热点榜单首屏 navigation timing：

```text
feed hot domContentLoaded=43ms
feed hot load=78ms
threshold=2500ms
```

该数据来自本地开发环境热启动测试，低于任务要求中的 2.5 秒目标。正式提交前仍建议补部署环境 Lighthouse LCP。

## 验证结果

已通过：

```text
npm run evals
npm run typecheck
npm run lint
npm run build
npm run e2e
```

E2E 结果：

```text
5 passed
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
audit_content mock/mock-ai-v1: 42/42 schema valid, avg 0.0ms
generate_content mock/mock-ai-v1: 35/35 schema valid, avg 0.1ms
rewrite_compliant mock/mock-ai-v1: 7/7 schema valid, avg 0.1ms
score_quality mock/mock-ai-v1: 35/35 schema valid, avg 0.1ms
```

## 后续建议

- 在部署环境补 Lighthouse LCP 记录，并与本地 Playwright baseline 对比。
- 增加离线冲突分支：本地版本落后于服务端时提示用户合并。
- 增加发布后编辑的历史版本记录和回滚入口。
- 将素材上传从演示素材扩展到真实对象存储。
