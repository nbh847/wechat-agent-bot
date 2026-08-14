# WeChat Agent Bot

WeChat Agent Bot 是一个运行在本地的常驻服务：通过微信接收散帅发送的指令，将任务交给本地可用的 AI Agent 执行，再把结果回复到对应的微信会话。

项目不绑定 Codex、Claude Code 或其他具体 Agent。微信通道采用 iLink Bot API，服务实现采用 TypeScript + Node.js；微信文本通道、安全任务入口、Agent-neutral 单任务执行、连续会话和项目内常驻运行控制已经完成。`launchd` 只交付未安装模板，尚未启用系统开机常驻。

## Agent 工作方式

本仓库是所有本地 AI Agent 共用的工作上下文。无论由哪个 Agent 打开，都按同一顺序工作：

1. 读取本文件，确认项目定位与通用入口。
2. 读取 `AGENTS.md`，遵守安全边界、文档规则和变更纪律。
3. 读取 `ROADMAP.md`，确认当前阶段、阻塞、最近验证和人工验收 Gate。
4. 读取 `docs/plans/development-goals.md` 中当前 Goal，只实现该 Goal 的范围。
5. 完成实现与验证后更新 `ROADMAP.md`，等待散帅人工验收；未验收不得进入下一个 Goal。

`CLAUDE.md` 等工具专用文件只用于引导对应工具进入上述通用工作流，不定义独立流程。项目代码通过 Agent-neutral 协议与执行端交互；具体 Agent 只是可替换实现，不能成为核心架构前提。

## 当前状态

- Goal 1 至 Goal 6 均已由散帅完成人工验收，MVP 已完成；Goal 7 正在优化自然对话路由与本机只读授权。
- 当前支持扫码登录、会话恢复、文本接收、口语化任务入口、当前任务续接、项目切换、一个等待任务、状态查询、取消、有限频率进度、高风险操作的一次性二次确认，以及通过通用协议续接单个 Agent 会话并回传结果。
- 微信绑定凭证保存在 `runtime-data/ilink/state.json`，有效期间持续复用；只有服务端明确返回 token 失效时才要求重新扫码，不做主动或定期刷新。
- 六个 MVP Goal 已严格按 `docs/plans/development-goals.md` 串行完成并通过验收。

## 当前微信指令

```text
task <project> <read|write> <任务说明>
status <task-id>
cancel <task-id>
confirm <task-id> <确认码>
reject <task-id> <确认码>
切换项目 <project>
继续 <task-id>
状态
取消当前任务
新任务
确认
拒绝
```

Agent 的控制项目始终是 `wechat-agent-bot`。Bot 不从口语化消息猜测目标项目、应用配置或业务动作，而是把用户原话交给 Agent 分析；Agent 返回结构化计划后，Bot 重新校验路径和权限，再决定是否执行或要求确认。散帅明确点名的 `~/...`、`/Users/mac/...` 本机子目录可作为当前 Agent 会话的只读范围；工作区外不允许写入，敏感凭据仍需单独确认。上海时区跨自然日后的第一条任务、累计 30 次 Agent 调用后的下一条任务、显式“新任务／新会话”会开启新上下文并清空会话读取范围。跨项目写入及删除、Git 高风险操作、凭证、数据库、全局依赖、系统配置、Cloudflare 和公开发布等操作必须二次确认；控制项目内普通低风险写入可直接执行。

## Agent 执行端

设置 `WECHAT_AGENT_EXECUTABLE` 后，任务会交给符合项目 JSON 协议的本地适配器：

```bash
WECHAT_AGENT_EXECUTABLE=/absolute/path/to/adapter npm start
```

适配器必须落实请求中的只读／写入路径权限，不得只依靠提示词限制 Agent。完整协议和安全责任见 `docs/architecture/agent-execution-protocol.md`。未配置执行端时，任务只会记录并明确回复“未执行”。

自然语言任务先经过 Agent 的只读分析阶段：Agent 负责发现目标、判断读写模式和形成具体动作；Bot 只校验结构化计划、处理二次确认和调度执行。执行阶段再由 Agent 完成文件修改、测试和验证。

## 本地运行控制

```bash
npm run service:start
npm run service:status
npm run service:stop
```

服务使用项目内单实例锁，健康状态和有限轮转日志写入 `runtime-data/service/`。`launchd` 模板见 `docs/operations/launchd.md`，当前未安装或启用。

## 当前不做

- 不配置系统常驻服务，不支持多账号、群聊和媒体消息。
- 不支持多个 Agent 或多个任务并发执行；第一版最多运行一个任务并排队一个任务。
- 不以公开部署或多用户 SaaS 为默认目标。

## 文档入口

- `AGENTS.md`：所有 Agent 共用的项目规则真实来源。
- `CLAUDE.md`：Claude Code 进入通用工作流的引导文件。
- `ROADMAP.md`：项目阶段、待办和最近验证。
- `docs/research/README.md`：调研主题、材料规范和结论状态。
- `docs/decisions/001-ilink-channel-implementation.md`：微信通道实现决策。
- `docs/architecture/agent-execution-protocol.md`：通用 Agent 进程协议和权限责任。
- `docs/operations/runbook.md`：启动、停止、重新扫码和故障排查。
- `docs/operations/mvp-acceptance.md`：MVP 端到端安全验收清单、证据和未完成项。
- `docs/plans/development-goals.md`：串行开发 Goal、验收标准和推进规则。

## 目录约定

后续目录必须在对应需求确认后再建立：

- `docs/research/`：调研记录与方案比较。
- `docs/decisions/`：散帅已确认的重要技术与产品决策；编号按确认顺序递增。
- `docs/plans/`：实施计划与阶段 Goal；完成状态以 `ROADMAP.md` 为准。
- `docs/architecture/`：已经进入实现阶段的稳定协议、组件边界和安全责任说明。
- `docs/operations/`：本地运行、故障恢复和系统服务模板；模板默认不安装，实际写入系统目录前必须单独确认。
- `runtime-data/`：登录凭证、同步游标等本机运行数据；禁止提交，是否清理由散帅决定。
- `runtime-data/service/`：单实例锁、健康状态和有限保留日志；进程正常停止时清理锁文件，其他运行数据是否清理由散帅决定。
- `scripts/`：项目内开发和运行控制脚本；不得安装为全局命令。
- `src/`：项目源码；`src/runtime/` 保存单实例、健康状态和日志等本地运行基础能力。
- `tests/`：与当前 Goal 验收标准直接相关的自动化测试。

文件名使用小写英文和连字符。临时材料不得提交到项目目录；需要保留的材料应整理为调研文档。清理文件或目录前必须取得散帅确认。
