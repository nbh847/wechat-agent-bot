# WeChat Agent Bot

通过微信给本地 AI Agent 发送任务，并接收执行结果。

项目不绑定具体 Agent。仓库自带 Codex 适配器，Claude Code、Kimi Code 等其他 Agent 可通过统一 JSON 协议接入。

## 功能

- 在微信中直接发送自然语言任务。
- 支持连续对话、任务取消、状态查询和上下文轮换。
- 支持读取本机项目及配置，并将结果回复到原微信会话。
- 跨项目写入和高风险操作需要二次确认。
- 运行状态和持久化用户数据保存在本机目录，并默认排除在 Git 提交之外。
- Agent 适配层可替换，不依赖特定 CLI 工具。

## 工作方式

```text
微信消息 → WeChat Agent Bot → Agent 适配器 → 本地 AI Agent
         ←                 执行结果 ←
```

Bot 负责微信通信、上下文、任务生命周期和安全校验；Agent 负责理解任务、发现目标、执行操作和验证结果。

## 环境要求

- Node.js 22 或更高版本。
- 一个符合项目协议的本地 Agent 适配器。
- 使用仓库自带适配器时，需要已安装并登录 Codex CLI。

## 快速开始

```bash
git clone https://github.com/nbh847/wechat-agent-bot.git
cd wechat-agent-bot
npm install
WECHAT_AGENT_EXECUTABLE=/absolute/path/to/wechat-agent-bot/scripts/codex-adapter.mjs npm run service:start
npm run service:status
```

首次启动会在 `runtime-data/ilink/login-qr.png` 生成微信登录二维码。扫码确认后，服务状态显示为 `listening` 即可开始使用。

停止服务：

```bash
npm run service:stop
```

完整运行说明见 [运行手册](docs/operations/runbook.md) 。

## 接入其他 Agent

执行端通过 JSON 进程协议接入。适配器需要实现任务分析和任务执行两个阶段，并落实请求中的文件读写权限。

协议说明见 [Agent 执行协议](docs/architecture/agent-execution-protocol.md) 。Claude Code、Kimi Code 或其他 Agent 只需提供符合该协议的适配器，无需修改 Bot 核心逻辑。

## 安全说明

- 服务会让本地 Agent 读取或修改文件，只应运行在受信任的个人设备上。
- 任务内容是否会发送给模型服务，取决于所接入 Agent 的实现及其隐私政策；不要用它处理未授权的敏感数据。
- 跨项目写入、删除、凭据访问、系统配置和发布操作会要求二次确认。
- 登录凭证、任务状态、日志和用户数据保存在 `runtime-data/`，该目录已被 Git 忽略。
- 当前上下文的用户消息和 Bot 回复会保存在 `runtime-data/conversations/`；默认保留 30 天、最多 30 个上下文、每个上下文最多 200 条消息。
- 已结束任务、待发送回复、消息去重记录和服务日志均设有时间或数量上限；有效登录凭证不会按固定时间自动删除。
- 当前使用腾讯 iLink Bot API 作为微信通道，不建议用于多用户或公开服务。

## 开发

```bash
npm run check
npm test
npm audit
```

项目进度见 [ROADMAP.md](ROADMAP.md) ，贡献和 Agent 工作规则见 [AGENTS.md](AGENTS.md) 。

## License

[MIT](LICENSE)
