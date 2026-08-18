# WeChat Agent Bot Workspace

本仓库是散帅的**个人 AI 助手工作区**，用于替代 OpenClaw（小龙虾）作为本地 Agent 的统一入口和个人知识管理空间。

## 项目定位

- **核心目标**：通过 `wechat-acp` 实现微信消息驱动的本地 AI Agent，将个人知识管理、待办事项、任务执行整合在一个受控工作区内。
- **替代关系**：本仓库替代 OpenClaw（`~/.qclaw/`）成为主要工作空间；QClow 保留历史数据和部分技能，新活动逐步迁移到此。
- **数据范围**：个人待做事项、观影清单、旅行目标、研究项目、项目进度、规则文件和必要调研资料。

## 工作方式

```text
微信消息 → wechat-acp → ACP Agent → 本地项目工作区
         ←           Agent 回复 ←
```

本仓库负责：

- 定义 Agent 在当前工作区内的行为、安全和确认规则。
- 保存个人待做事项（待看清单、旅行目的地、研究项目等）。
- 保存稳定项目说明、当前进度和必要调研资料。
- 作为 `wechat-acp --cwd` 指向的默认工作目录。

本仓库不负责：

- 捆绑或代管 `wechat-acp`；各机器按 `docs/deployment-*.md` 完成本地部署和运行管理。
- 保存微信登录凭证、Agent token、密钥或 `.env`。
- 实现微信协议、Agent 会话服务或权限代理。

## 目录结构

```
wechat-agent-bot/
├── README.md          # 本文件
├── AGENTS.md          # 通用 Agent 规则
├── CLAUDE.md          # Claude Code 入口规则
├── ROADMAP.md         # 项目进度
├── personal/          # 个人待做事项
│   ├── reading/       # 待看清单（电影、动画）
│   ├── destination/   # 旅行目的地
│   └── research/      # 研究项目
├── scripts/
│   └── cron-tasks/    # 定时任务（launchd + wechat-acp inject）
│       ├── README.md  # 任务清单与约定
│       └── launchd/   # plist 源文件（加载副本在 ~/Library/LaunchAgents/）
├── docs/
│   ├── deployment-windows.md  # Win10 + Claude/CodeBuddy 原生部署手册
│   ├── deployment-macos.md    # macOS + CodeBuddy 原生部署手册
│   └── research/              # 调研资料
└── runtime-data/      # 本地运行数据（不进 Git）
```

## Agent 入口

- Codex 读取 [`AGENTS.md`](AGENTS.md) 。
- Claude Code 先读取 [`CLAUDE.md`](CLAUDE.md) ，再按其指引读取通用规则。
- CodeBuddy Code 读取全局 `CODEBUDDY.md`（已内嵌本项目规则），并以 `AGENTS.md` 为通用规则源；作为 `wechat-acp` Agent 时用 `wechat-acp --agent "codebuddy --acp"` 拉起，macOS 与 Win10 部署分别见 [`docs/deployment-macos.md`](docs/deployment-macos.md) 与 [`docs/deployment-windows.md`](docs/deployment-windows.md) 的 CodeBuddy 变体段。
- 当前阶段和明确待办以 [`ROADMAP.md`](ROADMAP.md) 为准。
- Win10 使用 Claude 或 CodeBuddy 部署时读取 [`docs/deployment-windows.md`](docs/deployment-windows.md)（CodeBuddy 见该文「CodeBuddy 变体（Win10）」段）。

## 安全边界

当前 `wechat-acp` 会自动批准 ACP Agent 发出的权限请求。因此，仓库规则要求 Agent 在敏感操作前通过对话向散帅说明具体动作、目标、风险和影响，并等待一次性确认。

这属于 Agent 行为约束，不是强制权限隔离。没有独立权限代理时，不得把 ACP 的自动批准视为散帅已经确认。

## 历史与迁移

- 历史微信接入调研保留在 [`docs/research/`](docs/research/)
- 旧版自研 Bot 的完整代码和文档保存在 Git 分支 `archive/goal7-agent-v2-20260815`
- OpenClaw（`~/.qclaw/`）中的个人数据（如 `second-brain/items/`）逐步迁移到本仓库的 `personal/` 目录
