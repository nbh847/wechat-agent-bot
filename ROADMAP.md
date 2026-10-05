# WeChat Agent Bot Workspace Roadmap

## 当前阶段

项目正在从自研微信 Bot 实现切换为 `wechat-acp` 的受控 Agent 工作区，**同时作为散帅的个人 AI 助手工作区**，逐步替代 OpenClaw（`~/.qclaw/`）的功能。

## 已完成

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
- 2026-08-31：**定时推送「微信端一条都没收到」故障排查（8-31）**。结论为偶发网络故障窗口（早间 07:00-09:40 日志内多 tick fetch failed/tool failed、10:10 后恢复），非持续损坏；此前为偶发故障窗口定性，与 9-10 确诊的 contextToken 根因不同。记录 3 个上游 wechat-acp 缺陷：① `apiPost` 把超时 AbortError 洗白为 `{ret:0}` 假成功（第 3 条已修）、② `Agent prompt error` 错误对象未序列化、③ 回复发送成败只进远端遥测、本地无审计。
- 2026-08-31（macOS）：**新增项目级 skill `context-usage`**（`.claude/skills/context-usage/`）。从最近会话 transcript 尾部解析 usage 以卡片输出真实上下文占用及 1M 窗口占比，触发词「查询上下文/上下文/上下文额度」等。实测 9 天长命会话被 compact 控制在约 19 万 tokens（占 1M 窗口 19%+），滚动重启防的是 compact 摘要的有损性而非窗口爆炸（已补入 `docs/research/daemon-rolling-restart.md`）。仅 macOS 可用。
- 2026-08-31：**AGENTS.md 新增「机器与系统标注」强制约定**。本仓库跨 macOS 与 Win10，机器特定内容必须标注「仅 macOS/仅 Win10/双机通用」，ROADMAP 操作注明执行机器；触发背景：Win10 侧 `.claude/skills/` 26 个 skill 曾使 macOS 侧误判目录存在。
- 2026-08-29：**`personal/` 待办库新增「电影」分类**。原「阅读」类混入的 4 部影视迁出到新建 `movie/` 目录并改 `category: movie`，`reading/` 仅保留书籍；工作区级 AGENTS.md 分类同步为七类；全部英文文件名条目在正文补「中文名」备注行，约定展示以中文名为准。
- 2026-08-27：**区分「待做清单」与「想做的事」触发词约定**。工作区级 AGENTS.md 术语约定：待做清单 = `TASKS.md` 任务队列（当前要做的任务）；「想做的事」= 本项目 `personal/` 生活待办库（destination/game/product/project/reading/research + movie 七类），新增生活类条目不得写入 TASKS.md。
- 2026-08-25：**修复星球简报误报「登录过期」**。根因 `brief.mjs` 把 `fetchFeed` 空数组一刀切报成登录过期，而空结果可能是暂无新内容/页面未加载/登录失效三态之一，真实登录问题以异常抛出让脚本走失败路径。修复：`try/catch` 区分抓取异常（带真实 `e.message`）与空结果，并加空结果自动重试一次（首次空则间隔 2s 重抓再判定）。
- 2026-08-24：**收敛规则文件职责**。`CLAUDE.md` 只保留一句指向同目录 `AGENTS.md`；启动命令分属 `docs/deployments/*.md`；`AGENTS.md` 补齐工作区级规则继承指针（`/Users/mac/workspace/AGENTS.md`）、`docs/deployments/` 路径与文档链，消除断链。

## 进行中

- **2026-10-02 20:51（新 Mac／macOS）定时任务逐项恢复，当前先做智谱额度**：glm-stats Skill 与定时包装已重建，4 组隔离测试和包装失败不注入检查通过，Skill 官方校验器通过；散帅本机录入 Key 后，真实额度查询成功（Lite、5 小时／每周／MCP 月度额度与重置时间），凭据权限 600。北京时间每天 09:00 的 LaunchAgent 已加载，源／运行 plist 一致、脚本存在。20:54 散帅明确授权后手动触发一次，launchd runs=1／exit 0，发送审计新增一条 success、无失败；2026-10-03 新模板即时推送已获散帅手机端实收确认；首次自然调度未观察。热点新闻每日 07:00 任务已于 21:11 按散帅要求取消并删除源 plist；剩余星球简报、AI 日报和 Bot 每周重启暂缓，未加载。

- **定时推送可靠通道决策（2026-09-10 起待办，等散帅决策）**：`wechat-acp` 主动推送依赖最近一次微信入站消息的 `contextToken`。2026-09-11 复核确认当前腾讯公开协议与客户端没有独立主动推送凭据或续期接口；公开实测报告存在约 24 小时窗口和单令牌约 10 条出站额度，但不是官方 SLA。本机探针只证实 09:00 成功、10:00 起 `ret=-2`，尚不能最终区分额度耗尽与窗口失效。当前 iLink 只适合低频、近期有入站消息时的尽力推送；根治方向改为交互继续走 iLink，无人值守通知另选具备独立发送凭据的通道，具体选型与实施待散帅确认。
- **daemon 每周受控重启·一个月观察期（2026-09 月底复核）**：功能已上线（每周二 04:00 自动重启，仅 macOS）。观察指标：若一周内再次出现上下文混淆迹象，周期缩短到 4-5 天；若一个月无劣化迹象，评估放宽。复核时核对 `docs/research/daemon-rolling-restart.md` 与 ROADMAP，确认与实际运行一致。
- **本机（Win10）龙虾资产的去留与清理（未开始，等散帅明确发起）**：注意本文件中「`~/.qclaw/` 已不存在/已清理」均发生在 macOS 那台电脑上；本机龙虾目录 `D:\qclaw` 保留原样，散帅明确说「开始清理」之前，禁止对其做任何清理、删除、迁移或写入。
- **Win10 安装 CodeBuddy 并作为 wechat-acp Agent（待实机验收）**：部署文档 `docs/deployments/codebuddy.md` 已含 Win10 节（raw command `codebuddy --acp`、token 复用、与 Claude 切换先 `wechat-acp stop`），但 Win10 端尚未实机跑通，目前仅 macOS 端已完成端到端验收；实装并通过验收后再回填结论。
- **OpenClaw（`~/.qclaw/`）个人数据迁移收尾**：macOS 侧 second-brain/QClaw 资产迁移已完成（见「已完成」），剩余待整理的残留或新增数据按要求逐步迁入 `personal/`，未明确发起前不擅自清理。

## 最近验证

- 2026-10-03 12:38（新 Mac／macOS）：智谱新模板及新增进度条 4 组回归测试通过，覆盖满格／空格、小数、缺失窗口及查询失败保护；定时包装首行校验保持兼容，git diff --check 通过。散帅确认本次 Bot 启动后收到微信回传；最新额度查询与一次注入成功，新增发送审计无错误，散帅确认微信实收和样式验收通过。首次自然 09:00 调度仍未观察。

- 2026-10-02 21:11（新 Mac／macOS）：launchctl print 确认 hot-news 服务不存在；源 plist 已删除，LaunchAgents 无对应运行副本，当前任务清单无热点新闻条目；其余 4 份 plist 保留，git diff --check 通过。

- 2026-10-02 21:04（新 Mac／macOS）：提交前核对 AGENTS、README、ROADMAP、Claude 部署说明和智谱固定模板；模板文档与脚本一致，新增文档指针存在，git diff --check 通过。本次提交仅包含文档，不包含被忽略的本机脚本、构建、Skill 或凭据。

- 2026-10-02 20:57（新 Mac／macOS）：固定模板示例与当前 renderCard 输出逐字比对通过；文档指针均存在、git diff --check 通过。仅固化模板约定，未修改查询逻辑、调度或追加推送。

- 2026-10-02 20:56（新 Mac／macOS）：智谱新模板使用上次查询数值生成文本预览；4 组回归测试通过，0%／100%、小数进度条、缺失字段均正确，固定卡片首行保持兼容定时包装，git diff --check 通过。微信端新样式未另行验收。

- 2026-10-02 20:54（新 Mac／macOS）：散帅明确授权即时推送一次后，通过 launchctl kickstart 触发智谱任务；launchd runs=1、last exit code=0，任务错误日志为空。触发时间之后发送审计新增一条 success、ret=null、errorType=null，无失败记录。未重复触发；手机端到达待散帅确认，首次自然 09:00 调度尚未观察。

- 2026-10-02 20:51（新 Mac／macOS）：真实智谱只读查询通过，返回 Lite 套餐及 5 小时／每周／MCP 月度额度和重置时间；Skill 官方校验器通过，配置权限为 600；launchctl print 确认 gui/501 下任务已加载、calendarinterval 为 Hour 9／Minute 0，macOS 时区 CST +0800，源／运行 plist 一致。任务 runs=0，未执行即时推送；git diff --check 通过。

- 2026-10-02 20:45（新 Mac／macOS）：glm-stats 隔离测试覆盖 0%／100% 用量、窗口顺序、未知／缺失字段、401／403／429／500、非 JSON、业务拒绝、域名与文件权限校验，4 组通过；包装失败／非法产物均不调用 inject。5 份 plist 通过 plutil，重启脚本身份正反例通过，shell／Node 语法检查通过。未使用真实 Key 或加载任何新增 LaunchAgent。

- 2026-10-02 20:36（新 Mac／macOS）：微信端实际回传人工验收通过，依据为散帅本轮明确确认“我发了消息，确认 bot 回传了”。未据此扩大为全部部署专项场景或无人值守推送验收。

- 2026-10-02 20:34（新 Mac／macOS）：TypeScript 构建通过；全量 219 项测试 218 通过、1 项 Windows 专属跳过、0 失败；隔离发送与待取回测试 10 项通过。Claude ACP initialize／session/new 通过；daemon status 为 Running（PID 6663），进程核对为单实例，脱敏日志标志确认已复用本机登录并开始消息轮询，无启动 Fatal 或轮询错误。未验证微信端实际回传。

- 2026-09-11 12:09（macOS）：临时监控与探针下线验证。两个 launchd label 均已卸载，`~/Library/LaunchAgents/` 中对应加载副本和项目内四个源文件均已删除；保留 `runtime-data/cron/` 历史日志与状态，未触碰其他任务和 daemon。
- 2026-09-11（macOS）：08:00 至 22:00 小时探针链路核验。`launchd` 已加载，09:00、10:00、11:00 均执行且 wrapper exit 0；对应 injection 全进入 `done/`，排除调度与队列故障。09:00 时段仍有发送成功记录；10:00、11:00 的短消息各重试 3 次，均为 HTTP 200、`ret=-2`、`WeChatSendBusinessError`。结合腾讯当前协议和公开 issue，修正结论为同一入站 `contextToken` 的出站额度耗尽或窗口失效，不能再把 `ret=-2` 单独等同于固定时长过期。
- 2026-09-10（macOS）：定时推送「收不到」初步定位。send-audit 逐小时聚合显示 8 起定时推送全部失败、9-9 21:00 与会话活跃时段成功、无人值守时段失败；确认失败位于微信业务拒绝层，而非调度或 Agent 处理层。同日曾短暂上线基于时长的「contextToken 止血守卫」，因阈值未坐实（历史数据显示 `ret=-2` 与成功交错、非单调过期）被撤下，定时推送恢复直接发送；9-11 的协议与探针复核已把原因收敛为同一入站令牌的额度耗尽或窗口失效，见上一条验证和「进行中」。
- 2026-09-09（macOS）：心跳监控验证。四分支隔离单测（首次基线/健康/轻度/重度）判定全对；cooldown 场景物理验证未真重启 daemon（PID 22947 不变）；launchd 注册成功、手动触发判链路健康、stdout/stderr 无错；修复后 22h 提醒脚本由「休眠」变「0h 前，未到提醒窗口」。
- 2026-09-07（macOS）：修复星球简报连续 4 天 `client.closeTab is not a function`（9-05 起每次失败）。根因：共享 skill `~/.agents/skills/web-crawler/scripts/cdp-client.js` 在 9-03 修改中丢失 `closeTab(tabId)` 方法，而 `platforms/zsxq.js`/`wechat.js` 仍调用，首个调用即抛 TypeError、未发任何请求，报错文案「无法区分登录或网络」实为误导。补回方法后 `node platforms/zsxq.js feed` 正常返回 5 帖，10:42 手动触发端到端注入真实简报。教训：改共享底层库必须跑调用方回归。
- 2026-09-06（macOS）：`send-failure-alert` 改造完成并验证。launchd `StartInterval` 每小时触发，读 `runtime-data/conversations/state.json` 中 `role:user` 消息 `createdAt` 计算距最后用户消息时差，22h/23h 各发一次微信提醒、≥24h 时休眠、`.state` 按小时去重；手动触发验证正确算得 535h 前、走休眠分支、未误发。（其数据源问题已于 9-09 修复，见「已完成」）
- 2026-09-04（macOS）：项目状态核验。`wechat-acp status` Running（PID 78574），6 个 launchd 任务全加载且 exit 0（daemon-restart 每周二 04:00、hot-news/ai-daily/glm-usage/zsxq-brief、send-failure-alert）；确认 `state = not running` 属正常：`status` 只反映 launchd 任务状态，WatchPaths 任务无常驻进程，`ps` 见 PID 78574 即证明 daemon 真实存活。纯只读核验，未触发重启。
- 2026-08-31（macOS）：daemon 重启端到端 + 身份保护收尾验证。old exit（干净实例约 2s）→ new Running（PID 80069）、全机单实例、launchd last exit 0；重启窗口注入的验收消息由新 daemon 从持久化队列补处理并投递，未丢失、无重复处理；身份校验匹配真实 daemon 命令、拒绝模拟无关进程；`bash -n`/`sh -n`/`plutil -lint`/plist 一致性/`git diff --check` 通过。
- 2026-08-31（macOS）：发送失败修复 Goal 06 端到端验收。第一次切换暴露成功响应 `ret` 可缺省的协议差异，按腾讯参考实现修正后全量 235 项测试 234 过 1 跳、构建通过；第二次受控重启 old `56005`→new `8745`，旧进程 4s 退出、一次启动成功、launchd exit 0、Running 且单实例，微信只收到一次完全一致回复，审计基线后仅新增 1 条 `attempt=1`、HTTP 200、`ret=null`、字段匹配允许列表、权限 600。
- 2026-08-31（macOS）：发送失败修复 Goal 01—05 与上游核验。隔离验证覆盖业务失败/HTTP 失败/超时/非法响应/三次同键重试/外层不重发/`pending/unknown` 传播/`/acp-more` 原序取回/审计脱敏，`verify-send-failure.sh` 通过；Git SSH 浅克隆核验上游 `main` 最新 `4b787a5` 仍为 `0.10.0`，确认 `src/weixin/api.ts` 仍统一吞 `AbortError`、`sendMessage()` 不校验 `ret`，据此定为责任层源码修复而非 fetch Hook。
