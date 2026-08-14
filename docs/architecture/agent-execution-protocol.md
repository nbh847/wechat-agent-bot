# Agent 执行协议

## 定位

WeChat Agent Bot 只负责微信通讯、会话上下文、任务生命周期、身份和安全边界，以及调用适配器。它不解析自然语言中的项目、应用、配置、任务或业务意图。

Agent 负责读取规则、发现用户提到的项目或本机应用、判断读写模式和具体动作、执行修改与验证，并返回适合微信展示的结果。Codex、Claude Code 或其他执行端都必须通过同一协议接入，品牌不是核心架构前提。

安全边界不由提示词单独承担：Bot 重新校验 Agent 返回的结构化计划，适配器还必须把最终读写范围落实到具体 Agent 的沙箱或权限参数。

## 两阶段流程

### 1. 分析阶段

Bot 把用户原话原样交给适配器，工作目录固定为 `wechat-agent-bot`，只读权限覆盖本轮允许的发现范围。Agent 可以在该范围内发现目标和业务对象，但不得改变任何状态。

分析结果必须包含一个结构化计划：

```json
{
  "target": { "name": "repo-scout", "path": "/Users/your-name/workspace/repo-scout" },
  "mode": "read",
  "action": "检查项目结构和测试覆盖并总结",
  "sensitiveAccess": false,
  "readPaths": ["/Users/your-name/workspace/repo-scout"],
  "writePaths": []
}
```

Bot 会重新解析路径、检查真实路径和符号链接、限制读写范围，并根据 `sensitiveAccess`、具体路径和写入风险决定是否需要二次确认，不从 Agent 的业务动作文本猜测敏感访问。计划无效、越界或无法落地时直接失败，不猜测、不补全。

### 2. 执行阶段

只有通过安全校验且完成必要确认后，Bot 才发送执行请求：

- 只读任务从控制项目 `wechat-agent-bot` 运行，可续接当前只读 Agent 会话。
- 已确认写入任务从授权目标项目运行，`writePaths` 严格只有目标项目，使用独立临时会话，不继承只读会话。
- `targetProject`、`access`、`cwd` 和已批准计划必须逐项一致；适配器不接受不一致请求。
- Agent 必须先读取 `requiredContextFiles`，再按目标项目规则执行动作和验证。

## 启动与传输

- 当前协议版本为 `2`；新增或不理解分析阶段的适配器必须拒绝请求，不能把分析请求当成执行请求。
- 服务从 `WECHAT_AGENT_EXECUTABLE` 读取适配器可执行文件路径。
- 每个分析或执行阶段启动一个适配器进程；服务向标准输入写入一行 UTF-8 JSON，适配器只向标准输出写入一个 JSON 结果。
- 诊断可写标准错误，但不得包含凭证、token、密钥、完整消息或完整内部推理。
- 退出码非零、无效 JSON、协议版本不匹配和输出超限均视为失败。
- 适配器只继承 `PATH`、`HOME`、`TMPDIR` 和语言环境；核心服务不会自动传入其他环境变量或密钥。

## 请求

公共字段：

```json
{
  "version": 2,
  "phase": "analyze",
  "taskId": "T0001",
  "cwd": "/Users/your-name/workspace/wechat-agent-bot",
  "controlProject": {
    "name": "wechat-agent-bot",
    "path": "/Users/your-name/workspace/wechat-agent-bot"
  },
  "mode": "read",
  "instruction": "用户原话",
  "userInput": "用户原话",
  "persistSession": false,
  "requiredContextFiles": [],
  "access": {
    "readPaths": ["/Users/your-name/workspace/wechat-agent-bot", "/Users/your-name/workspace"],
    "writePaths": []
  }
}
```

执行阶段另带 `targetProject`、可选 `proposal`、`sessionId`、`handoffSummary` 和会话上下文；分析阶段不得带 `targetProject` 或 `proposal`，但可以只读续接当前 Agent 会话，且不持久化分析阶段的新会话。

`context.defaultTargetProject` 只表示散帅通过“切换项目”设置的持久路由偏好；它不是授权，也不替代 Agent 对本轮原话的业务判断。

分析阶段的 `access.readPaths` 是有限的只读发现范围。当前本地实现为工作区和用户主目录发现范围；适配器和 Agent 必须跳过备份、缓存、日志、媒体、诊断目录，不得读取或输出 `.env`、凭据、密钥、token、私钥和完整日志。计划返回的具体路径仍由 Bot 再次校验，工作区外只读路径不能转化为写入权限。

## 结果

分析成功：

```json
{
  "version": 2,
  "status": "succeeded",
  "proposal": {
    "target": { "name": "repo-scout", "path": "/Users/your-name/workspace/repo-scout" },
    "mode": "read",
    "action": "检查项目结构",
    "sensitiveAccess": false,
    "readPaths": ["/Users/your-name/workspace/repo-scout"],
    "writePaths": []
  }
}
```

执行成功：

```json
{
  "version": 2,
  "status": "succeeded",
  "sessionId": "optional-agent-session-id",
  "summary": "适合直接回复微信的简短结果"
}
```

失败结果使用 `error` 字段，内容必须是脱敏后的简短诊断。服务收到 `SIGTERM` 后会停止当前适配器；超时或未及时退出时继续强制终止。

## 责任边界

| 能力 | Bot | Agent／适配器 |
| --- | --- | --- |
| 微信收发、去重、待回复重试 | 负责 | 不参与 |
| 身份校验、任务状态、取消、超时、上下文轮换 | 负责 | 遵守请求 |
| 自然语言、项目／应用发现、业务意图 | 不解析 | Agent 负责 |
| 计划路径和读写模式安全校验 | Bot 负责 | 适配器再次校验 |
| 沙箱／权限参数落实 | 校验协议结果 | 适配器负责 |
| 文件修改、测试、验证和最终摘要 | 不执行 | Agent 负责 |
| 二次确认和红线拦截 | 负责 | 不得绕过 |
