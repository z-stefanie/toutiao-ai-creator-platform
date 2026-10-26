# Step 26 - README 与 Prompt 调优记录飞书导入留存

## 背景

本轮任务是将以下两份 Markdown 文件转换为飞书新版云文档：

- `evals/prompt-iterations.md`
- `README.MD`

本地同时存在 `README.MD` 与 `README.md`，通过 `cmp -s README.MD README.md` 确认两者内容一致。本轮按用户指定路径 `README.MD` 导入。

## 导入方式

- 使用 `lark-cli drive +import --as user --type docx`。
- 未指定 `folder-token`，导入到当前用户飞书云空间根目录。
- 本轮只执行文档导入与只读校验，未调整文档分享权限。

## 生成的飞书云文档

| 本地文件 | 飞书文档标题 | 链接 |
| --- | --- | --- |
| `evals/prompt-iterations.md` | 头条AI创作者平台 - Prompt 调优记录 | （内部链接已移除） |
| `README.MD` | 头条AI创作者平台 - README | （内部链接已移除） |

## 校验结果

### 链接与标题

通过 `lark-cli drive +inspect --as user --url <docx-url>` 校验，两份文档均返回：

- `ok: true`
- `identity: user`
- `type: docx`
- 标题与预期一致

### 大纲结构

通过 `lark-cli docs +fetch --as user --api-version v2 --scope outline --max-depth 2 --doc-format markdown` 校验，两份文档均能读取到 h1/h2 大纲。

已确认的大纲入口：

- Prompt 调优记录：目标、版本记录、真实模型 Smoke Test、当前 Prompt 原则、下一轮调优计划。
- README：技术栈、目录结构、本地启动、在线体验、AI Provider 配置、验证命令、主要页面、演示路径、演示视频录制、当前实现边界、后续替换点、数据层说明、AI 调用日志、效果评估、E2E 测试、文档。

## 后续建议

如果这些链接需要交给评审或写入最终提交模板，需要单独确认分享范围后再调整飞书权限；本轮未做权限变更。
