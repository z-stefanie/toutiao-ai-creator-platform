# Step 23 - 飞书云文档导入留存

## 背景

本轮任务是将最终提交材料中的 5 份本地 Markdown 文档转换为飞书新版云文档，便于后续提交、分享和评审阅读。

## 输入文件

- `docs/project-introduction.md`
- `docs/project-technical-document.md`
- `docs/project-self-review.md`
- `docs/audit-and-quality-system.md`
- `docs/evaluation-report.md`

## 导入方式

- 使用 `lark-cli drive +import --as user --type docx`。
- 未指定 `folder-token`，导入到当前用户飞书云空间根目录。
- 本轮只执行文档导入与只读校验，未调整文档分享权限。

## 生成的飞书云文档

| 本地文件 | 飞书文档标题 | 链接 |
| --- | --- | --- |
| `docs/project-introduction.md` | 头条AI创作者平台 - 项目介绍文档 | （内部链接已移除） |
| `docs/project-technical-document.md` | 头条AI创作者平台 - 项目技术文档 | （内部链接已移除） |
| `docs/project-self-review.md` | 头条AI创作者平台 - 项目自评 | （内部链接已移除） |
| `docs/audit-and-quality-system.md` | 头条AI创作者平台 - 审核规则与质量评估体系 | （内部链接已移除） |
| `docs/evaluation-report.md` | 头条AI创作者平台 - 效果评估与优化报告 | （内部链接已移除） |

## 校验结果

### 链接与标题

通过 `lark-cli drive +inspect --as user --url <docx-url>` 校验，5 份文档均返回：

- `ok: true`
- `identity: user`
- `type: docx`
- 标题与预期一致

### 大纲结构

通过 `lark-cli docs +fetch --as user --api-version v2 --scope outline --max-depth 2 --doc-format markdown` 校验，5 份文档均能读取到 h1/h2 大纲。

已确认的大纲入口：

- 项目介绍文档：项目简介、在线体验、核心功能、产品亮点、功能完成度清单、演示建议、当前边界。
- 项目技术文档：技术目标、技术栈、系统架构、核心目录、主链路数据流、数据模型、AI 能力接入、审核与质量评分、榜单排序、性能与部署、工程化与验证、当前边界与后续替换点。
- 项目自评：总体结论、完成度自评、评分维度对照、当前边界、做得比较好的地方、不足与改进方向、长期建设路线、自评结论。
- 审核规则与质量评估体系：目标、安全审核规则库、合规改写策略、质量评分体系、评估样例、后续优化。
- 效果评估与优化报告：评估目标、评估对象、评估方法、当前结果、结果解读、已发现边界、下一步优化计划。

## 后续建议

如果这些文档需要交给外部评审或训练营收集表单访问，需要单独确认分享范围后再调整飞书权限；本轮未做权限变更，避免误放开资料访问范围。
