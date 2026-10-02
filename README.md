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
├── goals/             # 本地临时执行目标（不进 Git，完成后经确认删除）
├── personal/          # 个人待做事项
│   ├── destination/   # 旅行目的地
│   ├── game/          # 想玩的游戏
│   ├── movie/         # 想看的电影
│   ├── product/       # 产品想法
│   ├── project/       # 想做的项目
│   ├── reading/       # 想读的书
│   └── research/      # 想研究的主题
├── scripts/
│   ├── wechat-acp/    # 仅 macOS 的 wechat-acp daemon 启动/验证入口（见下）
│   └── cron-tasks/    # 定时任务（launchd + wechat-acp inject）
│       ├── README.md  # 任务清单与约定
│       └── launchd/   # plist 源文件（加载副本在 ~/Library/LaunchAgents/）
├── docs/
│   ├── deployments/           # 各 Agent 部署手册（每篇含 macOS/Win10 双节；新增 Agent 复制模板加一篇）
│   │   ├── codebuddy.md       # CodeBuddy
│   │   ├── claude.md          # Claude
│   │   └── codex.md           # Codex（待实机核验）
│   └── research/              # 调研资料
└── runtime-data/      # 本地运行数据（不进 Git，见下）
    ├── vendor/wechat-acp/    # 固定提交的上游 wechat-acp 源码工作副本
    ├── claude-acp/           # 仅 macOS：固定版本的项目内 Claude ACP 适配器
    └── send-audit/           # 微信文本发送审计（脱敏 JSONL）
```

`goals/` 只保存已确认方案在实施期的临时拆分，不是项目进度源。按 `goals/<initiative-slug>/<NN>-<goal-slug>.md` 命名；每个 goal 独立定义成功标准和验证方式。整组目标完成并将结果同步到 `ROADMAP.md` 后，经散帅确认再删除对应 initiative 目录。

### 本地临时源码与运行数据（均不进 Git）

`runtime-data/claude-acp/`（仅 macOS）：新 Mac 部署使用的固定版本 Claude ACP 适配器及项目内依赖，不依赖运行时下载。与 vendor 构建一起保留，删除前需明确授权；不保存登录凭据。

`runtime-data/vendor/wechat-acp/`：基于官方固定提交的 `wechat-acp` 源码工作副本，包含“发送失败假成功”的本地根因修复并先在 macOS 验证。项目直接运行使用这个固定构建，不修改 `/Users/mac/node_modules/wechat-acp`，也不以 `npx ...@latest` 作为修复后生产入口。复制到本目录后按 `runtime-data/` 清理规则处理；如需删除必须先经散帅单独批准。

`runtime-data/send-audit/`：微信消息发送尝试的脱敏 JSONL 审计，仅本机保留，`.gitignore` 忽略，不在 Git 跟踪。2026-10-02 新 Mac 实现记录时间、耗时、`client_id`、`ret`、成功／失败与具名错误类型；不包含消息正文、token、用户 ID、`context_token`、headers 或请求/响应体。该实现不包含旧 Mac 审计的尝试序号和 HTTP 状态字段，不代表历史完整补丁已恢复。首次实现不追加日志轮转，先观察真实增长量，再决定是否需要清理机制。删除审计文件或目录必须经散帅单独批准。

`scripts/wechat-acp/`（仅 macOS）：`start-claude-daemon.sh` 为唯一 daemon 启动入口（人工启动、每周受控重启 wrapper、部署文档的恢复入口共用同一脚本），固定指向本地已验证构建，找不到构建时直接失败、不回退到未修复官方包；`verify-send-failure.sh` 为隔离故障验证入口，只调用测试夹具，不改真实网络或 daemon。整目录由 `scripts/` 整目录忽略，不进 Git。

新 Mac 启动脚本通过 `build-manifest.json` 校验上游提交、源码及构建指纹，并拒绝已有 Node 微信 Bot 实例。Claude preset 固定调用项目内 `0.85.1` 适配器，不在启动时下载依赖。登录数据位于本机 `/Users/mac/.wechat-acp/`，不进入仓库；启动入口不注册开机自启，也不恢复旧 Mac 定时任务。

`scripts/cron-tasks/`（仅 macOS）：保存任务清单、执行脚本与 `launchd/` 中的 plist 源文件，运行副本位于 `/Users/mac/Library/LaunchAgents/`。`runtime-data/cron/` 保存本机任务日志与互斥锁，不进 Git；成功仅表示脚本完成，微信到达需单独核验。脚本或 Skill 数据源缺失时任务失败退出，不生成占位内容。日志不得记录消息正文、凭据或原始接口响应。来源未恢复的任务不加载；当前恢复状态见项目 ROADMAP 与本地任务清单。停止任务使用对应 label 的 `launchctl bootout`，保留项目源文件和日志；删除须明确授权。

`.claude/skills/glm-stats/`（仅 macOS）：项目级智谱 GLM Coding Plan 额度查询 Skill，脚本按官方用量插件的请求构造，只查询额度端点一次并输出中文卡片。`runtime-data/cron/glm-credentials.json` 保存用户在本机手动录入的专用配置，权限为 `600`，不进 Git；配置不得进入 plist 或日志。`scripts/cron-tasks/setup-glm-credentials.command` 提供隐藏输入的本机录入入口，不改变 Claude Code 的认证配置。查询、定时包装及手动查询共用此 Skill，不读取其他项目的凭据。

智谱额度手动查询、定时推送与转发统一使用 [固定卡片模板](/Users/mac/workspace/wechat-agent-bot/docs/deployments/glm-usage-template.md) ，不由 Agent 临时改版。

## Agent 入口

- Codex 读取 [`AGENTS.md`](AGENTS.md) 。
- Claude Code 先读取 [`CLAUDE.md`](CLAUDE.md) ，再按其指引读取通用规则。
- CodeBuddy Code 读取全局 `CODEBUDDY.md`（已内嵌本项目规则），并以 `AGENTS.md` 为通用规则源；作为 `wechat-acp` Agent 时用 `wechat-acp --agent "codebuddy --acp"` 拉起，macOS 与 Win10 部署见 [`docs/deployments/codebuddy.md`](docs/deployments/codebuddy.md)。
- macOS 或 Win10 使用 Claude 部署时读取 [`docs/deployments/claude.md`](docs/deployments/claude.md)；使用 Codex 部署时读取 [`docs/deployments/codex.md`](docs/deployments/codex.md)（后者待实机核验）。后续新增 Agent 时，在 `docs/deployments/` 下复制既有手册模板新增一篇，并回填本段入口。
- 当前阶段和明确待办以 [`ROADMAP.md`](ROADMAP.md) 为准。

## 安全边界

当前 `wechat-acp` 会自动批准 ACP Agent 发出的权限请求。因此，仓库规则要求 Agent 在敏感操作前通过对话向散帅说明具体动作、目标、风险和影响，并等待一次性确认。

这属于 Agent 行为约束，不是强制权限隔离。没有独立权限代理时，不得把 ACP 的自动批准视为散帅已经确认。

## 历史与迁移

- 历史微信接入调研保留在 [`docs/research/`](docs/research/)
- 旧版自研 Bot 的完整代码和文档保存在 Git 分支 `archive/goal7-agent-v2-20260815`
- OpenClaw（`~/.qclaw/`）中的个人数据（如 `second-brain/items/`）逐步迁移到本仓库的 `personal/` 目录
