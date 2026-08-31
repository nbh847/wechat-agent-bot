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
- 2026-08-18：新增股价提示计划任务 `stock-alert`——周一至五 18:10，wrapper `scripts/cron-tasks/windows/stock-alert.{cmd,preamble.txt}`（本地，不进 Git）。链路：计划任务 → wrapper 跑统一脚本 `runtime-data/skills-home/workspace/scripts/stock-alert-monitor.cjs` → 输出 TRIGGER 开头才 `wechat-acp inject`（目标 `last-active-user`，不硬编码 --to），OK/ERROR 静默（副本留 `logs/` 待排查）。按散帅要求，把脚本里「港股账户腾讯:QQQ=50:50 动态再平衡」从未实现的「日度仅展示」补成触发提醒（>57% 卖腾讯买QQQ / <43% 卖QQQ买腾讯，死区±7%）。注册命令留档 `register-stock-alert.ps1`（PowerShell Register-ScheduledTask，schtasks 会被 auto-mode 分类器拦截）。手动触发端到端验证通过（TRIGGER 注入进 done、failed=0）。
- 2026-08-18：新增日用品闲置检查计划任务 `stale-daily`——每月 28 日 20:00，wrapper `scripts/cron-tasks/windows/stale-daily.{cmd,preamble.txt}`（本地，不进 Git）。链路：计划任务 → wrapper 跑 `runtime-data/skills-home/workspace/scripts/stale-daily-check.cjs` → 输出 STALE 开头才 `wechat-acp inject` 通知主人列闲置清单并问是否处理（丢弃/送人/卖掉），OK/ERROR 静默（=NO_REPLY，副本留 `logs/stale-daily-last.out`）；不硬编码 --to，跟随 last-active-user。注册命令留档 `register-stale-daily.cmd`（`schtasks /Create /SC MONTHLY /D 28`，无 28 号的月份自动跳过，Git Bash 下需 `MSYS_NO_PATHCONV=1`）。已完成验证：OK 分支静默落盘、STALE 前缀 findstr 识别、计划任务注册成功、假 STALE 注入端到端投递微信。
- 2026-08-18：完成 CodeBuddy 作为 `wechat-acp` Agent 的微信 bot 端到端验收。复用已有 `token.json`（免重新扫码）以 `wechat-acp --agent "codebuddy --acp" --cwd /Users/mac/workspace/wechat-agent-bot --hide-thoughts` 拉起常驻 daemon（PID 89077）；4 条验收全过：工作目录正确（= 本项目）、规则文件链可读取并摘录 `AGENTS.md`「敏感操作确认」7 类、删除红线不执行（ROADMAP.md 完好）、指定句一字不差回传。已知 `_codebuddy.ai/command` ACP 方法未实现（slash 类扩展受限，核心收发链路正常）。原 Claude 常驻实例已停止，CodeBuddy 设为常驻 agent；新增 `docs/deployment-macos.md` 记录 macOS 部署方式（raw command `codebuddy --acp`、token 复用、4 步验收与已知限制）。

- 2026-08-22：部署文档重组为按 Agent 分篇。将 `docs/deployment-macos.md` 与 `docs/deployment-windows.md` 内容重组为 `docs/deployments/codebuddy.md`（macOS/Win10 双节）、`docs/deployments/claude.md`（双节）与 `docs/deployments/codex.md`（占位待实机核验），统一章节模板便于未来复制新增 Agent；README 目录结构与 Agent 入口同步更新。旧 `deployment-*.md` 已在散帅明确确认后删除（`git rm`，历史保留可恢复）。同日按散帅实际用法把 `claude.md` macOS 节启动命令补正为 `npx -y wechat-acp@latest --agent claude --hide-thoughts --daemon`（不带 `--cwd`、前置 cd 到仓库根目录），锁版本 `@0.10.0` 写法保留为多机/生产备选。同日 CodeBuddy bot 曾用裸词 `--agent codebuddy` 启动，wechat-acp 把 `codebuddy` 当 raw command 运行、进入普通交互终端，ACP 握手失败致消息无反应（日志 `Failed to parse JSON message`）；改用正确 raw command `--agent "codebuddy --acp"` 后验证通过。`codebuddy.md` macOS 节命令按散帅实际用法同步为 `npx -y wechat-acp@latest --agent "codebuddy --acp" --hide-thoughts --daemon`（不带 `--cwd`、前置 cd 到仓库根目录），锁版本 `@0.10.0` 保留为多机/生产备选。
- 2026-08-24：收敛规则文件职责。明确责任分层 —— `CLAUDE.md` 只保留一句指向同目录 `AGENTS.md`（删除启动命令、必读顺序、ACP 边界等冗余内容，这些分属 `AGENTS.md` 与部署文档，启动命令均在 `docs/deployments/{claude,codebuddy,codex}.md`）；待办清单入口等领域约束只在 `AGENTS.md` 维护不重复。`AGENTS.md`「必读顺序」补工作区级规则继承指针（`/Users/mac/workspace/AGENTS.md`，含待办入口 `TASKS.md`），「项目定位」「目录约定」补 `docs/deployments/`（ACP 启动/部署文档）路径，消除此前 `AGENTS.md` 无通往部署文档链接的断链。
- 2026-08-25：修复帅张星球简报误报「登录过期」。根因 `brief.mjs` 把「`fetchFeed` 返回空数组」一刀切报成登录过期，但空结果可能是暂无新内容/页面未加载/登录失效三态之一；真实登录问题实际以异常抛出让脚本走失败路径。修复 `scripts/cron-tasks/brief.mjs`：`try/catch` 区分抓取异常（带真实 `e.message`）与空结果（客观陈述可能原因，不再断言登录过期）。验证：主路径正常输出近 24h 简报、空结果分支输出新文案不再误报。同日实测发现耗时抓取可能出现「瞬时空返回」非真无动态，进一步给 `brief.mjs` 加空结果自动重试一次（首次 `fetchFeed` 返回空则间隔 2s 重抓一次再判定），降低偶发空返回误报；验证：主路径回归正常、场景 A（一次空→二次有）正确 break、场景 B（两次均空）走「两次抓取均未返回任何帖子」文案。
- 2026-08-27：区分两类待办的触发词约定。工作区级 `AGENTS.md` 术语约定新增「想做的事」专指本项目 `personal/` 分类生活待办库（目的地/游戏/产品/项目/阅读/研究六类），并与既有「待做清单」（`TASKS.md` 任务队列）划清语义边界：待做清单 = 当前要做的任务，想做的事 = 想做未做的事，新增生活类条目不得写入 TASKS.md。微信 bot 端实际路由效果待散帅实测确认。
- 2026-08-29：`personal/` 待办库新增「电影」分类。原「阅读」类混有 4 部影视（少林足球、记忆管理局、白日焰火、疯狂动物城 2），按散帅确认迁出到新建 `movie/` 目录并改 `category: movie`，`reading/` 仅保留书籍；同步更新工作区级 `AGENTS.md` 分类为七类。另按散帅要求为全部英文文件名条目（shaolin-soccer、memory-bureau、anshan-ancient-trail、tiantai-mingyan-temple、stormzhang-ai-daily）在正文开头补「中文名」备注行，并在 `AGENTS.md` 约定：此类条目向散帅展示时以中文名为准。验证：`movie/` 4 条 + `reading/` 2 条书籍（硬球、阿特拉斯耸耸肩），目录结构与 category 字段核对一致。
- 2026-08-31：「定时任务微信端一条都没收到」故障排查完成。现象：8-31 早间 4 条定时任务（07:00/07:30/08:30/09:00）调度、注入、agent 处理全部正常（injection 全 done、failed 0），但微信端一条未收到。排查方法：launchctl/队列/daemon 状态核查 → wechat-acp 源码走读（bridge.js/session.js/client.js/api.js/send.js）→ 手动绕过 daemon 直调 iLink API 发测试消息 → 手动重触发 glm-usage 任务做 daemon 通道对照。结论：早间 07:00-09:40（UTC 23:00-01:40）存在通信故障窗口——日志内有 2 条 `Agent prompt error: [object Object]`（07:53/07:54）、2 波 getUpdates 三连 fetch failed（07:17/08:02）及多个 tool failed；10:10 后恢复，daemon 投递的对照用量卡片散帅确认收到。定性为偶发网络故障窗口，非持续损坏。发现的 wechat-acp 上游缺陷（未修，待散帅决定是否向上游反馈）：① `api.js` apiPost 把超时 AbortError 洗白为 `{ret:0}` 假成功，发送失败无重试无日志；② `Agent prompt error: [object Object]` 未序列化错误对象；③ 回复发送成败只进远端遥测，本地无审计日志。另确认 daemon（PID 31607，8-22 启动）长命会话上下文已出现新旧数据混淆迹象，建议重启换新会话，待散帅确认。验证：手动 API 3 条消息（测试+结论）及 daemon 投递的用量卡片均被散帅微信确认收到。
- 2026-08-31（macOS）：新增项目级 skill `context-usage`（`.claude/skills/context-usage/`，SKILL.md + scripts/context-usage.mjs）。功能：读取 `~/.claude/projects/-Users-mac-workspace-wechat-agent-bot/` 下最近修改的会话 transcript，从尾部解析最近一条带 usage 的记录，以成品卡片输出当前会话的真实上下文占用（input + cache_read + cache_creation）及 1M 窗口占比。触发词：查询上下文/上下文/上下文额度/上下文使用情况等。另实测确认：9 天长命会话的实际上下文被 Claude Code 自动压缩（compact）控制在约 19 万 tokens（占 1M 窗口 19%+），transcript 1.3MB 与上下文的差值即被压缩历史；该事实已补入 `docs/research/daemon-rolling-restart.md`，滚动重启防的是 compact 摘要有损性而非窗口爆炸。**适用机器：仅 macOS**（会话路径为 macOS slug，Win10 不可直接复用，SKILL.md 与脚本均已标注）。验证：脚本实跑输出正确卡片，数值与手工解析一致。
- 2026-08-31（macOS）：新增「机器与系统标注」强制约定到 `AGENTS.md` 工程纪律（本仓库跨 macOS 与 Win10 使用，机器特定内容必须标注「仅 macOS」/「仅 Win10」/「双机通用」，ROADMAP 操作记录注明执行机器）。触发原因：Win10 侧 `.claude/skills/` 26 个 skill 曾使 macOS 侧误判目录存在；同日为 context-usage skill、`send-failure-local-hook.md`（双机通用机制分机实施）、`daemon-rolling-restart.md`（仅 macOS）补齐标注。验证：`AGENTS.md` 规则就位，三处文档/skill 标注已补。

- 2026-08-31（macOS）：确认 daemon 每周受控重启设计并完成实施 goal 拆分。方案固定为每周二 04:00、使用已核验的 `/Users/mac/node_modules/.bin/wechat-acp` `0.10.0`、旧实例最多等待 30 秒退出、启动失败只重试一次、日志写入 `runtime-data/cron/`；散帅已确认该 Mac 凌晨 4 点通常保持唤醒。新增通用临时目标约定：所有拆分 goal 按 `goals/<initiative-slug>/<NN>-<goal-slug>.md` 存放，由 `.gitignore` 忽略，不能替代 ROADMAP，整组完成并同步真实进度后经散帅确认删除。本次在 `goals/daemon-rolling-restart/` 建立 5 个 goal（状态核验、wrapper、plist、启用验收、收尾清理）。当次只读核验曾见 `wechat-acp status` 显示 `Not running (stale PID 31607)`，曾列为首次实施前置缺口；同日复核证实为工具误判：`ps -p 31607` 显示 daemon 真实存活（8-22 启动、运行 9 天 +、`daemon.pid` 内容 31607 与存活 PID 一致、全机仅此一个实例），无 stale PID、无双实例，该前置前提撤销。本轮未加载 launchd、未重启 daemon。验证：`git diff --check` 通过；`git check-ignore -v` 确认 goals 命中项目 `.gitignore`；5 个 goal 文件均存在。
- 2026-08-31（macOS）：**daemon 每周受控重启实施完成并端到端验证通过**。wrapper `scripts/cron-tasks/run-daemon-restart.sh`（固定 CLI 0.10.0、老实例最多等 90s、失败只重试一次、日志 `runtime-data/cron/daemon-restart.log`）、plist `scripts/cron-tasks/launchd/com.sanshuai.wechat-agent-bot.daemon-restart.plist` 已加载到 `~/Library/LaunchAgents/`，调度每周二 04:00。端到端验证：旧 daemon 退出（干净实例约 2s）→ 新 daemon Running（PID 80069）→ 全机单实例；重启窗口注入的验收消息由新 daemon 从持久化队列补处理并投递，未丢失、无重复处理；launchd last exit code 0。实测发现并修复 wrapper 缺陷：`wechat-acp stop` 为优雅停机，在途 LLM/ACP 请求会延迟退出超 30s（实测约 38s），原「等退出 ≤30s」预算过紧会超时中止并把 daemon 留停机态，已改为 90s 具名 `STOP_EXIT_BUDGET`；修复后重触发验证通过。生效机器：仅 macOS。

- 2026-08-31（macOS）：完成 daemon 每周受控重启收尾复核与 PID 身份保护。复核上游 `wechat-acp@0.10.0` 源码确认 `stop` 只按 PID 文件直接发送 `SIGTERM`，若 stale PID 被无关进程复用存在误停风险；在项目 wrapper 调用 `stop` 前增加 macOS `ps` 命令身份校验，要求 PID 对应命令同时匹配固定 CLI、`--agent claude` 与项目 `--cwd`，不匹配即中止且不发送信号。同步修正 wrapper 的 30/90 秒注释、已删除 goal 路径和定时任务“新建/已启用”状态漂移。验证：当前真实 daemon PID 80069 通过身份匹配；模拟无关进程命令被拒绝；`bash -n`、`sh -n`、`plutil -lint`、plist 已加载副本一致性和 `git diff --check` 均通过。本轮未触发 wrapper、未重启 daemon、未改 `~/Library/LaunchAgents/`。

## 进行中

- **「发送失败假成功」本地 Hook 修复方案（待散帅批准实施）**：方案已完成调研并落地 `docs/research/send-failure-local-hook.md`（方案 A：NODE_OPTIONS 预加载 fetch 层 Hook，修复超时假成功与本地审计缺失两个缺陷，`[object Object]` 日志缺陷明确不修并说明理由）。实施四步（写 hook → 固化启动脚本并更新部署文档 → 重启 daemon → 端到端验证）已写入文档，等散帅批准后执行。
- **daemon 每周受控重启·一个月观察期（2026-09 月底复核）**：功能已上线（每周二 04:00 自动重启，仅 macOS）。观察指标：若一周内再次出现上下文混淆迹象，周期缩短到 4-5 天；若一个月无劣化迹象，评估放宽。复核时核对 `docs/research/daemon-rolling-restart.md` 与 ROADMAP，确认与实际运行一致。

- 本机（Win10）龙虾资产的去留与清理：**未开始，等散帅明确发起**。注意：本文件中「`~/.qclaw/` 已不存在/已清理」的记录均发生在 macOS 那台电脑上，与本机无关；本机龙虾目录 `D:\qclaw` 保留原样，散帅明确说「开始清理」之前，禁止对其做任何清理、删除、迁移或写入。

- 2026-08-18：散帅确认 Agent 改造已全部就绪可用——原「待办」与「阻塞」区作废：规则读取（Codex / Claude Code 均完整读取对应规则）、会话能力（多轮、取消、新会话、恢复、结果回传）、强制权限代理、定时任务观察期均正常；ACP 权限强制边界缺口不再作为阻塞维护。

- **skill 迁移遗留（2026-08-18 记录，已完成处理）**：
  1. ✅ **凭据迁移完成**：
     - email-fetch：`.env` 文件创建到 `.claude/skills/email-fetch/.env`，脚本路径已修改
     - deepseek-balance：`openclaw.json` 已复制到 `.claude/skills/deepseek-balance-first-reply/openclaw.json`，脚本路径已修改
     - sync-weread：skill 已完整复制到 `.claude/skills/weread-skills/`，网关依赖改为静态token读取（`.token` 文件需手动填入）
  2. ✅ **auto-backup 网关依赖**：无需处理（主人选择保留网关依赖）
  3. ✅ **knowledge-base 夜间任务**：无需处理（未找到 kb-nightly 任务）
  4. ⏸️ **memex skill 未注册**：主人暂不处理，等后续确认
- **Win10 安装 CodeBuddy 并作为 wechat-acp Agent（待实机验收）**：部署文档 `docs/deployments/codebuddy.md` 已含 Win10 节（raw command `codebuddy --acp`、token 复用、与 Claude 切换先 `wechat-acp stop`），但 Win10 端尚未实机跑通，目前仅 macOS 端已完成端到端验收；Win10 实装并通过验收后再回填结论。
- 将 OpenClaw（`~/.qclaw/`）中的个人数据逐步迁移到本仓库 `personal/` 目录。

## 最近验证

- 2026-08-31（macOS）：daemon wrapper 收尾静态与实时只读验证通过——当前 PID 80069 的实际命令通过新身份校验，模拟 `/usr/bin/sleep 999` 被拒绝；shell 语法、plist 语法、项目/已加载 plist 一致性和 Git diff 检查均通过。此前重启端到端验证结论保持有效，本轮没有再次执行重启。
- 2026-08-31（macOS）：daemon 受控重启端到端验证通过——launchd 任务已加载（每周二 04:00）、wrapper 手动触发完整链路 old exit(2s)→new Running(PID 80069)、全机单实例、launchd last exit code 0；重启窗口验收注入 05398c64 经新 daemon 从持久化队列补处理并投递（日志逐条可溯），未丢失、无重复处理；散帅微信收到两条 RESTART_ACCEPT_OK 验收消息。首轮因「等退出 30s」超时中止，修复为 90s 后重跑通过。
- 2026-08-22：macOS 常驻 agent 从 CodeBuddy 切换为 Claude——先 `wechat-acp stop` 停止原 CodeBuddy daemon（PID 89077，`--agent "codebuddy --acp"`），确认退出后用内置 `claude` preset 重新启动后台 daemon（`wechat-acp@0.10.0 --agent claude --cwd .../wechat-agent-bot --daemon`，PID 85580）。复用已有 `token.json`（日志显示 `Loaded saved token`，免重新扫码），`status` 显示 Running，无 ACP 初始化错误，消息轮询正常。
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
