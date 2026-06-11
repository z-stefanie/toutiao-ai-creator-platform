# 2026-06-10 技术留存：MVP 脚手架与纵向主链路骨架

## 本轮目标

完成项目脚手架初始化，并跑通第一条最小纵向主链路骨架：

```text
登录态模拟
  -> AI Mock 生成
  -> 草稿保存
  -> 发布前审核 Mock
  -> 发布内容进入榜单
  -> 内容详情页
```

同时补充 README、Git 忽略规则和本轮技术留存。

## 已完成内容

- 创建 Next.js App Router + React + TypeScript 脚手架。
- 建立统一页面布局和全局样式。
- 新增 Mock Auth：登录、注册、退出、当前用户 API。
- 新增 Mock Store：用户、Prompt、素材、草稿、内容、审核结果、质量分、榜单指标。
- 新增 Mock AI Provider：内容生成、安全审核、合规改写、质量评分。
- 新增 Ranking 计算：质量分、热度分、新鲜度加权。
- 新增创作者端页面：工作台、Prompt 管理、素材管理、AI 创作、编辑器。
- 新增消费端页面：热点榜单、爆文榜单、推荐榜单、内容详情。
- 新增草稿保存 API 和编辑器保存按钮；编辑器也保留 30 秒自动保存 hook。
- 新增发布前审核流程：命中“赌博”“敏感信息”等风险词时拦截，支持合规改写。
- 新增 README，记录启动方式、演示账号、演示路径和当前边界。

## 当前技术决策

- 先用内存 Mock Store 保证主链路速度，避免数据库配置阻塞 MVP 骨架。
- API 层使用 Next.js Route Handlers，但业务逻辑下沉到 `src/server/*`。
- AI 能力先由 `src/server/ai/mock-provider.ts` 承载，后续替换为 OpenAI 兼容 Provider。
- 榜单接口使用 cursor 分页，并在前端用 IntersectionObserver 做滚动加载骨架。
- 详情页展示排序公式，确保分发结果可解释。

## 验证计划

本轮需要验证：

- `npm install` 可安装依赖。已通过，安装 342 个 packages，无漏洞。
- `npm run typecheck` 通过。已通过。
- `npm run build` 通过。已通过，Next.js 16.2.9 生产构建成功。
- `npm run lint` 通过。已通过。
- 本地开发服务可打开，手动跑通登录、生成、保存、审核、发布、榜单、详情链路。已通过。

## 浏览器验证结果

验证环境：

- 本地地址：`http://localhost:3000`
- 测试账号：`demo@toutiao.ai / demo123456`
- 开发服务：`npm run dev`

成功链路：

```text
/login
  -> 登录成功进入 /dashboard
  -> /create 生成草稿
  -> /editor/[draftId] 保存草稿，版本 1 -> 2
  -> 发布并审核
  -> Mock 审核通过
  -> Mock 质量评分 83
  -> 内容进入 /feed/hot 榜首
  -> /content/[contentId] 展示正文和排序解释
```

违规分支：

```text
编辑器正文加入“赌博”
  -> 发布并审核
  -> Mock 审核拦截
  -> 展示 gambling: 赌博
  -> 点击合规改写
  -> 再次发布成功
```

## 已知边界

- 数据重启后会恢复 seed 状态。
- Mock 审核规则只覆盖演示风险词，不代表真实 90% 高危识别准确率。
- 素材上传 API 还未接真实上传。
- 端到端测试还未补齐。

## 下一步建议

1. 安装依赖并跑通构建。
2. 用浏览器实际验证主链路。
3. 若构建通过，补充 Prisma schema 和真实 Provider 适配层骨架。
4. 建立 `evals/audit-cases.json` 和 Prompt 调优记录，为最终评估报告做准备。
