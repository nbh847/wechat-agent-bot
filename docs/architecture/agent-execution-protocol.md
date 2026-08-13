# Agent 执行协议

## 定位

WeChat Agent Bot 不识别 Codex、Claude Code 或其他 Agent 品牌。核心服务通过一个本地进程协议调用当前配置的可信执行适配器；任何 Agent 只要有符合本协议的适配器即可接入。

适配器不是普通不可信插件，而是权限边界的一部分。它必须把请求中的读写范围落实为对应 Agent 的沙箱或权限配置，不能只把范围写进提示词。

## 启动与传输

- 服务从 `WECHAT_AGENT_EXECUTABLE` 读取适配器可执行文件路径。
- 每个任务启动一个适配器进程。只读任务工作目录是 WeChat Agent Bot 控制项目；已确认写入任务的工作目录临时设为授权目标项目。目标项目和控制项目通过独立字段传递。
- 服务向标准输入写入一行 UTF-8 JSON 请求，然后关闭标准输入。
- 适配器只向标准输出写入一个 JSON 结果；诊断信息可写标准错误，但不得包含密钥、凭证或完整内部推理。
- 退出码必须为 `0`；非零退出、无效 JSON、协议版本不匹配和输出超限均视为执行失败。
- 适配器只继承 `PATH`、`HOME`、`TMPDIR` 和语言环境；核心服务不会把其他环境变量或密钥自动传入执行端。

## 请求

```json
{
  "version": 1,
  "taskId": "T0001",
  "cwd": "/Users/mac/workspace/wechat-agent-bot",
  "controlProject": {
    "name": "wechat-agent-bot",
    "path": "/Users/mac/workspace/wechat-agent-bot"
  },
  "targetProject": {
    "name": "example-project",
    "path": "/Users/mac/workspace/example-project"
  },
  "mode": "read",
  "instruction": "检查 README 并总结项目定位",
  "sessionId": "optional-existing-agent-session-id",
  "persistSession": true,
  "requiredContextFiles": [
    "/Users/mac/workspace/wechat-agent-bot/README.md",
    "/Users/mac/workspace/wechat-agent-bot/AGENTS.md",
    "/Users/mac/workspace/example-project/README.md",
    "/Users/mac/workspace/example-project/AGENTS.md",
    "/Users/mac/workspace/example-project/ROADMAP.md"
  ],
  "access": {
    "readPaths": [
      "/Users/mac/workspace/wechat-agent-bot",
      "/Users/mac/workspace/example-project"
    ],
    "writePaths": []
  }
}
```

适配器必须先让 Agent 读取 `requiredContextFiles`，再执行 `instruction`。`taskId` 必须进入执行记录；写任务产生的改动必须能追溯到该 ID。

`controlProject` 是固定的 WeChat Agent Bot 控制项目。`targetProject` 是本次任务要访问或修改的项目。只读任务必须满足 `cwd === controlProject.path`；写入任务必须满足 `cwd === targetProject.path`，且 `writePaths` 只能包含该目标项目。写入任务结束后不能改变后续任务的默认工作目录。

`sessionId` 存在时表示后续只读消息必须续接该 Agent 会话；适配器成功后应返回同一个会话标识。`persistSession=false` 表示本轮使用独立临时会话，返回的会话标识不得成为后续默认上下文。已确认写入任务必须使用独立临时会话，避免写权限语义延续到普通后续消息。

核心服务在上海时区跨自然日后的第一条 Agent 任务、累计 30 次 Agent 调用后的下一条任务，以及用户显式发送“新任务／新会话”时启动新会话。自动轮换可通过 `handoffSummary` 传递不超过 1000 字的最小交接摘要；不得携带完整聊天记录。目标项目变化不触发会话轮换。

`access.readPaths` 是允许读取的最大范围，`access.writePaths` 是允许写入的最大范围。只读任务的 `writePaths` 必须为空。适配器不得自行扩大范围，也不得使用绕过审批或沙箱的危险参数。

## 结果

成功：

```json
{
  "version": 1,
  "status": "succeeded",
  "sessionId": "optional-agent-session-id",
  "summary": "适合直接回复微信的简短结果"
}
```

失败：

```json
{
  "version": 1,
  "status": "failed",
  "sessionId": "optional-agent-session-id",
  "error": "不包含敏感数据的简短错误"
}
```

适配器必须在收到 `SIGTERM` 后停止当前 Agent；如果没有及时退出，服务会发送 `SIGKILL`。服务只接受一个受限大小的结果，并再次限制微信可见文本长度。

## 安全责任

- 核心服务负责身份、路径解析、任务状态、二次确认、单任务执行、超时、取消和结果回传。
- 适配器负责校验 `cwd`、`controlProject`、`targetProject` 和本轮读写范围的一致性，并把它们落实到具体 Agent 的调用参数及沙箱。
- Agent 负责遵守目标项目规则，在授权范围内完成任务并返回可见结果。
- 未实现本协议或无法落实路径权限的 Agent 不得接入执行链路。
