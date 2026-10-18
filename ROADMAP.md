# WeChat Agent Bot Workspace Roadmap

## 当前阶段

项目正在从自研微信 Bot 实现切换为 `wechat-acp` 的受控 Agent 工作区，**同时作为火球的个人 AI 助手工作区**，逐步替代 OpenClaw（`~/.qclaw/`）的功能。

## 已完成

- 2026-10-18 17:26（Win10）：按火球要求将 Google Calendar 关联到 Codex。安装官方 `google-calendar@openai-curated-remote` `1.2.7`，由火球本人完成 Google OAuth；全局 Codex CLI `0.163.0` 与微信 Bot 固定 Codex CLI `0.160.1` 均通过临时只读会话调用 `google_calendar.list_calendars`。随后按授权重启 Bot：旧 PID `17364` 的项目进程树完整退出，新 PID `19636` 通过固定入口运行，登录复用与微信轮询恢复。未创建、修改或删除事件，未输出日程正文；微信端自然语言调用与实收未单独验收。

- 2026-10-18 14:18（Win10）：按火球要求，修订 Win10 poop-log Skill 与项目触发规则：报告真实排便时即使夹带腹泻咨询也先记录；次数不明不猜测，腹泻文字本身不推断便形。将本次明确提到的事件写入本机忽略数据文件，未复制个人记录内容到文档。

- 2026-10-18 13:52（Win10）：按火球要求，将项目 Markdown 文档中的用户称呼统一改为「火球」，覆盖 `AGENTS.md`、`README.md`、`ROADMAP.md` 和 `docs/deployments/` 中的 4 篇文档。

- 2026-10-17 23:05（双机通用文档；功能清点在 Win10）：新增 `docs/project-index.md`，汇总项目架构、33 个当前 Win10 可见 Skill、Win10 定时任务入口、个人清单规则、触发关键词、术语和资料路径；标注机器差异与本机数据边界。README 与 AGENTS 增加索引入口和维护规则。验证：33 个 Skill 和 33 个任务脚本入口均已覆盖，64 个 Markdown 本地链接目标存在，索引无尾随空格，`git diff --check` 通过。

- 2026-10-17 21:58（双机通用）：按用户要求，将「收到任务先检索匹配 Skill，命中后阅读并遵循流程」写入项目规则源 `AGENTS.md`，适用于各类任务。验证：规则已写入，`git diff --check` 通过。

- 2026-10-17 21:33（Win10）：完成本机 Codex 微信 Bot 接入与后台启动。项目内固定安装 `wechat-acp@0.10.0`、`@agentclientprotocol/codex-acp@2.2.2`，使用 raw command 避开已弃用 preset；专用入口固定 `gpt-6-luna`、`model_reasoning_effort=max`、`workspace-write` 和 `--hide-thoughts`，并校验依赖版本与配置，不修改全局 Codex 设置。真实模型请求成功，daemon 单实例运行并开始微信轮询；微信实收和实际 Bot 会话专项验收仍在进行中，未配置开机自启。

- 2026-10-17 15:52（新 Mac／macOS）：按火球要求固化个人意向清单的触发与归档规则：明确的待看／想看归影视清单，待读／想读归书目清单，待玩／想玩归游戏清单；按内容类型优先判断，普通一次性行动事项仍沿用工作区级待办队列。已同步 AGENTS 与 README；未新增目录或自动跨机同步规则。验证：规则与 README 目录索引一致，`git diff --check` 通过。

- 2026-10-17 15:45（新 Mac／macOS）：按火球要求将本机个人影视待看清单统一收纳到 `personal/watchlist/`，并在 README 同步目录索引、用途、命名和完成后保留规则；空的 `personal/movie/` 已移除。本机新增一条含两季信息的纪录片记录，个人内容不进 Git，Win10 未同步。验证：索引与实际路径一致，旧目录不存在，新条目存在且被 Git 忽略，`git diff --check` 通过。

- 2026-10-17 09:31（新 Mac／macOS）：按火球要求将微信 Bot 推理强度由 `medium` 提升至 `max`，模型保持 `gpt-6-luna`；专用配置、验证脚本和本地指纹同步。隔离 ACP 会话实际返回 `gpt-6-luna[max]`，真实模型响应通过。随后停止旧 Codex Bot 及所属子进程，以固定入口重新启动并确认单实例、登录复用和微信轮询正常；全局 Codex 默认设置未变，本轮重启后的微信实收未另行验证。

- 2026-10-17 09:03（新 Mac／macOS）：`manage-codex-usage` Skill 已在 Mac 跑通，火球明确确认本机验收通过。源码位于被忽略的 `personal/skills/manage-codex-usage/`，Codex／Claude 的项目 Skill 目录以软链接引用；使用项目固定 Codex CLI 只读 `account/rateLimits/read`，输出各额度桶窗口的剩余／已用比例、进度条及北京时间重置时间。无新增运行依赖，不直接读取凭据、不发送模型提示或新增定时推送；真实额度查询与 Codex 项目 Skill 发现通过。微信端卡片实收仍待验证，Win10 未适配，不沿用 Mac 结论。

- 2026-10-17 08:47（双机通用／项目权限）：火球明确授权本项目操作 Memex 知识库，并确认「入库」即指 Memex 入库。项目规则已记录授权边界与 SOP 入口；每次实际入库仍须按 `docs/operations/ingestion-sop.md` 判定 manual／auto／batch 并执行对应流程。本条仅记录权限和流程约定，不代表本次执行了 Memex 写入。

- 2026-10-17 08:29（新 Mac／macOS）：完成 Codex 本地接入与后台切换。项目内固定 `@agentclientprotocol/codex-acp@2.2.2`／Codex CLI `0.160.1`，Bot 专用配置为 `gpt-6-luna`、`medium`，未修改全局 Codex 默认配置。复用现有微信发送修复构建，新增独立启动入口、配置与指纹；旧 Claude Bot 及其子进程退出后切换为单实例 Codex Bot。模型响应、轮询启动与微信端实收验收通过；实际 Bot 会话工作目录／规则读取与安全边界专项验收仍在进行中，见 [部署说明](/Users/mac/workspace/wechat-agent-bot/docs/deployments/codex.md) 。

- 2026-10-17 08:47（新 Mac／macOS）：Codex 微信实收验收通过。依据为火球明确确认「Codex 微信验收通过」；实际 Bot 会话工作目录／规则读取与安全边界专项验收不包含在本项内，Win10 未验证。

- 2026-10-03 12:38（新 Mac／macOS）：火球确认收到新样式推送并要求长期沿用；按火球要求简化智谱额度模板，移除装饰图标，按火球随后反馈加入独立一行 10 格剩余额度进度条（实心 `▓`／空格 `░`），剩余／已用合并展示，保留套餐、北京时间和完整重置时间；手动查询与每日任务共用新渲染，固定模板文档同步。

- 2026-10-02 21:11（新 Mac／macOS）：按火球要求取消热点新闻每日 07:00 任务，删除本机 hot-news 源 plist，并从当前任务清单和恢复计划移除；历史记录保留，其余定时任务及 Bot 未修改。

- 2026-10-02 20:57（新 Mac／macOS）：按火球确认，将智谱额度卡片固化为 [模板文档](/Users/mac/workspace/wechat-agent-bot/docs/deployments/glm-usage-template.md) ，统一约定手动查询、每日推送与转发均由同一脚本渲染，未经明确要求不改版；AGENTS、README、Skill 与任务清单统一引用该文档。模板文档保存在 Git 可跟踪路径，避免只存在于本机忽略目录。

- 2026-10-02 20:56（新 Mac／macOS）：智谱额度卡片模板更新为套餐与北京时间表头、5 小时／每周／MCP 月度三个区块、10 格剩余额度进度条、精确已用／剩余比例及重置时间。手动查询和每日任务共用模板，未追加微信推送。

- 2026-10-02 20:51（新 Mac／macOS）：智谱每日额度任务的查询与调度恢复。项目级 glm-stats、隐藏 Key 录入入口、一次性额度查询和注入包装就绪；真实官方查询通过，用户凭据仅项目本地保存（600）；LaunchAgent `com.sanshuai.wechat-agent-bot.glm-usage` 已加载，北京时间每天 09:00。微信发送与自然触发验收仍在进行中，不将加载等同于消息到达。

- 2026-10-02 20:36（新 Mac／macOS）：微信 Bot 基础收发链路验收通过。火球在微信发送消息并确认收到 Bot 回传；结合已完成的本机构建、ACP 会话创建与后台轮询验证，新 Mac 基础部署完成。工作目录、规则读取与安全边界的专项消息验收未另行确认；旧定时任务未迁移，无开机自启。

- 2026-10-02 20:34（新 Mac／macOS）：项目内构建与启动入口重建并验证。固定上游 `4b787a5`／`0.10.0`，重新实现端点级超时、发送响应校验及基础脱敏审计；安装项目内 Claude ACP `0.85.1`，固定本地入口；启动脚本校验构建指纹与已有 Bot 进程。旧 Mac 完整本地补丁未随 Git 保存，本次不宣称恢复全部历史行为。未迁移定时任务或启用开机自启。


## 进行中

- **2026-10-17 16:02（新 Mac／macOS）每日打卡提醒（每天 08:00）**：JSON 清单、Python 脚本和 LaunchAgent 已安装并加载，`launchctl print` 确认 `gui/501` 服务与 08:00 触发；`runs=0`，未在加载时立即发送。清单含「完成拼多多点亮任务」，后续增删改只需编辑 `personal/daily-reminders.json`。首次微信实收待首次自然调度确认；iLink 无人值守限制仍可能导致队列入库后未送达。

- **2026-10-17（新 Mac／macOS）Codex 额度查询的微信端实收**：Skill 已安装、启用并完成真实只读查询与 12 项回归；待从微信发送「查询 Codex 剩余额度」，确认 Bot 调用并返回额度卡片。未发送主动测试微信；Win10 未适配。

- **2026-10-17（macOS／Win10）Codex Bot 专项验收**：macOS 的基础微信实收已通过；Win10 的固定依赖、真实模型请求、后台启动和轮询已通过，微信实收待火球从微信发消息确认。两机实际 Bot 会话的工作目录／项目规则读取与安全边界专项消息仍待验收；均未启用开机自启，未迁移 Claude 会话历史。

- **2026-10-02 20:51（新 Mac／macOS）定时任务逐项恢复，当前先做智谱额度**：glm-stats Skill 与定时包装已重建，4 组隔离测试和包装失败不注入检查通过，Skill 官方校验器通过；火球本机录入 Key 后，真实额度查询成功（Lite、5 小时／每周／MCP 月度额度与重置时间），凭据权限 600。北京时间每天 09:00 的 LaunchAgent 已加载，源／运行 plist 一致、脚本存在。20:54 火球明确授权后手动触发一次，launchd runs=1／exit 0，发送审计新增一条 success、无失败；2026-10-03 新模板即时推送已获火球手机端实收确认；首次自然调度未观察。热点新闻每日 07:00 任务已于 21:11 按火球要求取消并删除源 plist；剩余星球简报、AI 日报和 Bot 每周重启暂缓，未加载。

- **定时推送可靠通道决策（2026-09-10 起待办，等火球决策）**：`wechat-acp` 主动推送依赖最近一次微信入站消息的 `contextToken`。2026-09-11 复核确认当前腾讯公开协议与客户端没有独立主动推送凭据或续期接口；公开实测报告存在约 24 小时窗口和单令牌约 10 条出站额度，但不是官方 SLA。本机探针只证实 09:00 成功、10:00 起 `ret=-2`，尚不能最终区分额度耗尽与窗口失效。当前 iLink 只适合低频、近期有入站消息时的尽力推送；根治方向改为交互继续走 iLink，无人值守通知另选具备独立发送凭据的通道，具体选型与实施待火球确认。
- **daemon 每周受控重启·一个月观察期（2026-09 月底复核）**：功能已上线（每周二 04:00 自动重启，仅 macOS）。观察指标：若一周内再次出现上下文混淆迹象，周期缩短到 4-5 天；若一个月无劣化迹象，评估放宽。复核时核对 `docs/research/daemon-rolling-restart.md` 与 ROADMAP，确认与实际运行一致。
- **本机（Win10）龙虾资产的去留与清理（未开始，等火球明确发起）**：注意本文件中「`~/.qclaw/` 已不存在/已清理」均发生在 macOS 那台电脑上；本机龙虾目录 `D:\qclaw` 保留原样，火球明确说「开始清理」之前，禁止对其做任何清理、删除、迁移或写入。
- **Win10 安装 CodeBuddy 并作为 wechat-acp Agent（待实机验收）**：部署文档 `docs/deployments/codebuddy.md` 已含 Win10 节（raw command `codebuddy --acp`、token 复用、与 Claude 切换先 `wechat-acp stop`），但 Win10 端尚未实机跑通，目前仅 macOS 端已完成端到端验收；实装并通过验收后再回填结论。
- **OpenClaw（`~/.qclaw/`）个人数据迁移收尾**：macOS 侧 second-brain/QClaw 资产迁移已完成（见「已完成」），剩余待整理的残留或新增数据按要求逐步迁入 `personal/`，未明确发起前不擅自清理。

## 最近验证

- 2026-10-18 17:26（Win10）：`codex plugin list --available --json` 确认 Google Calendar `1.2.7` 已安装；全局 Codex CLI `0.163.0` 与项目固定 Codex CLI `0.160.1` 分别在 `read-only`、`ephemeral` 会话中成功完成 `codex_apps/google_calendar.list_calendars`，返回脱敏成功标记。Bot 重启前确认根 PID `17364` 及完整命令行，正常停止后项目进程树归零；固定入口启动 PID `19636`，状态为 Running，日志脱敏检查确认登录复用、轮询启动且无 Fatal。未调用日历写工具，未输出日程内容，未发送微信测试消息。

- 2026-10-18 14:18（Win10）：回读 Skill 确认已包含“咨询中报告实际事件先记录”、次数不清不猜测、腹泻不推断类型及仅 Win10 标注；本机记录 JSON 解析通过，新增条目返回成功（14:13、type=null）；项目规则检索命中，`git diff --check` 通过。

- 2026-10-18 13:52（Win10）：核对项目 Markdown 文档称呼更新：7 篇文档共替换 95 处，旧称全库检索无匹配，`git diff --check` 通过。ROADMAP 按规则保留最近 20 条完成记录与最近 20 条验证记录。

- 2026-10-18 13:35（Win10）：确认上一轮 Bot 未完成自我重启，日志仅有 `wechat-acp stop` 而无外部启动步骤，daemon 与 PID 文件均不存在；Dida365 MCP 配置本身正常，项目固定 Codex CLI 的临时只读会话成功初始化并发现 57 个工具，未调用工具或读取任务数据。随后按火球授权从外部固定入口启动 PID `17364`，核对本项目 `wechat-acp`、维护版 Codex ACP、工作目录与 `--hide-thoughts`，登录复用、微信轮询恢复且无新增 Fatal；专用模型仍为 `gpt-6-luna`／`max`。

- 2026-10-18 12:42（仅 Win10）：Dida365 MCP OAuth 接入与工具发现通过。用户级 Codex MCP 注册项显示 `enabled`，OAuth 登录成功；项目内固定 Codex CLI `0.160.1` 在临时 `gpt-6-luna`／只读会话中成功发现 Dida365 工具名称，未调用任务数据工具。Win10 Bot 专用配置已含同一服务地址；daemon 仍运行，本轮未重启，因此现存 ACP 会话即时加载授权状态未单独验收。`codex mcp list` 的 Auth 列显示 `Unknown`，但实际只读工具发现成功。

- 2026-10-18 12:01（Win10）：定位 Codex 微信 Bot 无法连接的根因为 Agent 在配置后自我重启时执行 `wechat-acp stop`，父 daemon 与当前 Codex app-server 同时退出，后续启动步骤无法继续并遗留 stale PID；不是微信网络或登录失败。确认旧 PID `15616` 不存在后，仅清理对应 PID 文件并通过固定入口重启为 PID `4704`。进程命令行确认本项目 `wechat-acp`、维护版 Codex ACP、项目工作目录与 `--hide-thoughts`，登录复用、微信轮询恢复且无新增 Fatal；模型专用配置仍为 `gpt-6-luna`／`max`。

- 2026-10-17 23:06（Win10）：项目功能索引核验，33 个本机可见 `SKILL.md` 与索引逐项匹配，33 个任务脚本入口均可检索，64 个 Markdown 本地链接目标存在，索引无尾随空格；README／AGENTS 导航已关联，`git diff --check` 通过。

- 2026-10-17 21:33（Win10）：项目内 `wechat-acp@0.10.0` 与 `@agentclientprotocol/codex-acp@2.2.2` 精确版本检查通过；PowerShell 启动脚本语法和 `gpt-6-luna`／`max` 专用配置通过。适配器自带 Codex CLI 的临时只读真实请求返回预期文本；daemon 状态为 Running，进程命令行包含本项目工作目录、维护版 Codex ACP raw command 与 `--hide-thoughts`，启动日志确认登录复用和轮询开始且无新增启动错误。本轮未发送微信测试消息。

- 2026-10-17 21:04（Win10）：清理 Git 工作区临时文件记录。删除可重新生成且未被 Git 跟踪的 `tmp_ma.py`、`tmp_ma.json`、`tmp_ma2.json`；将任务临时目录 `.tmp/` 加入 `.gitignore`，保留其中来源较早、用途不一的现有内容，不做整目录删除。验证：三个根目录临时文件均不存在，`.tmp/` 命中项目忽略规则且不再出现在 `git status`。

- 2026-10-17 19:07（新 Mac／macOS）：提交前核对个人清单触发与归档规则、README 目录约定和每日打卡提醒记录，文档本地链接与 git diff --check 通过；workspace 总览同步每日提醒的文档状态。此次仅提交现有可跟踪文档改动，不读取个人清单正文、不重新触发任务或复查服务在线状态；脚本、个人数据和运行配置仍按项目忽略规则保留本机。

- 2026-10-17 19:05（新 Mac／macOS）：火球确认在 16:30 收到每日打卡提醒；一次性任务于 16:30:01 执行成功并入队 1 项。临时 launchd label、安装 plist 和任务临时目录均已清理；正式每日 08:00 任务仍已加载、`runs=0`。

- 2026-10-17 16:10（新 Mac／macOS）：每日打卡提醒一次性任务按本机北京时间触发，读取当前 JSON 清单并成功入队 1 项（任务退出码 0）；微信实际送达未确认。临时 launchd label、安装 plist 和任务临时目录均已自动清理；正式每日 08:00 label 仍已加载、`runs=0`。

- 2026-10-17 16:02（新 Mac／macOS）：每日打卡提醒配置核验。Python 语法与 JSON 解析通过，源 plist `plutil -lint` 通过，安装副本与源文件一致；`launchctl print` 确认触发时间为本机北京时间每天 08:00、`runs=0`。未手动注入提醒，微信实际到达待首次自然运行确认。

- 2026-10-17 09:31（新 Mac／macOS）：`max` 配置的 ACP initialize／session/new 与真实提示响应通过，返回 `model=gpt-6-luna`、`reasoning_effort=max`、`mode=workspace-write`、`end_turn`。原 Codex PID `28593` 及 15 个后代进程完全退出后，新 PID `33846` 单实例运行，固定构建与配置指纹检查通过，微信登录复用和轮询启动标记存在，无新增 Fatal／过期／轮询错误。提交前文档与链接、Shell／Python 语法、git diff --check 通过；本轮未发送微信测试消息。

- 2026-10-17 09:03（新 Mac／macOS）：按火球要求实际调用 `manage-codex-usage`，08:59:29 成功返回 Plus、5 小时剩余 85%／已用 15%（重置 2026-10-17 13:19:56）、每周剩余 64%／已用 36%（重置 2026-10-22 21:25:11），均为北京时间且仅代表该查询时刻。火球明确确认 Skill 已在 Mac 跑通；本次确认不扩大到微信端卡片实收或 Win10。提交前核对文档、源码忽略边界与现有 12 项测试／Skill 校验证据，未重复查询额度或重启 Bot。

- 2026-10-17 08:55（新 Mac／macOS）：`manage-codex-usage` 的真实官方只读查询成功，08:54:33 返回 Plus、5 小时剩余 87%／每周剩余 64%及重置时间，仅代表该查询时刻。12 项测试覆盖 0%／100%、小数、北京时间、多桶、缺失与非法字段、响应通知、错误脱敏、超时与子进程退出；全部通过。官方 Skill 校验器通过，`skills/list` 确认新 Skill enabled，源码与软链接均被 Git 忽略；git diff --check 通过。微信端自然语言调用和手机卡片实收未验证。

- 2026-10-17 08:47（新 Mac／macOS）：提交前核对 Codex 接入的 README、部署说明与路线图，文档链接和 git diff --check 通过；本次仅提交三份文档，scripts／runtime-data 按现有忽略规则保留本机，不包含依赖、凭据或运行数据。此前 10 项发送回归与模型响应、微信实收验收结论保持不变，本轮未重复请求模型或重启 Bot。

- 2026-10-17 08:34（新 Mac／macOS）：火球确认 Codex 微信验收通过，微信端实收验收完成。该确认不覆盖实际 Bot 会话的工作目录／规则读取与安全边界专项验收；Win10 未验证。

- 2026-10-17 08:29（新 Mac／macOS）：ACP initialize／session/new 与真实模型响应通过，返回 `model=gpt-6-luna`、`reasoning_effort=medium`、`mode=workspace-write`、`end_turn`。现有 Bot 存活时启动入口正确拒绝重复启动；Claude PID `88657` 及两个子进程退出后，Codex PID `28593` 单实例运行，配置／构建指纹通过，工作目录与隐藏思考参数正确，微信登录复用与轮询启动标记存在，无新增 Fatal／过期／轮询错误。发送故障与待取回相关 10 项测试通过，Shell／Python 语法检查通过；微信实收及专项场景未验证。

- 2026-10-05 17:56（新 Mac／macOS）：按火球要求通过固定本地入口启动 Claude 微信 Bot；构建指纹与单实例检查通过，daemon status 为 Running（PID 22596），系统进程核对仅一个 Node 微信 Bot 实例，带 `--hide-thoughts` 和本项目工作目录。未配置开机自启；本次微信实际回传尚未验证。
