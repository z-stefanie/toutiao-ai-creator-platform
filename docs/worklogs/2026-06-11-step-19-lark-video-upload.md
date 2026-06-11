# 2026-06-11 技术留存：Step 19 演示视频上传飞书

## 本轮目标

将修正版演示视频上传到飞书云空间，并给出可用于提交模板的文件链接。

## 上传文件

本地文件：

```text
artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm
```

文件信息：

```text
size=10.2MB
duration=00:03:01.36
resolution=1280x720
```

## 飞书上传结果

上传命令：

```bash
lark-cli drive +upload --as user --file artifacts/demo-video/toutiao-ai-creator-demo-2026-06-11.webm --name '头条AI创作者平台演示视频-2026-06-11.webm' --json
```

返回结果：

```json
{
  "ok": true,
  "identity": "user",
  "file_name": "头条AI创作者平台演示视频-2026-06-11.webm",
  "file_token": "REDACTED",
  "size": 10682691,
  "url": "（内部链接已移除）"
}
```

复核命令：

```bash
lark-cli drive +inspect --as user --url '（内部链接已移除） --json
```

复核结果：

```json
{
  "ok": true,
  "type": "file",
  "title": "头条AI创作者平台演示视频-2026-06-11.webm",
  "token": "REDACTED"
}
```

权限复核：

```json
{
  "external_access": false,
  "link_share_entity": "closed",
  "share_entity": "same_tenant"
}
```

说明：文件已上传，文件链接已生成；但当前未开启链接分享。若要让评委或其他成员直接通过链接访问，需要用户明确确认后，再执行权限写操作，例如改为组织内可读。

## 最终链接

```text
（内部链接已移除）
```

## 同步更新

同步更新：

- `README.md`
  - 增加飞书云空间视频链接。
- `docs/submission-checklist.md`
  - 将演示视频缺口从“待上传”改为“已上传飞书；提交前需确认链接分享权限”。
- `docs/final-submission-draft.md`
  - 在演示视频字段补充飞书链接。
- `docs/project-self-review.md`
  - 将演示视频状态改为已上传飞书云空间。

## 当前剩余提交缺口

演示视频链路已经闭环。剩余主要提交缺口：

- 创建飞书提交模板副本并回填全部材料。
- 生成最终代码压缩包。
- 做最终敏感信息扫描和 Git 状态清理。
- 若官方必须要求 GitHub，则处理 `main/master` 分支与远端提交。
