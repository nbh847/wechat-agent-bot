# WeChat Agent Bot Workspace Roadmap

## 当前阶段

项目正在从自研微信 Bot 实现切换为 `wechat-acp` 的受控 Agent 工作区，**同时作为散帅的个人 AI 助手工作区**，逐步替代 OpenClaw（`~/.qclaw/`）的功能。

## 已完成

- 2026-10-17 15:52（新 Mac／macOS）：按散帅要求固化个人意向清单的触发与归档规则：明确的待看／想看归影视清单，待读／想读归书目清单，待玩／想玩归游戏清单；按内容类型优先判断，普通一次性行动事项仍沿用工作区级待办队列。已同步 AGENTS 与 README；未新增目录或自动跨机同步规则。验证：规则与 README 目录索引一致，`git diff --check` 通过。

- 2026-10-17 15:45（新 Mac／macOS）：按散帅要求将本机个人影视待看清单统一收纳到 `personal/watchlist/`，并在 README 同步目录索引、用途、命名和完成后保留规则；空的 `personal/movie/` 已移除。本机新增一条含两季信息的纪录片记录，个人内容不进 Git，Win10 未同步。验证：索引与实际路径一致，旧目录不存在，新条目存在且被 Git 忽略，`git diff --check` 通过。

- 2026-10-17 09:31（新 Mac／macOS）：按散帅要求将微信 Bot 推理强度由 `medium` 提升至 `max`，模型保持 `gpt-6-luna`；专用配置、验证脚本和本地指纹同步。隔离 ACP 会话实际返回 `gpt-6-luna[max]`，真实模型响应通过。随后停止旧 Codex Bot 及所属子进程，以固定入口重新启动并确认单实例、登录复用和微信轮询正常；全局 Codex 默认设置未变，本轮重启后的微信实收未另行验证。

- 2026-10-17 09:03（新 Mac／macOS）：`manage-codex-usage` Skill 已在 Mac 跑通，散帅明确确认本机验收通过。源码位于被忽略的 `personal/skills/manage-codex-usage/`，Codex／Claude 的项目 Skill 目录以软链接引用；使用项目固定 Codex CLI 只读 `account/rateLimits/read`，输出各额度桶窗口的剩余／已用比例、进度条及北京时间重置时间。无新增运行依赖，不直接读取凭据、不发送模型提示或新增定时推送；真实额度查询与 Codex 项目 Skill 发现通过。微信端卡片实收仍待验证，Win10 未适配，不沿用 Mac 结论。

- 2026-10-17 08:47（双机通用／项目权限）：散帅明确授权本项目操作 Memex 知识库，并确认「入库」即指 Memex 入库。项目规则已记录授权边界与 SOP 入口；每次实际入库仍须按 `docs/operations/ingestion-sop.md` 判定 manual／auto／batch 并执行对应流程。本条仅记录权限和流程约定，不代表本次执行了 Memex 写入。

- 2026-10-17 08:29（新 Mac／macOS）：完成 Codex 本地接入与后台切换。项目内固定 `@agentclientprotocol/codex-acp@2.2.2`／Codex CLI `0.160.1`，Bot 专用配置为 `gpt-6-luna`、`medium`，未修改全局 Codex 默认配置。复用现有微信发送修复构建，新增独立启动入口、配置与指纹；旧 Claude Bot 及其子进程退出后切换为单实例 Codex Bot。模型响应、轮询启动与微信端实收验收通过；实际 Bot 会话工作目录／规则读取与安全边界专项验收仍在进行中，见 [部署说明](/Users/mac/workspace/wechat-agent-bot/docs/deployments/codex.md) 。

- 2026-10-17 08:47（新 Mac／macOS）：Codex 微信实收验收通过。依据为散帅明确确认「Codex 微信验收通过」；实际 Bot 会话工作目录／规则读取与安全边界专项验收不包含在本项内，Win10 未验证。

- 2026-10-03 12:38（新 Mac／macOS）：散帅确认收到新样式推送并要求长期沿用；按散帅要求简化智谱额度模板，移除装饰图标，按散帅随后反馈加入独立一行 10 格剩余额度进度条（实心 `▓`／空格 `░`），剩余／已用合并展示，保留套餐、北京时间和完整重置时间；手动查询与每日任务共用新渲染，固定模板文档同步。

- 2026-10-02 21:11（新 Mac／macOS）：按散帅要求取消热点新闻每日 07:00 任务，删除本机 hot-news 源 plist，并从当前任务清单和恢复计划移除；历史记录保留，其余定时任务及 Bot 未修改。

- 2026-10-02 20:57（新 Mac／macOS）：按散帅确认，将智谱额度卡片固化为 [模板文档](/Users/mac/workspace/wechat-agent-bot/docs/deployments/glm-usage-template.md) ，统一约定手动查询、每日推送与转发均由同一脚本渲染，未经明确要求不改版；AGENTS、README、Skill 与任务清单统一引用该文档。模板文档保存在 Git 可跟踪路径，避免只存在于本机忽略目录。

- 2026-10-02 20:56（新 Mac／macOS）：智谱额度卡片模板更新为套餐与北京时间表头、5 小时／每周／MCP 月度三个区块、10 格剩余额度进度条、精确已用／剩余比例及重置时间。手动查询和每日任务共用模板，未追加微信推送。

- 2026-10-02 20:51（新 Mac／macOS）：智谱每日额度任务的查询与调度恢复。项目级 glm-stats、隐藏 Key 录入入口、一次性额度查询和注入包装就绪；真实官方查询通过，用户凭据仅项目本地保存（600）；LaunchAgent `com.sanshuai.wechat-agent-bot.glm-usage` 已加载，北京时间每天 09:00。微信发送与自然触发验收仍在进行中，不将加载等同于消息到达。

- 2026-10-02 20:36（新 Mac／macOS）：微信 Bot 基础收发链路验收通过。散帅在微信发送消息并确认收到 Bot 回传；结合已完成的本机构建、ACP 会话创建与后台轮询验证，新 Mac 基础部署完成。工作目录、规则读取与安全边界的专项消息验收未另行确认；旧定时任务未迁移，无开机自启。

- 2026-10-02 20:34（新 Mac／macOS）：项目内构建与启动入口重建并验证。固定上游 `4b787a5`／`0.10.0`，重新实现端点级超时、发送响应校验及基础脱敏审计；安装项目内 Claude ACP `0.85.1`，固定本地入口；启动脚本校验构建指纹与已有 Bot 进程。旧 Mac 完整本地补丁未随 Git 保存，本次不宣称恢复全部历史行为。未迁移定时任务或启用开机自启。

- 2026-09-12（macOS）：**下线并删除「22h 未活动提醒」定时任务**。卸载 `com.sanshuai.wechat-agent-bot.send-failure-alert`（launchd `StartInterval` 每小时），删除 `scripts/cron-tasks/launchd/` 下源 plist、`~/Library/LaunchAgents/` 下运行副本与 wrapper `run-send-failure-alert.sh`，并同步清理 `scripts/cron-tasks/README.md` 目录约定与任务清单。既有日志（`runtime-data/cron/send-failure-alert*.log/.state`）与 ROADMAP 历史记录保留用于追溯。其余 5 个定时任务与 daemon 未修改。
- 2026-09-11（仅 macOS）：**下线并删除临时 token 探针与微信链路心跳监控**。在主动推送原因完成定位后，卸载 `com.sanshuai.wechat-agent-bot.token-probe` 与 `com.sanshuai.wechat-agent-bot.wechat-heartbeat` 两个 launchd 任务，删除 `run-token-probe.sh`、`run-wechat-heartbeat.sh` 及对应 plist。前者不再产生 08:00 至 22:00 整点测试消息；后者不再每 15 分钟把持续 `ret=-2` 重复弹窗并误报为需重新登录。既有日志、状态文件与发送审计保留用于追溯，其他定时任务和 daemon 未修改。
- 2026-09-11（协议结论双机通用；探针证据仅 macOS）：**完成 iLink 主动推送限制复核并更新调研文档**。腾讯官方当前公开协议要求回复时回传入站 `context_token`，API 与客户端源码未提供独立主动推送凭据或续期接口；公开 issue 报告约 24 小时会话窗口和单令牌约 10 条出站额度，但属于实测线索而非官方 SLA。macOS 小时探针证实 09:00 仍有成功发送，10:00、11:00 均正常调度、正常消费 injection，却各 3 次被 HTTP 200 + `ret=-2` 拒绝；因此排除脚本停摆，并把判断从“固定时长过期”修正为“同一入站令牌的额度耗尽或窗口失效，前者为更强假设但尚未最终区分”。详细证据、来源和双通道建议见 `docs/research/wechat-access-options.md`。
- 2026-09-09（macOS）：**修复「22h 未活动提醒」数据源 + 新增微信链路心跳监控**。原 `run-send-failure-alert.sh` 误读已冻结的仓库 `runtime-data/conversations/state.json`（8-15 起 daemon 不再写入），导致算出永久休眠、提醒从不触发；改为读权威源 `~/.wechat-acp/state.json` 的 `users[*].lastSeenAt`。心跳 `run-wechat-heartbeat.sh`（launchd StartInterval 每 15 分钟，仅 macOS）双信号判定链路健康：主判据 `send-audit.jsonl` 最近 1h 有 `WeChatSendBusinessError/HttpError` 且无 `success` 抵消（`ret=-2` 记重度业务拒绝，不单独等同于 contextToken 过期）、辅判据 `wechat-acp.log` 新增段 `getUpdates error (3/3)` ≥2；轻度调受控重启、重度只告警催人工、无无限重试。背景：9-08 下午起微信 session 失效但 daemon 进程活着、定时任务照跑、send-audit 全绿的隐蔽断链。
- 2026-08-31（macOS）：**发送失败假成功根因修复（Goal 01—06）完成并端到端验收**。本地锁定官方提交 `4b787a5`（版本 `0.10.0`），在 API 责任层修复：端点级超时语义、可选 `ret` 响应校验、`sent/pending/unknown` 投递结果传播、bridge 单层三次同 `client_id` 重试、`/acp-more` 原序待取回、脱敏 JSONL 审计；逐字段核对腾讯官方参考实现 `@tencent-weixin/openclaw-weixin@2.4.6` 后证实成功响应允许缺省 `ret` 并在责任层修正。全量测试 235 项：234 通过、1 项 Windows 专属跳过、0 失败；TypeScript 构建与隔离验证通过；受控重启后微信只收到一次完全一致回复、审计仅新增一条 `attempt=1` 干净记录。
- 2026-08-31（macOS）：**daemon 每周受控重启上线并完成收尾**。每周二 04:00（仅 macOS），wrapper `scripts/cron-tasks/run-daemon-restart.sh` 固定 CLI `0.10.0`、旧实例最多等 90s（`STOP_EXIT_BUDGET`，实测优雅停机约 38s，原 30s 预算过紧已修正）、失败只重试一次；`stop` 前经 macOS `ps` 按 PID 校验命令匹配固定 CLI + `--agent claude` + 项目 `--cwd`，不匹配即中止不发送信号，防 stale PID 误停无关进程。通用临时目标约定：goal 按 `goals/<initiative-slug>/<NN>-<goal-slug>.md` 存放、被 `.gitignore` 忽略、整组完成并同步真实进度后经散帅确认删除。观察期见「进行中」。

## 进行中

- **2026-10-18（新 Mac／仅 macOS）星球简报**：抓取入口已切换为全局 `web-crawler` Skill 的知识星球 `feed` handler，并由 `start-edge-cdp.sh` 确保 CDP 可用；LaunchAgent 每天 12:00、18:00 汇总「帅张和他的朋友们」近 24 小时内 `stormzhang` 的发言。Skill 手动抓取已验证，首次自然调度及微信实际送达待观察；任务不在加载时立即发送。

- **2026-10-17（新 Mac／仅 macOS）每日打卡提醒（每天 06:00）**：JSON 清单、Python 脚本和 LaunchAgent 已安装并加载；2026-10-18 按散帅要求将时间从 08:00 调整为 06:00。清单含「完成拼多多点亮任务」，后续增删改只需编辑 `personal/daily-reminders.json`。微信实收仍受 iLink 无人值守限制影响。

- **2026-10-18（新 Mac／仅 macOS）统一额度查询**：智谱与 Codex 均按全局 `quota-usage` Skill 查询；手动请求和每天 09:00 定时任务调用 `/Users/mac/.codex/skills/quota-usage/scripts/query.py`，定时任务使用 `--all`。全局脚本入口与配置路径已核对，切换后的真实查询及定时推送仍待观察。受限工具沙箱若拦截 Codex App Server，须通过宿主权限流程重跑同一入口。Win10 未适配。

- **2026-10-17（新 Mac／macOS）Codex Bot 专项验收**：实际 Bot 会话的工作目录／项目规则读取与安全边界专项消息仍待验收；Win10 不沿用本次 macOS 结论。未启用开机自启，未迁移 Claude 会话历史。

- **2026-10-02（新 Mac／仅 macOS）每日额度任务**：智谱额度的 LaunchAgent 每天 09:00 运行；包装器现调用全局 `/Users/mac/.codex/skills/quota-usage/scripts/query.py --all`，与手动单项查询共用 Skill。切换后的真实查询、首次合并推送与微信实收待观察；AI 日报和 Bot 每周重启仍未加载。

- **定时推送可靠通道决策（2026-09-10 起待办，等散帅决策）**：`wechat-acp` 主动推送依赖最近一次微信入站消息的 `contextToken`。2026-09-11 复核确认当前腾讯公开协议与客户端没有独立主动推送凭据或续期接口；公开实测报告存在约 24 小时窗口和单令牌约 10 条出站额度，但不是官方 SLA。本机探针只证实 09:00 成功、10:00 起 `ret=-2`，尚不能最终区分额度耗尽与窗口失效。当前 iLink 只适合低频、近期有入站消息时的尽力推送；根治方向改为交互继续走 iLink，无人值守通知另选具备独立发送凭据的通道，具体选型与实施待散帅确认。
- **daemon 每周受控重启·一个月观察期（2026-09 月底复核）**：功能已上线（每周二 04:00 自动重启，仅 macOS）。观察指标：若一周内再次出现上下文混淆迹象，周期缩短到 4-5 天；若一个月无劣化迹象，评估放宽。复核时核对 `docs/research/daemon-rolling-restart.md` 与 ROADMAP，确认与实际运行一致。
- **本机（Win10）龙虾资产的去留与清理（未开始，等散帅明确发起）**：注意本文件中「`~/.qclaw/` 已不存在/已清理」均发生在 macOS 那台电脑上；本机龙虾目录 `D:\qclaw` 保留原样，散帅明确说「开始清理」之前，禁止对其做任何清理、删除、迁移或写入。
- **Win10 安装 CodeBuddy 并作为 wechat-acp Agent（待实机验收）**：部署文档 `docs/deployments/codebuddy.md` 已含 Win10 节（raw command `codebuddy --acp`、token 复用、与 Claude 切换先 `wechat-acp stop`），但 Win10 端尚未实机跑通，目前仅 macOS 端已完成端到端验收；实装并通过验收后再回填结论。
- **OpenClaw（`~/.qclaw/`）个人数据迁移收尾**：macOS 侧 second-brain/QClaw 资产迁移已完成（见「已完成」），剩余待整理的残留或新增数据按要求逐步迁入 `personal/`，未明确发起前不擅自清理。

## 最近验证

- 2026-10-18 16:58（新 Mac／仅 macOS）：提交前核对统一额度查询入口、星球简报抓取入口、每日 06:00 提醒与四份待提交文档的一致性；文档本地链接、全局 Skill 与脚本入口存在性及 `git diff --check` 通过。仅检查文档与路径，未重新查询额度、运行抓取、触发推送或复验服务在线；本机脚本、个人数据、凭据与运行配置继续按忽略规则保留本机。

- 2026-10-18 16:43（新 Mac／仅 macOS）：按散帅要求将星球简报定时抓取切换为全局 `web-crawler` Skill 的知识星球 `feed` handler；定时脚本先复用或启动 Skill 的 CDP，再读取最多 20 条并按北京时间筛选星主近 24 小时发言。更新项目规则、README 和本地定时任务说明。通过更新后脚本的只读抓取函数获取 13 条、筛出近 24 小时星主发言 0 条，未执行微信注入；LaunchAgent 仍加载并保持每天 12:00、18:00。Python AST、Shell 语法和 `git diff --check` 通过；首次自然调度及微信实收待观察。

- 2026-10-18 16:06（新 Mac／仅 macOS）：按散帅要求将额度查询的唯一入口切换至全局 `quota-usage` Skill；项目规则、README、智谱模板、定时任务说明和定时包装器均指向 `/Users/mac/.codex/skills/quota-usage/scripts/query.py`，Claude 项目 Skill 链接改指全局 Skill，旧本地入口改为迁移说明。Skill `--help`、Python AST、Node 语法、Shell 语法、链接解析和 `git diff --check` 验证通过；未查询额度或触发推送。

- 2026-10-18 11:24（新 Mac／仅 macOS）：按散帅要求将手动与定时额度查询合并到 `quota-usage` 唯一入口；每日包装器调用 `--all`，单项手动查询调用同一入口的 `--glm`／`--codex`。手动 Skill 命令与 launchd 包装器均使用 `/Users/mac/homebrew/bin/python3`（Python 3.14.8）。Python AST、Node 语法、Shell 语法、Skill YAML frontmatter 解析和 `git diff --check` 通过。获授权在工具沙箱外调用统一入口 `--all`，智谱和 Codex 两张卡片均成功生成，未注入或推送。Skill Creator 校验器因当前 Python 缺少 PyYAML 未能运行。

- 2026-10-18 10:51（新 Mac／仅 macOS）：按散帅要求明确额度查询的回复约定：手动查询成功只返回本次智谱／Codex 卡片，出错时才返回脱敏错误；每日合并任务成功只推两张卡片，失败不推送部分或旧结果，现行脚本仅记录脱敏错误日志。同步更新 AGENTS、README、固定模板、两项 Skill 与定时任务说明；`git diff --check` 通过，未运行查询或触发推送。

- 2026-10-18 10:17（新 Mac／仅 macOS）：按散帅要求将每天 09:00 的额度任务扩展为依次调用既有 `glm-stats` 与 `manage-codex-usage` 查询脚本，并把智谱、Codex 两张卡片合并为一次 injection；任一查询失败、输出无效或超时都不入队且不重试。任务保持原 09:00 LaunchAgent，无需重载；首次合并调度与微信实收待观察。Shell 语法、Python AST、文档差异和 `git diff --check` 验证通过；未手动查询或触发推送。

- 2026-10-18 10:10（新 Mac／仅 macOS）：按散帅要求将每日打卡提醒从每天 08:00 调整为 06:00；更新源 plist 与 LaunchAgents 运行副本，卸载并重新加载服务。`launchctl print` 确认 `gui/501` 的日历触发为 Hour 6／Minute 0，`runs=0`、`RunAtLoad` 关闭；源与运行 plist 均通过 `plutil -lint` 且内容一致，`git diff --check` 通过。未手动触发提醒。

- 2026-10-18 10:01（新 Mac／macOS）：百度页经 OpenCLI 提取成功；知识星球页显示登录态，`groups` 与 `topics` 读取成功。`whoami` 的 `/v2/users/self` 检查单独返回 `AUTH_REQUIRED`；一次 `limit=50` 返回 14001，`limit=20` 成功，此前 1059 本次未复现。星主作者标识为 `stormzhang`；脚本只读筛选最近 24 小时，实际查询 20 条、星主发言 0 条，未触发微信注入。Python／Shell 语法、plist 校验通过；源 plist 与运行副本一致。`launchctl print gui/501/com.sanshuai.wechat-agent-bot.zsxq-brief` 确认 12:00、18:00 触发、`runs=0`、`RunAtLoad` 关闭。

- 2026-10-18 09:38（新 Mac／macOS）：通过 OpenCLI 只读列出星球并确认目标主星「帅张和他的朋友们」，但话题读取返回平台错误 1059（不支持非官方工具），不能继续用 OpenCLI 提取帖子。知识星球官方 Skill 的安装指南要求全局安装 `zsxq-cli` 与 Skill，再由用户完成 OAuth；本机均未安装，未创建或加载星球简报任务。临时 OpenCLI 标签和会话已关闭；每天 08:00 与 09:00 的既有任务未改动。

- 2026-10-17 21:04（Win10）：清理 Git 工作区临时文件记录。删除可重新生成且未被 Git 跟踪的 `tmp_ma.py`、`tmp_ma.json`、`tmp_ma2.json`；将任务临时目录 `.tmp/` 加入 `.gitignore`，保留其中来源较早、用途不一的现有内容，不做整目录删除。验证：三个根目录临时文件均不存在，`.tmp/` 命中项目忽略规则且不再出现在 `git status`。

- 2026-10-17 19:07（新 Mac／macOS）：提交前核对个人清单触发与归档规则、README 目录约定和每日打卡提醒记录，文档本地链接与 git diff --check 通过；workspace 总览同步每日提醒的文档状态。此次仅提交现有可跟踪文档改动，不读取个人清单正文、不重新触发任务或复查服务在线状态；脚本、个人数据和运行配置仍按项目忽略规则保留本机。

- 2026-10-17 19:05（新 Mac／macOS）：散帅确认在 16:30 收到每日打卡提醒；一次性任务于 16:30:01 执行成功并入队 1 项。临时 launchd label、安装 plist 和任务临时目录均已清理；正式每日 08:00 任务仍已加载、`runs=0`。

- 2026-10-17 16:10（新 Mac／macOS）：每日打卡提醒一次性任务按本机北京时间触发，读取当前 JSON 清单并成功入队 1 项（任务退出码 0）；微信实际送达未确认。临时 launchd label、安装 plist 和任务临时目录均已自动清理；正式每日 08:00 label 仍已加载、`runs=0`。

- 2026-10-17 16:02（新 Mac／macOS）：每日打卡提醒配置核验。Python 语法与 JSON 解析通过，源 plist `plutil -lint` 通过，安装副本与源文件一致；`launchctl print` 确认触发时间为本机北京时间每天 08:00、`runs=0`。未手动注入提醒，微信实际到达待首次自然运行确认。

- 2026-10-17 09:31（新 Mac／macOS）：`max` 配置的 ACP initialize／session/new 与真实提示响应通过，返回 `model=gpt-6-luna`、`reasoning_effort=max`、`mode=workspace-write`、`end_turn`。原 Codex PID `28593` 及 15 个后代进程完全退出后，新 PID `33846` 单实例运行，固定构建与配置指纹检查通过，微信登录复用和轮询启动标记存在，无新增 Fatal／过期／轮询错误。提交前文档与链接、Shell／Python 语法、git diff --check 通过；本轮未发送微信测试消息。

- 2026-10-17 09:03（新 Mac／macOS）：按散帅要求实际调用 `manage-codex-usage`，08:59:29 成功返回 Plus、5 小时剩余 85%／已用 15%（重置 2026-10-17 13:19:56）、每周剩余 64%／已用 36%（重置 2026-10-22 21:25:11），均为北京时间且仅代表该查询时刻。散帅明确确认 Skill 已在 Mac 跑通；本次确认不扩大到微信端卡片实收或 Win10。提交前核对文档、源码忽略边界与现有 12 项测试／Skill 校验证据，未重复查询额度或重启 Bot。

- 2026-10-17 08:55（新 Mac／macOS）：`manage-codex-usage` 的真实官方只读查询成功，08:54:33 返回 Plus、5 小时剩余 87%／每周剩余 64%及重置时间，仅代表该查询时刻。12 项测试覆盖 0%／100%、小数、北京时间、多桶、缺失与非法字段、响应通知、错误脱敏、超时与子进程退出；全部通过。官方 Skill 校验器通过，`skills/list` 确认新 Skill enabled，源码与软链接均被 Git 忽略；git diff --check 通过。微信端自然语言调用和手机卡片实收未验证。

- 2026-10-17 08:47（新 Mac／macOS）：提交前核对 Codex 接入的 README、部署说明与路线图，文档链接和 git diff --check 通过；本次仅提交三份文档，scripts／runtime-data 按现有忽略规则保留本机，不包含依赖、凭据或运行数据。此前 10 项发送回归与模型响应、微信实收验收结论保持不变，本轮未重复请求模型或重启 Bot。

- 2026-10-17 08:34（新 Mac／macOS）：散帅确认 Codex 微信验收通过，微信端实收验收完成。该确认不覆盖实际 Bot 会话的工作目录／规则读取与安全边界专项验收；Win10 未验证。

- 2026-10-17 08:29（新 Mac／macOS）：ACP initialize／session/new 与真实模型响应通过，返回 `model=gpt-6-luna`、`reasoning_effort=medium`、`mode=workspace-write`、`end_turn`。现有 Bot 存活时启动入口正确拒绝重复启动；Claude PID `88657` 及两个子进程退出后，Codex PID `28593` 单实例运行，配置／构建指纹通过，工作目录与隐藏思考参数正确，微信登录复用与轮询启动标记存在，无新增 Fatal／过期／轮询错误。发送故障与待取回相关 10 项测试通过，Shell／Python 语法检查通过；微信实收及专项场景未验证。
