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
- 2026-08-16：停用 OpenClaw/QClow 常驻服务——卸载并删除 `ai.openclaw.gateway.plist` LaunchAgent，`openclaw-gateway` 进程已停，`launchctl list` 无 openclaw 任务；删除 `~/.openclaw/logs/`（354M gateway 日志），保留 `state/`（SQLite cron 配置备查）与 `identity/`（设备认证）。`~/.qclow/` 目录已不存在（此前迁移轮已清理）。
- 2026-08-17：补齐 Win10 原生 Claude 部署手册 `docs/deployment-windows.md`，固定使用 `wechat-acp@0.10.0` 和官方 `claude` preset，覆盖前提检查、远程同步、扫码确认门禁、微信端验收、daemon 二次确认、停止与故障排查；文档明确不重装现有 Claude、不迁移 macOS 定时任务、不复制登录凭据。
- 2026-08-17：完成 Win10 实机部署并通过全部验收。`wechat-acp@0.10.0` + `claude` preset + `--hide-thoughts`，前台扫码登录建立本机凭据后切换 daemon（PID 文件与日志在 `~/.wechat-acp/`）。微信端验收 4 条全过（工作目录、规则文件链、删除红线、一字不差回传），daemon 模式回传验收通过。过程沉淀三个解决方案：终端半块字符二维码渲染变形扫不出，转 BMP/PNG 图片扫码解决；后台任务孤儿进程与用户新进程双消费同一账号造成重复回复，`taskkill` 清理整棵进程树解决；确认进程存活须用 `tasklist`/`wmic` 而非 Git Bash `ps`（后者看不到完整命令行）。
- 2026-08-18：定时任务试点上线并通过双路验证——任务计划程序 + wrapper + `wechat-acp inject --file` 链路，2 个读取型任务（全资产日报 08:10、工作日午报 12:30，均工作日）。手动 `schtasks /run` 与 08:10 自然触发（2867 字符报告投递）均端到端成功；wrapper 位于 `scripts/cron-tasks/windows/`（本地，不进 Git）。
- 2026-08-18：完成本机龙虾（QClaw）资产迁移——归档 `runtime-data/qclaw-archive/`（workspace/downloads/跟踪 JSON/flomo 四块，计数与字节级抽查一致，源零改动）；skill 注册 `.claude/skills/` 26 个（memex 因仓库规则排除）并新建数据 fork `runtime-data/skills-home/`（workspace 1485 + downloads 3299 + d-data 55 文件），三轮共 739 处路径改写（覆盖 1/2/4 反斜杠转义变体、SKILL.md 相对命令与 prose 数据引用），3 个一次性 cron 安装器标记 `.dormant`；冒烟测试 `wardrobe.js list` 正常且龙虾目录零写入。

## 进行中

- 将 OpenClaw（`~/.qclow/`）中的个人数据逐步迁移到本仓库 `personal/` 目录。

## 待办

- **skill 迁移遗留（2026-08-18 记录，散帅逐项处理）**：
  1. 凭据迁移（红线项，须散帅亲自操作）：email-fetch 的 IMAP 密码（原 `~/.qclaw/skills/imap-smtp-email/.env`，本机无此路径）、deepseek-balance 的 API Key（原 `~/.qclaw/openclaw.json`）、sync-weread 的微信读书 token（原 `~/.qclaw/skills/weread-skills/get-token.ps1`）；凭据迁到新位置后需同步修改 skill 脚本内的读取路径
  2. auto-backup skill 依赖龙虾网关（`localhost:19000` 的 qclaw-cos 上传代理），龙虾退役后失效，需改为直连 COS 或更换备份方案
  3. knowledge-base 夜间任务（kb-nightly）的腾讯文档更新走龙虾 MCP（`qclaw_tdoc_mcp_call`），同样依赖龙虾运行时
  4. memex skill 未注册（仓库 AGENTS.md 禁止 Agent 间接操作 Memex）；如需新 bot 使用 Memex 流程，须先设计合规接入方式
  - 附注：skills-home 数据与龙虾自 2026-08-18 起各自演化（龙虾退役时再统一归属）；历史日志文件（.md/.jsonl）中残留旧路径字样属纯记录，无执行风险
- 将本仓库作为 `wechat-acp --cwd` 的目标目录，分别验证 Codex 与 Claude Code 是否完整读取对应规则。
- 验证多轮上下文、取消、新会话、会话恢复和微信结果回传。
- 设计并验证 ACP 权限请求到微信人工确认的强制权限代理。
- **定时任务观察期**：2026-08-16 起观察各任务按调度自动触发是否正常（launchd 不补跑睡眠期间错过的任务）。

## 阻塞

- `wechat-acp` 当前自动批准 ACP Agent 的权限请求。根目录规则只能约束 Agent 行为，不能形成强制安全边界；该缺口解决前，不得把敏感操作描述为已受技术层二次确认保护。

## 最近验证

- 2026-08-18：定时任务自然触发验证——08:10 计划任务在调度器上下文自动执行，injection 入队、daemon 消费、Agent 产出 2867 字符资产报告并投递微信；skill 迁移冒烟测试——`wardrobe.js list` 从 skills-home 正常输出，测试期间 `D:\qclaw` 无任何文件写入。
- 2026-08-17：Win10 部署端到端验证通过——前提检查（Node 24.13.1 ≥ 22、Claude Code 2.1.177、适配器 0.69.0 与手册基线一致）；微信 4 条验收 + daemon 回传验收全部符合预期；`--hide-thoughts` 生效（微信端无思考转发，终端日志仍打印属正常设计）；单发单收确认无重复投递（此前"一条消息两条回复"实为手机端发出两条）。
- 2026-08-17：Win10 部署文档静态核验——Claude 官方文档确认原生支持 Windows 10 1809+；`wechat-acp@0.10.0` 官方发布包确认 `claude` preset 启动 `@agentclientprotocol/claude-agent-acp`；npm 元数据确认当前 Claude ACP 适配器要求 Node.js ≥ 22。未在 Win10 实机执行，实机结果仍待验收。
- 2026-08-16：解耦后回归验证——`brief.mjs`（指向共享 web-crawler）删除 qclaw 副本前后各跑一次均正常输出；热点新闻新 wrapper 投递成功（exit 0，injection 进入 done）；今早 09:00 智谱用量任务由 launchd 按调度自动触发并投递，调度链路无需人工干预。
- 2026-08-16：second-brain 迁移完整性验证通过——24 个源文件与 `personal/` 合并结果逐个 `diff -q` 全部一致后，才执行 `rm -rf` 删除源目录；`personal/` 现有 26 个条目文件（含此前独有的 memory-bureau、shaolin-soccer、stormzhang-ai-daily）加 1 个模板。
- 2026-08-15：定时任务全链路验证通过——`launchctl start` 逐个触发 4 个任务（热点新闻、星球简报、AI 日报、智谱用量），全部 exit code 0；injection 队列 done 6 / failed 0，daemon 消费正常。期间发现并修复 launchd 无用户 PATH 导致 `env: node: No such file or directory` 的问题（wrapper 内显式 export nvm bin）。
- 2026-08-15：盘点 `~/.qclaw/` 定时任务，记录落在 Git 忽略的 `runtime-data/qclaw-cron-jobs.md`（本地参考，不进 Git）；4 个启用任务（热点新闻、星球简报、AI 日报、智谱用量）经微信投递，调度疑似自 2026-08-13 上午停摆，根因未排查。
- 2026-08-15：确认旧版 `main` 基线为 `fecd4db`，当前 9 个未提交进度文件已提交到归档分支，提交为 `183f9e4`。
- 2026-08-15：完成根目录规则重写；删除旧源码、测试、依赖清单和过时架构／运维文档；移除可重新生成的 `dist/` 与 `node_modules/`。确认 `runtime-data/` 和 `.claude/settings.local.json` 保留，`git diff --check` 通过。
- 2026-08-15：发现 QClow `second-brain/items/` 中有个人待做事项（待看电影、旅行目的地），明确本仓库应承担此功能。
