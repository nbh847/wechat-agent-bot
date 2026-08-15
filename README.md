# WeChat Agent Bot Workspace

本仓库是 `wechat-acp` 启动本地 AI Agent 时使用的受控工作目录，不再维护自研微信 Bot、iLink 通道或 Agent 执行适配器。

微信通信和 ACP 会话由用户自行安装、运行的 `wechat-acp` 提供；Codex、Claude Code 或其他 ACP Agent 从本仓库目录启动，并遵守根目录规则文件。

## 工作方式

```text
微信消息 → wechat-acp → ACP Agent → 本地项目工作区
         ←           Agent 回复 ←
```

本仓库只负责：

- 定义 Agent 在当前工作区内的行为、安全和确认规则。
- 保存稳定项目说明、当前进度和必要调研资料。
- 作为 `wechat-acp --cwd` 指向的默认工作目录。

本仓库不负责：

- 安装、升级或启动 `wechat-acp`。
- 保存微信登录凭证、Agent token、密钥或 `.env`。
- 实现微信协议、Agent 会话服务或权限代理。

## Agent 入口

- Codex 读取 [`AGENTS.md`](AGENTS.md) 。
- Claude Code 先读取 [`CLAUDE.md`](CLAUDE.md) ，再按其指引读取通用规则。
- 当前阶段和明确待办以 [`ROADMAP.md`](ROADMAP.md) 为准。

## 安全边界

当前 `wechat-acp` 会自动批准 ACP Agent 发出的权限请求。因此，仓库规则要求 Agent 在敏感操作前通过对话向散帅说明具体动作、目标、风险和影响，并等待一次性确认。

这属于 Agent 行为约束，不是强制权限隔离。没有独立权限代理时，不得把 ACP 的自动批准视为散帅已经确认。

历史微信接入调研保留在 [`docs/research/`](docs/research/) 。旧版自研 Bot 的完整代码和文档保存在 Git 分支 `archive/goal7-agent-v2-20260815`。
