# 2026-06-10 技术留存：Playwright E2E 与 Prisma Repository 替换

## 本轮目标

先补 Playwright E2E，然后做 Prisma Schema + Repository 替换。

## 已完成内容

- 新增 Playwright 配置：`playwright.config.ts`。
- 新增 E2E 用例：`tests/e2e/mvp-flow.spec.ts`。
- E2E 覆盖成功主链路：登录、AI 生成、草稿保存、发布审核、热点榜单、内容详情排序解释。
- E2E 覆盖审核分支：正文加入“赌博”后拦截，合规改写后再次发布成功。
- 新增 Prisma schema：`prisma/schema.prisma`。
- 新增 Prisma config：`prisma.config.ts`。
- 新增 SQLite adapter 初始化：`src/server/db/prisma.ts`。
- 新增 seed 脚本：`prisma/seed.mjs`。
- 新增本地 schema 应用脚本：`prisma/apply-schema.mjs`。
- 新增 Repository：`src/server/repositories/app-repository.ts`。
- 删除旧内存 store：`src/server/store.ts`。
- 将 Auth、Prompt、Asset、Draft、AI 生成、合规改写、发布、Feed、内容详情 API 全部切到 repository。

## 数据层决策

- 本地 MVP 使用 SQLite 文件 `prisma/dev.db`，不进入 Git。
- Repository 隔离数据库访问，API 不直接依赖 Prisma 表结构。
- Prisma schema 使用字符串字段保存数组/结构化 JSON，例如 `assetIdsJson`、`tagsJson`、`dimensionsJson`，repository 负责映射到前端类型。
- Prisma 7 不再支持 schema 内 datasource url，因此数据库 URL 放在 `prisma.config.ts` 和 `.env`。
- Prisma Client 通过 `@prisma/adapter-better-sqlite3` 连接 SQLite。
- 当前环境下 `prisma db push` 返回空 schema engine error；已将 `npm run db:push` 改为 `prisma migrate diff -> generated-schema.sql -> apply-schema.mjs` 的稳定本地路径。

## 验证结果

已通过：

```text
npm run db:generate
npm run db:push
npm run db:seed
npm run typecheck
npm run lint
npm run build
npm run e2e
```

E2E 结果：

```text
2 passed
```

## 后续建议

- 将 Prisma datasource 从 SQLite 切换为 PostgreSQL 前，先保持 repository 接口稳定。
- 增加 repository 单元测试，覆盖 draft 冲突、feed cursor、publish transaction。
- 扩展 E2E：断网草稿恢复、发布后二次编辑、榜单滚动加载。
- 开始接入 OpenAI 兼容 Provider，同时保留 Mock Provider 作为测试兜底。

