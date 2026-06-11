# 头条 AI 前端训练营任务结构化需求

## 1. 项目定位

本项目是一个面向创作者的 AI 辅助生产与分发平台，目标不是单点接入 AI API，而是打通“创作、审核、发布、分发、反馈”的端到端闭环。

平台需要同时服务两类体验：

- 创作者侧：提供 AI 辅助内容生产、素材管理、草稿恢复、发布后编辑、合规改写等能力。
- 内容消费侧：提供热点/爆文榜单、内容详情、滚动加载和高性能浏览体验。

核心评估关注点：

- AI 工具深度应用与人机协同，占 30%。
- 端到端完整体验与产品氛围，占 30%。
- 架构设计与性能优化，占 20%。
- 内容安全与质量闭环，占 10%。
- 工程化与交付规范，占 10%。

## 2. 核心目标

### 2.1 产品目标

- 让创作者可以从灵感、素材、提示词开始，借助 AI 生成图文内容。
- 让平台在发布前自动识别内容安全风险，并给出拦截或合规替代内容。
- 让内容质量评分进入分发排序逻辑，使优质内容更容易被看到。
- 让读者可以流畅浏览热点、爆文、推荐内容，并进入详情消费。

### 2.2 工程目标

- 构建可运行、可部署、可公开访问的完整系统。
- 建立清晰的前后端边界、数据模型、AI 调用契约和错误处理策略。
- 保障编辑器草稿每 30 秒云端自动保存，支持断网继续编辑和恢复后同步。
- 榜单页首屏 LCP 不超过 2.5 秒。
- 代码托管到 GitHub，最终提交到 `main` 或 `master` 分支。

## 3. 用户角色

### 3.1 创作者

主要诉求：

- 管理提示词和创作素材。
- 使用 AI 生成图文内容。
- 编辑、保存草稿、恢复草稿。
- 发布内容并在发布后继续二次编辑。
- 在审核失败时理解原因，并一键生成合规替代内容。
- 查看内容质量分和优化建议。

### 3.2 读者

主要诉求：

- 浏览热点、爆文、推荐榜单。
- 通过滚动加载持续发现内容。
- 查看内容详情，包括作者、发布时间、图文正文。

### 3.3 平台管理员或运营者

主要诉求：

- 管理核心 Prompt。
- 管理多媒体素材。
- 查看审核规则和质量评分标准。
- 调整榜单排序策略。
- 处理高风险内容的下线、撤回、回滚等进阶能力。

## 4. 端到端主链路

本项目优先实现一条可展示、可解释、可评估的主链路：

```text
注册/登录
  -> 进入创作者工作台
  -> 选择或创建 Prompt
  -> 上传/选择素材
  -> AI 生成图文内容
  -> 编辑器人工修改
  -> 草稿自动保存与断网恢复
  -> 发起发布
  -> AI 内容安全审核
  -> AI 质量评分
  -> 审核通过后发布
  -> 进入热点/爆文/推荐榜单
  -> 读者滚动浏览
  -> 进入内容详情
```

审核失败分支：

```text
发起发布
  -> AI 内容安全审核未通过
  -> 展示风险类型、风险片段、处理建议
  -> 自动拦截发布
  -> 创作者选择一键生成合规替代内容
  -> 回到编辑器确认
  -> 再次提交审核
```

断网分支：

```text
编辑内容
  -> 网络断开
  -> 本地继续编辑并记录待同步变更
  -> 网络恢复
  -> 自动同步到云端草稿
  -> 若发生冲突，保留本地版本并提示用户处理
```

## 5. 功能模块拆解

### 5.1 用户中心，必做

需求：

- 支持手机号或邮箱注册。
- 支持手机号或邮箱登录。
- 支持安全退出登录。
- 登录态保护创作者工作台、内容编辑、素材管理等页面。

建议验收：

- 未登录用户访问创作页时跳转到登录页。
- 登录成功后可以进入工作台。
- 退出登录后本地登录态被清除，受保护页面不可继续访问。

### 5.2 AI 内容创作，必做

需求：

- 提供 Prompt 管理能力。
- 提供多媒体素材管理能力。
- 素材上传后进行基础合规校验。
- 支持 AI 生成图文内容。
- 支持一键发布。
- 支持发布后再次编辑和更新。
- 支持草稿与版本管理。
- 编辑过程中每 30 秒自动云端保存。
- 再次进入编辑器时自动恢复上次草稿。
- 断网时编辑器可继续工作，网络恢复后自动同步。

建议验收：

- 用户可以创建、编辑、删除或选择 Prompt。
- 用户可以上传素材，并看到合规校验状态。
- AI 生成内容后能进入编辑器继续修改。
- 页面刷新后能恢复最近草稿。
- 模拟断网后仍可输入，恢复网络后可同步。
- 已发布内容能重新编辑并更新线上内容。

### 5.3 内容 AI 审核，必做

需求：

- 对用户生成内容进行多维度安全审核。
- 审核范围至少覆盖涉黄、涉赌、涉毒、敏感信息、低俗内容。
- 对高危问题自动拦截或驳回。
- 提供一键生成合规替代内容。
- 定义内容质量评估标准。
- 使用 AI 对内容进行多维度质量打分。
- 质量分作为后续榜单排序依据。

建议验收：

- 审核结果包含是否通过、风险类型、风险等级、命中片段、解释和建议动作。
- 高危内容不可发布。
- 低风险内容可提示修改后再发布。
- 一键改写可以产出更合规的替代版本。
- 每篇发布内容都有质量评分和评分理由。

### 5.4 热点与爆文/推荐榜单，必做

需求：

- 支持用户查看图文内容详情。
- 详情页展示发布者信息、发布时间、图文正文。
- 支持热点榜单、爆文榜单或推荐榜单。
- 榜单支持无限滚动加载更多。
- 榜单排序综合质量分、阅读热度、发布时间等因素。
- 首屏 LCP 不超过 2.5 秒。

建议验收：

- 榜单首屏可以快速展示内容。
- 滚动到底部时自动加载下一页。
- 内容卡片可以进入详情。
- 排序结果能解释：为什么某篇内容排在前面。
- Lighthouse 或浏览器性能记录中 LCP 不超过 2.5 秒。

## 6. 进阶挑战

### 6.1 短图文创意编辑器

目标：

- 用户只提供核心素材和大致思路。
- AI 自动生成结构完整、表达丰富的短图文内容。

建议实现：

- 输入：主题、目标人群、风格、素材、发布平台。
- 输出：标题、封面建议、分段文案、配图建议、标签、摘要。
- 支持人类逐段确认和局部重写。

### 6.2 高精度内容安全识别

目标：

- 高危问题识别准确率达到 90% 以上。
- 支持内容下线、撤回、回滚等治理动作。

建议实现：

- 建立安全样例集和评估脚本。
- 结合规则预筛、模型审核、人工复核状态。
- 审核结果保留版本快照。

### 6.3 智能排序热点榜单

目标：

- 使用更复杂的 AI 干预排序算法。
- 综合质量分、实时阅读热度、发布时间、用户反馈等动态因子。

建议实现：

- 设计可解释排序公式。
- 支持运营配置权重。
- 支持不同榜单使用不同排序策略。

## 7. 页面地图

### 7.1 认证与账户

- 登录页：邮箱/手机号登录。
- 注册页：邮箱/手机号注册。
- 账户页：基础用户信息和退出登录。

### 7.2 创作者工作台

- 工作台首页：内容统计、草稿、已发布内容、审核失败内容。
- Prompt 管理页：Prompt 列表、创建、编辑、启停。
- 素材管理页：上传、预览、合规状态、删除。
- AI 创作页：创作参数、Prompt 选择、素材选择、AI 生成入口。
- 内容编辑器页：标题、正文、图片、标签、自动保存状态、版本记录。
- 发布确认页或弹窗：审核状态、质量评分、发布动作。

### 7.3 内容治理

- 审核结果页或面板：风险分类、风险等级、命中片段、改写建议。
- 合规改写确认页或面板：替代内容对比、接受替换、继续编辑。

### 7.4 内容消费

- 热点榜单页：热门内容流、排序维度、无限滚动。
- 爆文榜单页：高阅读/高互动内容流。
- 推荐榜单页：综合排序内容流。
- 内容详情页：作者、时间、正文、图片、质量/热度信号。

## 8. 数据实体

### 8.1 User

```ts
type User = {
  id: string;
  email?: string;
  phone?: string;
  nickname: string;
  avatarUrl?: string;
  role: 'creator' | 'admin';
  createdAt: string;
  updatedAt: string;
};
```

### 8.2 Prompt

```ts
type Prompt = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  template: string;
  category: 'article' | 'short_post' | 'review' | 'rewrite' | 'audit' | 'quality';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
};
```

### 8.3 Asset

```ts
type Asset = {
  id: string;
  ownerId: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  complianceStatus: 'pending' | 'passed' | 'rejected';
  complianceReason?: string;
  createdAt: string;
};
```

### 8.4 Draft

```ts
type Draft = {
  id: string;
  ownerId: string;
  contentId?: string;
  title: string;
  body: string;
  assetIds: string[];
  tags: string[];
  version: number;
  syncStatus: 'synced' | 'local_pending' | 'conflicted';
  lastSavedAt: string;
  createdAt: string;
  updatedAt: string;
};
```

### 8.5 Content

```ts
type Content = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  coverUrl?: string;
  assetIds: string[];
  tags: string[];
  status: 'draft' | 'reviewing' | 'published' | 'rejected' | 'offline';
  auditResultId?: string;
  qualityScoreId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 8.6 AuditResult

```ts
type AuditResult = {
  id: string;
  contentId: string;
  passed: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  categories: Array<'porn' | 'gambling' | 'drug' | 'sensitive' | 'vulgar' | 'other'>;
  hitSpans: Array<{
    text: string;
    category: string;
    reason: string;
  }>;
  action: 'allow' | 'warn' | 'block' | 'rewrite_required';
  suggestion: string;
  modelName: string;
  createdAt: string;
};
```

### 8.7 QualityScore

```ts
type QualityScore = {
  id: string;
  contentId: string;
  total: number;
  dimensions: {
    originality: number;
    structure: number;
    readability: number;
    informationDensity: number;
    titleAttraction: number;
    imageTextMatch: number;
  };
  reasons: string[];
  modelName: string;
  createdAt: string;
};
```

### 8.8 RankingMetric

```ts
type RankingMetric = {
  contentId: string;
  qualityScore: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  heatScore: number;
  rankingScore: number;
  calculatedAt: string;
};
```

## 9. API 边界

### 9.1 Auth API

- `POST /api/auth/register`：注册。
- `POST /api/auth/login`：登录。
- `POST /api/auth/logout`：退出。
- `GET /api/auth/me`：获取当前用户。

### 9.2 Prompt API

- `GET /api/prompts`：获取 Prompt 列表。
- `POST /api/prompts`：创建 Prompt。
- `PATCH /api/prompts/:id`：更新 Prompt。
- `DELETE /api/prompts/:id`：删除 Prompt。

### 9.3 Asset API

- `GET /api/assets`：获取素材列表。
- `POST /api/assets`：上传素材。
- `POST /api/assets/:id/check`：触发素材合规校验。
- `DELETE /api/assets/:id`：删除素材。

### 9.4 Draft API

- `GET /api/drafts/latest`：获取最近草稿。
- `POST /api/drafts`：创建草稿。
- `PATCH /api/drafts/:id`：更新草稿。
- `POST /api/drafts/:id/sync`：同步离线变更。
- `GET /api/drafts/:id/versions`：获取版本记录。

### 9.5 AI Creation API

- `POST /api/ai/generate-content`：根据 Prompt、素材和创作参数生成图文内容。
- `POST /api/ai/rewrite-compliant`：根据审核结果生成合规替代内容。
- `POST /api/ai/suggest-title`：生成标题候选，可选。
- `POST /api/ai/suggest-tags`：生成标签候选，可选。

### 9.6 Content API

- `GET /api/contents`：获取当前用户内容列表。
- `GET /api/contents/:id`：获取内容详情。
- `POST /api/contents/publish`：发布内容，内部触发审核和质量打分。
- `PATCH /api/contents/:id`：更新已发布内容。
- `POST /api/contents/:id/offline`：内容下线，进阶。
- `POST /api/contents/:id/rollback`：版本回滚，进阶。

### 9.7 Audit API

- `POST /api/audit/content`：审核内容。
- `GET /api/audit/results/:contentId`：获取内容审核结果。

### 9.8 Ranking API

- `GET /api/feed/hot`：热点榜单。
- `GET /api/feed/viral`：爆文榜单。
- `GET /api/feed/recommended`：推荐榜单。
- `GET /api/feed/:contentId`：消费侧内容详情。

## 10. AI 调用契约

### 10.1 内容生成

输入：

- 主题。
- 目标受众。
- 内容类型。
- 语气风格。
- Prompt 模板。
- 素材摘要或素材 URL。
- 字数范围。

输出必须结构化：

```json
{
  "title": "string",
  "summary": "string",
  "body": "string",
  "imageSuggestions": ["string"],
  "tags": ["string"],
  "reasoningSummary": "string"
}
```

### 10.2 内容安全审核

输出必须结构化：

```json
{
  "passed": true,
  "riskLevel": "none",
  "categories": [],
  "hitSpans": [],
  "action": "allow",
  "suggestion": "string"
}
```

约束：

- 高危风险必须返回 `passed: false`。
- 高危风险必须返回 `action: "block"` 或 `action: "rewrite_required"`。
- 命中片段需要尽量具体，便于用户修改。

### 10.3 合规改写

输入：

- 原内容。
- 审核风险类型。
- 命中片段。
- 改写约束。

输出：

```json
{
  "title": "string",
  "body": "string",
  "changedSpans": [
    {
      "before": "string",
      "after": "string",
      "reason": "string"
    }
  ]
}
```

### 10.4 质量评分

评分维度建议：

- 原创性。
- 结构完整度。
- 可读性。
- 信息密度。
- 标题吸引力。
- 图文匹配度。

输出：

```json
{
  "total": 86,
  "dimensions": {
    "originality": 85,
    "structure": 90,
    "readability": 88,
    "informationDensity": 82,
    "titleAttraction": 87,
    "imageTextMatch": 84
  },
  "reasons": ["string"],
  "improvementSuggestions": ["string"]
}
```

## 11. 排序策略

### 11.1 基础排序公式

建议先采用可解释的加权公式：

```text
rankingScore =
  qualityScore * 0.45
  + heatScore * 0.35
  + freshnessScore * 0.20
```

其中：

- `qualityScore`：AI 内容质量总分，范围 0 到 100。
- `heatScore`：阅读、点赞、评论、分享等互动信号归一化后的分数。
- `freshnessScore`：发布时间衰减分，越新分数越高。

### 11.2 进阶排序因子

- 用户负反馈率。
- 内容安全历史。
- 作者信誉。
- 同主题多样性。
- 实时热点匹配度。
- AI 运营干预标签。

## 12. 非功能需求

### 12.1 性能

- 榜单页 LCP 不超过 2.5 秒。
- 榜单接口分页加载，避免一次性返回过多数据。
- 图片使用懒加载和合理尺寸。
- 首屏关键内容优先渲染。
- 对榜单数据做缓存或预计算。

### 12.2 可用性

- AI 调用失败时提供重试。
- 草稿保存失败时提示本地已保存。
- 网络断开时编辑器不阻塞输入。
- 发布流程中明确展示审核状态。

### 12.3 安全与合规

- 用户只能访问自己的草稿、素材和创作内容。
- 上传素材需要基础类型、大小、合规校验。
- AI 审核和改写记录需要留痕。
- 高危内容默认拦截。

### 12.4 可观测性

- 记录 AI 调用耗时、失败率、模型名称。
- 记录审核通过率、拦截率、误判案例。
- 记录榜单接口耗时。
- 记录前端 LCP、接口错误、草稿保存失败。

## 13. 技术选型建议

PDF 推荐或允许的技术方向：

- 前端：React 18+、TypeScript，推荐 Next.js 或 UmiJS。
- 后端：Node.js，推荐 Koa、NestJS、Express，或 Go。
- AI 能力：可自由选择大模型 API，推荐火山方舟；Node.js 调用时建议使用 OpenAI SDK 兼容模式。
- 多模态能力：可集成开源模型或第三方 API，注意数据合规。
- 数据存储：MySQL/PostgreSQL 与 Redis/MongoDB 结合使用。
- 开放 API：可集成或模拟抖音、头条开放 API，用于热点数据或一键分发，属于加分项。

建议实现取向：

- 优先使用 TypeScript 贯穿前后端。
- AI 响应全部要求 JSON Schema 化，降低不可控输出。
- 榜单排序先用数据库字段和服务端预计算，后续再接入更复杂策略。
- 本地开发可以先使用模拟 AI 服务，保留真实模型适配层。

## 14. 交付物

- 可运行系统：线上部署，提供公开访问 URL 或二维码。
- 体验材料：提供测试账号/密码和 3 到 5 分钟演示视频，覆盖创作、审核、分发全链路。
- 项目介绍文档：说明项目简介、核心功能、产品亮点、界面截图或 GIF、功能完成度清单。
- 技术文档：完整技术方案与架构设计文档，建议使用飞书文档整理。
- 评估与总结：平台效果评估与内容分发优化报告。
- 规则与体系：内容安全审核规则库与质量评估体系说明。
- 代码产出：托管于 GitHub，最终提交至 `main` 或 `master` 分支；提交时同时准备完整项目代码压缩包。
- 工程说明：README 需要包含目录结构、环境依赖、安装步骤、启动步骤和测试方式。
- 项目自评：对照课题要求说明完成度、不足之处和未来长期建设思路。

### 14.1 提交模板映射

提交模板要求的最终文档结构会反向约束开发过程，开发阶段需要同步沉淀以下材料：

| 模板栏目 | 开发期需要沉淀的内容 |
| --- | --- |
| 基本信息 | 项目名称、作者、前端/后端/数据库/AI 能力技术栈 |
| 体验地址 | 线上地址、测试账号、演示视频脚本和录屏 |
| 项目介绍文档 | 一句话定位、三大核心模块、产品亮点、截图/GIF、完成度清单 |
| 项目技术文档 | 架构图、数据流、技术选型、核心模块设计、AI 接入、数据库设计、性能优化、错误处理、日志监控、测试 |
| 审核规则与质量评估体系 | 安全规则库、判定边界、处置方式、质量评分维度、分发排序使用方式、识别-干预-反馈闭环 |
| 效果评估与优化报告 | Prompt Engineering 调优记录、审核准确率评估、LCP 实测数据、生成质量与排序效果评估、未来优化方向 |
| 代码压缩包 | 完整代码、README、环境依赖、安装启动步骤、测试说明 |
| 项目自评 | 完成度自查、已知不足、长期建设路线 |

## 15. 三周里程碑

### 第 1 周

目标：

- 完成技术选型和架构设计。
- 搭建项目基础脚手架。
- 完成用户登录注册模块。
- 完成 AI 内容创作核心功能。

建议可交付：

- 登录/注册可用。
- 创作者工作台初版可用。
- Prompt 和素材管理可用。
- AI 生成内容可进入编辑器。
- 草稿保存基础链路可用。

### 第 2 周

目标：

- 攻坚内容 AI 审核模块。
- 完成安全红线识别。
- 完成质量打分体系。
- 开始构建热点、爆文榜单前端页面。

建议可交付：

- 发布前审核可用。
- 审核失败可拦截。
- 合规改写可用。
- 内容质量分可用。
- 榜单页面和内容详情初版可用。

### 第 3 周

目标：

- 完成榜单后端逻辑。
- 完成性能优化。
- 进行系统联调测试。
- 撰写技术文档和总结报告。
- 完成线上部署。

建议可交付：

- 榜单排序可解释。
- 无限滚动可用。
- LCP 达标或有优化报告。
- 完整演示链路稳定。
- 文档、规则库、评估报告齐备。

## 16. 验收清单

### 16.1 必做功能验收

- 用户可以注册、登录、退出。
- 用户可以管理 Prompt。
- 用户可以上传和管理素材。
- 用户可以使用 AI 生成图文内容。
- 用户可以编辑 AI 生成内容。
- 编辑器每 30 秒自动保存云端草稿。
- 用户重新进入编辑器时可以恢复草稿。
- 断网时可以继续编辑，恢复网络后可以同步。
- 用户可以发布内容。
- 已发布内容可以二次编辑和更新。
- 发布前会进行 AI 安全审核。
- 高危内容会被自动拦截。
- 审核失败时可以一键生成合规替代内容。
- 内容会获得 AI 质量评分。
- 榜单会使用质量分、阅读热度、发布时间等综合排序。
- 榜单支持无限滚动。
- 内容详情展示作者、时间、图文正文。
- 榜单页 LCP 不超过 2.5 秒。

### 16.2 文档验收

- 有技术方案与架构设计。
- 有核心模块设计说明。
- 有 AI Prompt 调优和评估过程。
- 有内容安全审核规则库。
- 有质量评分体系。
- 有内容分发排序说明。
- 有性能优化说明。
- 有未来优化方向。

### 16.3 工程验收

- 项目可本地运行。
- 项目可线上访问。
- 关键流程有测试或可重复验证脚本。
- TypeScript 类型检查通过。
- 代码风格一致。
- Git 提交记录清晰。

## 17. 风险与应对

### 17.1 AI 输出不可控

风险：

- 模型返回非 JSON。
- 审核结果不稳定。
- 质量评分解释不一致。

应对：

- 使用严格 JSON 输出协议。
- 服务端做 schema 校验。
- 失败时重试或降级。
- 保存模型输入输出用于评估。

### 17.2 内容安全准确率难证明

风险：

- 文档要求高危问题识别准确率不低于 90%，如果没有样例集很难证明。

应对：

- 建立小型评估集，覆盖涉黄、涉赌、涉毒、敏感信息、低俗、正常内容。
- 统计准确率、召回率、误判案例。
- 报告中说明样例集规模和局限。

### 17.3 草稿离线同步复杂

风险：

- 多端编辑、离线编辑和云端版本冲突处理复杂。

应对：

- MVP 先支持单用户单设备离线队列。
- 使用版本号或更新时间做冲突检测。
- 冲突时保留本地版本并提示用户手动处理。

### 17.4 LCP 达标压力

风险：

- 榜单首屏图片多，AI 内容卡片重，容易影响 LCP。

应对：

- 首屏减少卡片数量。
- 优先加载首张图，其他图片懒加载。
- 服务端分页和缓存。
- 避免首屏阻塞式 AI 请求。

## 18. 待确认问题

- 是否必须接入真实火山方舟模型，还是允许用 OpenAI 兼容接口加模拟模型兜底？
- 是否需要真实手机号短信登录，还是训练营阶段可用邮箱/验证码模拟？
- 素材上传是否必须接入对象存储，还是可先使用本地/云端静态存储？
- 榜单热度数据是否接真实开放 API，还是可以模拟阅读、点赞、评论数据？
- 线上部署目标平台是什么，例如 Vercel、Render、飞书云、服务器或其他平台？

## 19. MVP 边界建议

第一版优先保证：

- 登录注册。
- 创作者工作台。
- Prompt 管理。
- 素材管理。
- AI 生成内容。
- 编辑器自动保存和恢复。
- 发布前审核。
- 合规改写。
- 质量评分。
- 榜单和详情。
- 无限滚动。
- 基础性能优化。

可以暂缓：

- 多端实时协同编辑。
- 真实开放平台分发。
- 视频、语音等复杂多模态生成。
- 复杂运营后台。
- 大规模并发架构落地。
