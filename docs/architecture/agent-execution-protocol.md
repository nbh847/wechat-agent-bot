# Agent 执行协议

## 定位

WeChat Agent Bot 不识别 Codex、Claude Code 或其他 Agent 品牌。核心服务通过一个本地进程协议调用当前配置的可信执行适配器；任何 Agent 只要有符合本协议的适配器即可接入。

适配器不是普通不可信插件，而是权限边界的一部分。它必须把请求中的读写范围落实为对应 Agent 的沙箱或权限配置，不能只把范围写进提示词。

## 启动与传输

- 服务从 `WECHAT_AGENT_EXECUTABLE` 读取适配器可执行文件路径。
- 每个任务启动一个适配器进程，工作目录始终是 WeChat Agent Bot 项目目录；目标项目通过独立字段传递。
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
  "targetProject": {
    "name": "example-project",
    "path": "/Users/mac/workspace/example-project"
  },
  "mode": "read",
  "instruction": "检查 README 并总结项目定位",
  "sessionId": "optional-existing-agent-session-id",
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

`cwd` 是固定的服务项目路径，不随目标项目改变。`targetProject` 是本次任务要访问的项目；适配器必须从固定 `cwd` 启动 Agent，并把目标项目及本轮权限明确传给 Agent。

`sessionId` 存在时表示后续消息必须续接该 Agent 会话；适配器成功后应返回同一个会话标识。字段缺失表示启动新会话。

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
- 适配器负责让 Agent 固定从 `cwd` 运行，并把 `targetProject`、读写路径和两边项目规则落实到具体 Agent 的调用参数及沙箱。
- Agent 负责遵守目标项目规则，在授权范围内完成任务并返回可见结果。
- 未实现本协议或无法落实路径权限的 Agent 不得接入执行链路。
