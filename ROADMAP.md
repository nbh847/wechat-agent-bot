# WeChat Agent Bot Workspace Roadmap

## 当前阶段

项目正在从自研微信 Bot 实现切换为 `wechat-acp` 的受控 Agent 工作区，**同时作为散帅的个人 AI 助手工作区**，逐步替代 OpenClaw（`~/.qclaw/`）的功能。

## 已完成

- Goal 1 至 Goal 6 的旧版自研 Bot 曾完成人工验收。
- 将旧版实现及当前 Goal 7 未提交进度归档到分支 `archive/goal7-agent-v2-20260815`，归档提交为 `183f9e4`。
- 明确新方向采用 `wechat-acp` 的 ACP 常驻会话，不再维护仓库内自研微信通道和 Agent 进程协议。
- 完成 `main` 的规则重写与旧实现清理，只保留工作区规则、进度、许可证和历史调研资料。
- 2026-08-15：更新 README.md 明确项目定位为个人 AI 助手工作区，替代 OpenClaw。
- 2026-08-15：确认 `wechat-acp inject`（v0.10.0）支持本地消息注入，官方定位即 cron/launchd 场景；文件队列持久化，daemon 离线时消息排队等待补处理。
- 2026-08-15：实现定时任务功能并端到端验证通过。4 个 QClow 任务迁移为 launchd + inject 方案：热点新闻 07:00、星球简报 07:30/14:30/18:30、AI 日报 08:30、智谱用量 09:00。wrapper 位于 `scripts/cron-tasks/`，plist 源文件同目录 `launchd/`，已加载到 `~/Library/LaunchAgents/`。验证方式：`launchctl start` 逐个手动触发，4 个任务 exit code 0，injection 全部进入 `done/` 队列（failed 为 0）。
- 2026-08-16：完成 workspace `second-brain/` 个人待办库向 `personal/` 的合并迁移并删除源目录。18 个重叠条目以 second-brain 富内容版为准合并（`destination/` 两个本就相同），4 个独有条目（潜水员戴夫、自主目标执行系统、私有知识库APP、Sublime弹窗屏蔽与引流）新增，`template.md` 一并保留；QClow 侧 `~/.qclaw/second-brain/items/` 已确认不存在。`WORKSPACE.md` 同步移除该项目的索引行和待补规范条目。
- 2026-08-16：热点新闻 API Key 配置完成。散帅通过 `apikey-set` 将 `TENCENT_NEWS_APIKEY` 写入 `~/.zshrc`；`tencent-news-cli hot --limit 2` 在带环境变量、unset 环境变量、`env -i` 模拟 launchd 纯净环境三种条件下均正常返回，CLI 自身可从持久化配置读取 Key，不依赖 shell 环境，定时任务无需改动。
- 2026-08-16：完成定时任务与 QClaw 的解耦——`brief.mjs` 迁入 `scripts/cron-tasks/` 并改引用共享 skill `~/.agents/skills/web-crawler/`；热点新闻 wrapper 跳过 skill 包装层直调 `~/.tencent-news-cli/bin/tencent-news-cli`（摘要截断逻辑内联）；全盘确认无运行时引用后删除 `~/.qclaw/skills/web-crawler/`（散帅授权）。迁移后 `brief.mjs` 与热点新闻 wrapper 均回归验证通过。

## 进行中

- 等待散帅自行安装并配置 `wechat-acp`，本仓库不代为安装或启动。
- 将 OpenClaw（`~/.qclaw/`）中的个人数据逐步迁移到本仓库 `personal/` 目录。

## 待办

- 由散帅自行安装并选择具体版本的 `wechat-acp`。
- 将本仓库作为 `wechat-acp --cwd` 的目标目录，分别验证 Codex 与 Claude Code 是否完整读取对应规则。
- 验证多轮上下文、取消、新会话、会话恢复和微信结果回传。
- 设计并验证 ACP 权限请求到微信人工确认的强制权限代理。
- **定时任务观察期**：2026-08-16 起观察各任务按调度自动触发是否正常（launchd 不补跑睡眠期间错过的任务）。

## 阻塞

- `wechat-acp` 当前自动批准 ACP Agent 的权限请求。根目录规则只能约束 Agent 行为，不能形成强制安全边界；该缺口解决前，不得把敏感操作描述为已受技术层二次确认保护。

## 最近验证

- 2026-08-16：解耦后回归验证——`brief.mjs`（指向共享 web-crawler）删除 qclaw 副本前后各跑一次均正常输出；热点新闻新 wrapper 投递成功（exit 0，injection 进入 done）；今早 09:00 智谱用量任务由 launchd 按调度自动触发并投递，调度链路无需人工干预。
- 2026-08-16：second-brain 迁移完整性验证通过——24 个源文件与 `personal/` 合并结果逐个 `diff -q` 全部一致后，才执行 `rm -rf` 删除源目录；`personal/` 现有 26 个条目文件（含此前独有的 memory-bureau、shaolin-soccer、stormzhang-ai-daily）加 1 个模板。
- 2026-08-15：定时任务全链路验证通过——`launchctl start` 逐个触发 4 个任务（热点新闻、星球简报、AI 日报、智谱用量），全部 exit code 0；injection 队列 done 6 / failed 0，daemon 消费正常。期间发现并修复 launchd 无用户 PATH 导致 `env: node: No such file or directory` 的问题（wrapper 内显式 export nvm bin）。
- 2026-08-15：盘点 `~/.qclaw/` 定时任务，记录落在 Git 忽略的 `runtime-data/qclaw-cron-jobs.md`（本地参考，不进 Git）；4 个启用任务（热点新闻、星球简报、AI 日报、智谱用量）经微信投递，调度疑似自 2026-08-13 上午停摆，根因未排查。
- 2026-08-15：确认旧版 `main` 基线为 `fecd4db`，当前 9 个未提交进度文件已提交到归档分支，提交为 `183f9e4`。
- 2026-08-15：完成根目录规则重写；删除旧源码、测试、依赖清单和过时架构／运维文档；移除可重新生成的 `dist/` 与 `node_modules/`。确认 `runtime-data/` 和 `.claude/settings.local.json` 保留，`git diff --check` 通过。
- 2026-08-15：发现 QClow `second-brain/items/` 中有个人待做事项（待看电影、旅行目的地），明确本仓库应承担此功能。
