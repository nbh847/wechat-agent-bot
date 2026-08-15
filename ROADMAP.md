# WeChat Agent Bot Workspace Roadmap

## 当前阶段

项目正在从自研微信 Bot 实现切换为 `wechat-acp` 的受控 Agent 工作区，**同时作为散帅的个人 AI 助手工作区**，逐步替代 OpenClaw（`~/.qclaw/`）的功能。

## 已完成

- Goal 1 至 Goal 6 的旧版自研 Bot 曾完成人工验收。
- 将旧版实现及当前 Goal 7 未提交进度归档到分支 `archive/goal7-agent-v2-20260815`，归档提交为 `183f9e4`。
- 明确新方向采用 `wechat-acp` 的 ACP 常驻会话，不再维护仓库内自研微信通道和 Agent 进程协议。
- 完成 `main` 的规则重写与旧实现清理，只保留工作区规则、进度、许可证和历史调研资料。
- 2026-08-15：更新 README.md 明确项目定位为个人 AI 助手工作区，替代 OpenClaw。

## 进行中

- 等待散帅自行安装并配置 `wechat-acp`，本仓库不代为安装或启动。
- 将 OpenClaw（`~/.qclaw/`）中的个人数据逐步迁移到本仓库 `personal/` 目录。

## 待办

- 由散帅自行安装并选择具体版本的 `wechat-acp`。
- 将本仓库作为 `wechat-acp --cwd` 的目标目录，分别验证 Codex 与 Claude Code 是否完整读取对应规则。
- 验证多轮上下文、取消、新会话、会话恢复和微信结果回传。
- 设计并验证 ACP 权限请求到微信人工确认的强制权限代理。
- **个人数据迁移**：将 QClow `second-brain/items/` 中的待做事项迁移到 `personal/` 目录。

## 阻塞

- `wechat-acp` 当前自动批准 ACP Agent 的权限请求。根目录规则只能约束 Agent 行为，不能形成强制安全边界；该缺口解决前，不得把敏感操作描述为已受技术层二次确认保护。

## 最近验证

- 2026-08-15：盘点 `~/.qclaw/` 定时任务，记录落在 Git 忽略的 `runtime-data/qclaw-cron-jobs.md`（本地参考，不进 Git）；4 个启用任务（热点新闻、星球简报、AI 日报、智谱用量）经微信投递，调度疑似自 2026-08-13 上午停摆，根因未排查。
- 2026-08-15：确认旧版 `main` 基线为 `fecd4db`，当前 9 个未提交进度文件已提交到归档分支，提交为 `183f9e4`。
- 2026-08-15：完成根目录规则重写；删除旧源码、测试、依赖清单和过时架构／运维文档；移除可重新生成的 `dist/` 与 `node_modules/`。确认 `runtime-data/` 和 `.claude/settings.local.json` 保留，`git diff --check` 通过。
- 2026-08-15：发现 QClow `second-brain/items/` 中有个人待做事项（待看电影、旅行目的地），明确本仓库应承担此功能。
