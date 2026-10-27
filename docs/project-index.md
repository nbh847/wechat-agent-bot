# 项目功能与术语索引

> 本文是双机通用的功能导航。功能目录和关键词以 2026-10-17 Win10 工作区可见内容为基准；凡机器状态不同或尚未确认的部分均单独标注。索引说明“有什么、叫什么、去哪里看”，具体执行仍以对应规则、Skill、部署文档和 `ROADMAP.md` 为准。

## 怎么使用

- 询问项目做过什么、某个术语指什么、某句自然语言对应哪个功能时，先查本索引。
- 准备执行功能时，按表格读取对应 `SKILL.md`、`AGENTS.md` 或部署文档；本索引不取代执行流程和安全规则。
- 功能当前是否启用、在哪台机器验收，以 [`ROADMAP.md`](../ROADMAP.md) 和对应部署文档为准；文件存在不代表定时任务正在运行。
- 本索引不复制个人资产金额、交易明细、账户资料、健康记录、凭据、日志或其他本机数据。

## 项目总览

### 核心链路

```text
微信消息 → wechat-acp → ACP Agent → 本项目工作区
         ←             Agent 回复 ←
```

- `wechat-acp` 负责微信通信、会话恢复和 Agent 进程；本项目是它启动 Agent 时使用的默认工作目录，不再维护自研 Bot 服务。
- 微信发送链路：固定版本的本地 wechat-acp 构建含发送失败修复；脱敏发送审计记录有限元数据，不写消息正文或凭据。实现和审计边界见 `README.md`，仅 macOS 的验证细节以 `ROADMAP.md` 为准。
- Agent 接入文档：[`Claude`](deployments/claude.md)、[`CodeBuddy`](deployments/codebuddy.md)、[`Codex`](deployments/codex.md)。各机器的实际接入和验收状态见路线图。
- 项目职责、安全确认、Memex 授权、个人清单触发规则见 [`AGENTS.md`](../AGENTS.md)；稳定定位与目录用途见 [`README.md`](../README.md)。
- 历史自研 Bot 实现归档在 `archive/goal7-agent-v2-20260815` 分支；当前 `main` 不恢复旧架构，除非用户明确要求。

### 主要内容区

| 内容 | 入口 | 作用与边界 |
|---|---|---|
| 项目规则 | [`AGENTS.md`](../AGENTS.md) | Agent 行为、安全、Skill 优先、Memex 和个人清单规则。 |
| 项目进度 | [`ROADMAP.md`](../ROADMAP.md) | 当前阶段、完成项、待办、阻塞和验证历史；机器归属不可互相推定。 |
| Agent 部署 | [`docs/deployments/`](deployments/) | Claude、CodeBuddy、Codex 的 macOS／Win10 操作入口；智谱卡片模板另见 [`glm-usage-template.md`](deployments/glm-usage-template.md)。 |
| 本机 Skill | `.claude/skills/<skill>/SKILL.md` | 当前 Win10 工作区可见的自然语言入口、工作流和数据规则；该目录被 Git 忽略，跨机是否同步需各机确认。 |
| 本机任务脚本 | `scripts/cron-tasks/windows/` | Win10 计划任务入口及提示词；`scripts/` 被 Git 忽略，脚本存在不等于任务已注册或运行。 |
| 本机运行数据 | `runtime-data/` | Codex ACP 依赖、旧 QClaw 归档和本机 Skills 运行数据；目录被 Git 忽略，不在本索引展开私人记录。 |
| 个人清单 | `personal/` | 每台机器独立保存的待看、待读、待玩、旅行与想法；不进 Git、不自动跨机同步。 |
| 健康管理 | `personal/health/README.md` | 仅 Win10：本机私密体检与健康资料整理入口；不在索引复制个人健康记录。 |
| 大米评测 | `personal/rice-review/README.md` | 仅 Win10：记录大米包装重量、货架标价／成交价、每斤价格、评分和评价；本机数据不进 Git、不自动跨机同步。 |

## 项目规则层的功能

| 功能 | 用户表达／术语 | 规则与资料入口 |
|---|---|---|
| Memex 知识入库 | 入库、Memex、手动入库、自动入库、批量入库 | [`AGENTS.md`](../AGENTS.md) 规定 manual／auto／batch 的模式判定和授权边界。规则中引用 `docs/operations/ingestion-sop.md`；该文件未出现在本次 Win10 `docs/` 扫描结果中，执行时须先确认 SOP 可用。 |
| 个人意向清单 | 待看／想看／影单、待读／想读／书单、待玩／想玩、旅行／目的地、项目／产品／研究想法 | [`AGENTS.md`](../AGENTS.md) 与 [`README.md`](../README.md)；对应目录为 `personal/watchlist/`、`personal/reading/`、`personal/game/`、`personal/destination/`、`personal/project/`、`personal/product/`、`personal/research/`。 |
| QQQI 年度分红列表 | 今年 QQQI 分红、今年分红列表、QQQI 年度分红 | 仅 Win10：从本机账本列出券商流水或火球确认的分红记录；扣税后金额以人民币显示、费用单列，并注明已知的现金到账、再投资或部分再投资方式。再投资仍计入分红，不视为可用现金。经授权的估算须单列并注明假设，不冒充券商流水。规则见 [`AGENTS.md`](../AGENTS.md)，账本为 `runtime-data/skills-home/workspace/data/qqqi-tax.json`。 |
| 待办与日程分流 | 记一下、帮我安排、有日期的待办、复制到 Google 日历 | 仅 Win10：普通行动待办写入 Dida365；一般有日期待办手动单向镜像到 Google Calendar，按全天或明确时间段复制，火球通过本对话告知改期时更新副本；银行卡／平台红包、返现、抽奖、优惠券等羊毛类提醒直接微信推送，不创建日历事件或镜像；滴答应用内直接编辑不会自动同步。当前 Dida365 日历账号列表为空，未发现自动同步。其他机器沿用工作区级待办队列，细则见 [`task-calendar-routing`](../.claude/skills/task-calendar-routing/SKILL.md) 与 [`AGENTS.md`](../AGENTS.md)。 |
| Google 日历前一日提醒 | 提前一天提醒、日历事件提醒、日程微信通知 | 仅 Win10：`calendar-event-reminder` 每天 09:30（北京时间）汇总次日开始的有效 Google Calendar 事件并经 wechat-acp 投递微信；Windows Task Scheduler 已注册且状态 Ready，首次定时运行和微信实收待验证。 |
| 每日打卡提醒 | 每日提醒、提醒清单 | `personal/daily-reminders.json`（仅 macOS）；数据项可启用／停用，细节见 [`README.md`](../README.md)。 |

## 外部 MCP 能力

| 服务 | 功能与关键词 | 机器归属、状态与入口 |
|---|---|---|
| Dida365（滴答清单／TickTick） | 查询和管理任务、清单、习惯等；Dida365、滴答清单、TickTick、查任务、创建任务、完成任务。 | 仅 Win10：Codex MCP OAuth 与工具发现已验证；Bot 配置使用同一服务地址。2026-10-18 查询日历账号列表为空，未发现自动同步；一般有日期待办按 Skill 手动镜像到 Google Calendar；羊毛类提醒不建日历副本。现存 ACP 会话即时加载状态未单独验证；macOS 未验证。配置与授权边界见 [`Codex 部署说明`](deployments/codex.md)，执行状态见 [`ROADMAP.md`](../ROADMAP.md)。 |
| Google Calendar | 查询日历、空闲时间和日程，创建或调整事件；Google 日历、查日程、空闲时间、创建日程。 | 仅 Win10：官方插件已安装并完成 Google OAuth；全局 Codex CLI 与 Bot 固定 Codex CLI 的临时只读会话均已调用 `google_calendar.list_calendars`。Bot daemon 已通过固定入口重启并恢复微信轮询；微信端自然语言调用与实收未单独验收，macOS 未验证。接入与验证边界见 [`Codex 部署说明`](deployments/codex.md)，执行状态见 [`ROADMAP.md`](../ROADMAP.md)。 |

## 项目 Skill 功能目录

以下 36 个 `SKILL.md` 在本次 Win10 工作区的 `.claude/skills/` 扫描中可见。`SKILL.md` 是执行细节和关键词口径的权威入口；这里仅概括用途与常见说法。此目录被 `.gitignore` 忽略，不能据此推断 Mac 上也已安装。

### 资产、财务与模型额度

| Skill | 功能 | 关键词／自然语言入口 |
|---|---|---|
| [`a-share-ytd`](../.claude/skills/a-share-ytd/SKILL.md) | A 股年度表现与 YTD 报告。 | A 股今年涨跌、A 股表现、YTD。 |
| [`ai-balance-check`](../.claude/skills/ai-balance-check/SKILL.md) | AI 模型余额查询。 | AI 余额、模型余额。 |
| [`asset-management`](../.claude/skills/asset-management/SKILL.md) | 全资产、持仓管理与日报入口。 | 资产日报、总持仓、总资产、更新持仓、买入、卖出。 |
| [`bond-us-fill-tracker`](../.claude/skills/bond-us-fill-tracker/SKILL.md) | 债券／美股资产配置补仓进度追踪。 | 补仓进度、补了多少。 |
| [`budget-check`](../.claude/skills/budget-check/SKILL.md) | 个人预算查询。 | 预算、预算还剩多少。 |
| [`crash-rebalance`](../.claude/skills/crash-rebalance/SKILL.md) | 纳指大跌时的再平衡预案与压力测试。 | 纳指跌了怎么办、大跌再平衡、暴跌方案、压力测试。 |
| [`ct433-drift-check`](../.claude/skills/ct433-drift-check/SKILL.md) | CLEC433 配置偏离、基准和动作历史查询，并给出逐步调整提案。 | 433 偏离、资产平衡检查、漂移检查、433 基准、动作历史、挪一步。 |
| [`deepseek-balance-first-reply`](../.claude/skills/deepseek-balance-first-reply/SKILL.md) | 每日首次回复附带 DeepSeek 余额。 | DeepSeek 余额、当天首次回复。 |
| [`fire-gap-switch-analysis`](../.claude/skills/fire-gap-switch-analysis/SKILL.md) | 按年度 FIRE 现金流缺口核算卖出资产损失的分红、QQQI 增量分配与换仓后缺口；缺口以最近资产日报严格口径为准，不使用本金目标替代年缺口。 | FIRE 缺口、年度分红差多少、卖分众／茅台换 QQQI、换仓后还差多少。 |
| [`fire-withdrawal-model`](../.claude/skills/fire-withdrawal-model/SKILL.md) | FIRE 取钱与三池现金流模型。 | FIRE 取钱、提款、债券池、分红池、增长池。 |
| [`fund-daily`](../.claude/skills/fund-daily/SKILL.md) | 场外基金数据更新与基金日报。 | 基金、基金日报、场外基金。 |
| [`guosen-rebalance`](../.claude/skills/guosen-rebalance/SKILL.md) | 国信证券组合状态和年度动作日计算。 | 国信组合、涨跌、比例、现金腿、国信动作日。 |
| [`insurance-payments`](../.claude/skills/insurance-payments/SKILL.md) | 保险缴费记录与查询。 | 保险缴费、保费记录。 |
| [`portfolio-report`](../.claude/skills/portfolio-report/SKILL.md) | 全资产组合报告及多时段日报，含严格 FIRE 缺口、扣除房贷后的月可用生活费；仅 Win10 日报比较配置结构①A股+红利与③CLEC433，①超③时按差额提示减持，①≤③静默。 | 资产日报、总资产、总持仓、收盘总资产、生活费备用、①大于③再平衡。 |
| [`qianji-expense-analysis`](../.claude/skills/qianji-expense-analysis/SKILL.md) | 钱迹 CSV 消费分析。 | 钱迹、账单、本月消费、花了多少钱。 |
| [`rebalance-before-33x`](../.claude/skills/rebalance-before-33x/SKILL.md) | 达到 33 倍目标前的年度聪明再平衡方案。 | 33 倍前、涨年／跌年怎么操作、33 倍前再平衡。 |
| [`rebalance-check`](../.claude/skills/rebalance-check/SKILL.md) | 半年配置偏离检查与年度聪明再平衡。 | 要再平衡吗、四大类偏离、半年检查、聪明再平衡。 |
| [`stock-alert-system`](../.claude/skills/stock-alert-system/SKILL.md) | 股价、均线、回撤监控，以及分众传媒与 QQQI 的分批换仓观察提醒。 | 股价提示、均线、腾讯、QQQ、QQQI、分众、到价提醒、个股换仓。 |
| [`trade-ingest`](../.claude/skills/trade-ingest/SKILL.md) | 从成交截图或文字录入交易。 | 录入、入账、记一笔、成交截图、买入、卖出。 |
| [`wealth-tracker`](../.claude/skills/wealth-tracker/SKILL.md) | 财富自由进度追踪与图表。 | 财富自由、FIRE 进度、资产进度、画图。 |

### 信息检索、阅读与总结

| Skill | 功能 | 关键词／自然语言入口 |
|---|---|---|
| [`book-review-manager`](../.claude/skills/book-review-manager/SKILL.md) | 书评管理、读后记录、荐书和阅读回顾。 | 看完书、查书评、推荐本书、下一本读什么、最近读了什么。 |
| [`bored-list`](../.claude/skills/bored-list/SKILL.md) | “有聊清单”及剧集、课程、书影音进度管理。 | 有聊清单、在看什么、看完、在读、课程看到哪了、书单、影单。 |
| [`email-fetch`](../.claude/skills/email-fetch/SKILL.md) | QQ 邮箱最新邮件读取，可按 Skill 支持范围查看附件。 | QQ 邮箱、最新邮件、查邮件、下载附件。 |
| [`online-search`](../.claude/skills/online-search/SKILL.md) | ProSearch 联网搜索。 | 联网搜索、搜一下、查询最新信息、ProSearch。 |
| [`weekly-report`](../.claude/skills/weekly-report/SKILL.md) | 每周总结周报。 | 周报、每周总结、本周回顾。 |
| [`weread-skills`](../.claude/skills/weread-skills/SKILL.md) | 微信读书书籍搜索、书架、笔记划线、阅读统计和推荐。 | 微信读书、WeRead、书架、笔记、划线、阅读统计。 |

### 家庭、物品与生活管理

| Skill | 功能 | 关键词／自然语言入口 |
|---|---|---|
| [`auto-backup`](../.claude/skills/auto-backup/SKILL.md) | 自动云备份。 | 备份、云备份、打包。 |
| [`birthday-reminder`](../.claude/skills/birthday-reminder/SKILL.md) | 生日及农历生日提醒。 | 生日、农历、生辰。 |
| [`household-inventory-manager`](../.claude/skills/household-inventory-manager/SKILL.md) | 家庭物品管理。 | 家庭物品、家里有什么、物品管理。 |
| [`inventory`](../.claude/skills/inventory/SKILL.md) | 物品与消耗品库存、囤货清单、状态、使用和价格记录。 | 有什么、还有多少、囤货、查囤货、盘点消耗品、用完了、买了多少钱、用了多久。 |
| [`item-reviews`](../.claude/skills/item-reviews/SKILL.md) | 商品／物品评价和复购记录。 | 评价、评分、好用吗、回购、值得买吗。 |
| [`purchase-review`](../.claude/skills/purchase-review/SKILL.md) | 汇总已购物品的实付价格、数量、评价和回购意愿；大米价格与评价沿用专属项目。 | 买了什么、买过哪些、实付多少、价格和评价、购物记录。 |
| [`travel-bucket`](../.claude/skills/travel-bucket/SKILL.md) | 旅行愿望与目的地 bucket 清单。 | 旅游、想去、旅行计划、bucket。 |
| [`wardrobe`](../.claude/skills/wardrobe/SKILL.md) | 衣物、鞋袜和穿搭管理。 | 衣柜、衣服、鞋子、袜子、穿搭。 |

### Agent 自动化

| Skill | 功能 | 关键词／自然语言入口 |
|---|---|---|
| [`cron-task-create`](../.claude/skills/cron-task-create/SKILL.md) | 创建微信定时提醒或推送任务。 | 建个定时任务、每天几点提醒、每周推送、每月检查。 |

### 日程与任务管理

| Skill | 功能 | 关键词／自然语言入口 |
|---|---|---|
| [`task-calendar-routing`](../.claude/skills/task-calendar-routing/SKILL.md) | 普通待办写入 Dida365，固定时段安排写入 Google Calendar；一般有日期 Dida365 待办手动单向镜像；银行卡／平台红包、返现、抽奖、优惠券等羊毛类提醒直接微信推送，不创建日历事件或镜像。 | 帮我记一下、有日期的待办、复制到 Google 日历、滴答清单、Google Calendar。 |

### 文档中记录、但不计入上述 36 个项目 Skill 的功能

- 智谱 GLM Coding Plan 额度查询与卡片：[`glm-usage-template.md`](deployments/glm-usage-template.md)；查询 Skill 和定时任务按项目文档仅 macOS 已验证，Win10 状态见路线图。
- Codex 剩余额度查询：`manage-codex-usage`（仅 macOS），规则与触发词见 [`AGENTS.md`](../AGENTS.md) 和 [`README.md`](../README.md)。
- 大号记录：Win10 项目任务辅助文件包括 `scripts/cron-tasks/windows/poop-timer`、`poop-weekly`、`poop-monthly`；调用的 `poop-log` Skill 在 Win10 用户目录 `%USERPROFILE%\.claude\skills\poop-log\SKILL.md`，不属于仓库 Skill 清单。关键词：拉了、大号、上大号、大号周报、大号月报。报告本人已实际排便时（包括同时咨询腹泻等原因）应先记录本次；单纯讨论或请求周／月报不新增记录。数据文件位于 `runtime-data/skills-home/workspace/data/poop-log.json`，不复制具体记录，也不推断形状类型。

## Win10 本机定时任务目录

以下任务名来自当前 Win10 `scripts/cron-tasks/windows/` 文件名扫描。该目录被 `.gitignore` 忽略；清单只证明本机存在脚本入口，不证明计划任务已注册、已启用或最近运行成功。任务运行状态与验收记录见 `ROADMAP.md` 和机器本地任务状态。

| 任务族 | 当前可见入口 | 覆盖功能 |
|---|---|---|
| 资产与市场 | `asset-morning`、`asset-close`、`fund-daily`、`a-share-ytd-weekly`、`annual-rebalance-check`、`rebalance-check`、`bond-us-fill-check`、`ct433-drift-check`、`dividend-reminder`、`dividend-yield-check`、`astockdiv-mid-report`、`astockdiv-eom-report`、`guosen-annual-buy`、`nasdaq-drawdown`、`qqqi-dividend-alert`、`qqqi-monthly-review`、`qqqi-switch-pool`、`stock-alert`、`stale-daily`、`credit-card-repay` | 资产早报／收盘报、基金与 A 股 YTD、再平衡、补仓和偏离监控、分红、国信年度动作、纳指回撤、QQQI 官方分配公告提醒（按本机最新持仓估算人民币到账金额和分配率）、分众／QQQI 分批换仓信号及信用卡还款提醒；asset-morning 与 asset-close 每次报告比较配置结构①和③，①超③时在摘要提示差额、①≤③时静默。 |
| 家庭与健康 | `dog-deworm-reminder`、`filter-reminder`、`filter-monthly-check`、`period-reminder`、`period-reminder-check`、`poop-timer`、`poop-weekly`、`poop-monthly`、`supplement-reminder`、`supplement-noon-20261016` | 宠物驱虫、滤芯维护、周期提醒、大号记录／周报／月报和补剂提醒。 |
| 汇总与问答 | `finance-question-reminder`、`monthly-summary`、`monthly-brief` | 财务问题提醒、月度总结和月度简报。 |
| 个人任务安排 | `weekly-task-arrangement` | 仅 Win10：每周一 09:00（北京时间）汇总本周滴答清单有日期的未完成任务与所有可见 Google Calendar 日程，跨来源副本去重后按「生活、工作、投资、健康、学习、清洁、其他」分类，各类内按日期排序并合并为一条微信消息。 |
| Google 日历前一日提醒 | `calendar-event-reminder` | 仅 Win10：每日 09:30（北京时间）查询所有可见日历中次日开始的有效事件，有事件时合并为一条微信消息；Windows Task Scheduler 已注册且状态 Ready，首次定时运行和微信实收待验证。 |
| 注册入口 | `register-*.ps1`、`register-*.cmd` | Windows 任务计划程序注册辅助入口；具体操作前读取对应脚本和安全规则。 |

Win10 ACP 启动文件为 `scripts/wechat-acp/start-codex-daemon.ps1` 与 `scripts/wechat-acp/codex-config.win10.json`；部署步骤和验收状态见 [`codex.md`](deployments/codex.md)。

## 关键词与术语对照

| 术语／别名 | 在本项目中的含义 | 首选入口 |
|---|---|---|
| `wechat-acp`、微信 Bot、微信 Agent | 微信通信、会话恢复和 Agent 进程的外部运行层。 | [`README.md`](../README.md)、[`docs/deployments/`](deployments/) |
| ACP、Agent Client Protocol | `wechat-acp` 与 Claude／CodeBuddy／Codex 等 Agent 的连接协议。 | 对应 [`deployments/`](deployments/) 手册 |
| OpenClaw、小龙虾、QClaw | 旧个人助手／技能来源；本项目逐步承接新功能，历史代码或数据不可据此视为当前服务。 | [`README.md`](../README.md)、[`ROADMAP.md`](../ROADMAP.md) |
| Memex、入库、auto ingest | 项目规则中特指 Memex 知识库流程；自动、批量等词决定入库模式。 | [`AGENTS.md`](../AGENTS.md)；执行 SOP 需核对文档是否可用 |
| Skill、技能 | 自然语言入口和专用操作流程；触发后先读对应 `SKILL.md`。 | `.claude/skills/<skill>/SKILL.md` |
| 资产日报、全资产、总持仓、组合报告 | 同属资产快照／持仓报告入口；分别核对 `asset-management` 和 `portfolio-report` 的口径。 | 对应两个 Skill |
| 不同券商对比、券商收费对比 | 仅 Win10：返回固定的券商地点、QQQI 分红扣款比例、最低交易费和融资年利率表；未确认项保留为「待确认」。 | [`broker-comparison.json`](../runtime-data/skills-home/workspace/data/broker-comparison.json) |
| A 股 YTD | A 股年度涨跌统计。 | `a-share-ytd` |
| CLEC433、433、漂移、挪一步 | 组合基准偏离、动作历史和逐步调整方案。 | `ct433-drift-check` |
| 再平衡、半年检查、聪明再平衡 | 配置偏离检查或按年度策略给出调整方案。 | `rebalance-check`、`rebalance-before-33x`、`crash-rebalance` |
| 33 倍、FIRE、财富自由 | 33 倍退休本金目标、资产进度、年度现金流缺口换仓分析与提款策略走不同入口；用户明确要求按年缺口时不改用本金目标。 | `rebalance-before-33x`、`wealth-tracker`、`fire-gap-switch-analysis`、`fire-withdrawal-model` |
| 钱迹 | 个人消费流水 CSV 与预算分析入口。 | `qianji-expense-analysis` |
| QQQI、QQQ、腾讯、分众、均线、换股 | 组合跟踪、价格提示、分众／QQQI 分批换仓观察和再平衡相关标的词；策略参数只以对应 Skill 为准。 | `stock-alert-system`、`rebalance-check`、`crash-rebalance` |
| 有聊清单 | 书影音、课程等内容进度清单。 | `bored-list` |
| 微信读书、WeRead | 微信读书书架、笔记和统计。 | `weread-skills` |
| 定时任务、每天几点推送、每周提醒 | 创建自动化任务的自然语言入口；任务创建和已有计划任务管理是两回事。 | `cron-task-create`、Win10 任务脚本目录、部署手册 |

## 文档与源码导航

| 想了解 | 阅读位置 |
|---|---|
| 稳定定位、目录用途、数据边界 | [`README.md`](../README.md) |
| Agent 规则、确认要求、Memex、清单触发 | [`AGENTS.md`](../AGENTS.md) |
| 当前进度、机器差异、已完成和待验证事项 | [`ROADMAP.md`](../ROADMAP.md) |
| Claude／CodeBuddy／Codex ACP 启动与故障处理 | [`docs/deployments/`](deployments/) |
| 智谱额度固定卡片 | [`glm-usage-template.md`](deployments/glm-usage-template.md) |
| 单项功能的实际触发、口径和执行方式 | `.claude/skills/<skill>/SKILL.md` |
| Win10 定时任务与注册入口 | `scripts/cron-tasks/windows/`（仅 Win10、本机文件） |
| Win10 Codex ACP 启动配置 | `scripts/wechat-acp/`、`runtime-data/codex-acp/`（仅 Win10 运行副本） |
| 旧版自研 Bot | `archive/goal7-agent-v2-20260815` 分支 |

建立本索引前，本次 Win10 `docs/` 扫描到的既有可跟踪文档为 `deployments/` 下三份 Agent 手册和一份智谱模板；`docs/research/` 被 `.gitignore` 忽略，当前目录扫描未发现其中的文件。运行日志、配置、持仓、交易、个人清单及其他 `runtime-data/` 内容没有纳入索引。

## 已下线或归档的项目功能

- 旧版自研微信 Bot：代码与文档归档在 `archive/goal7-agent-v2-20260815`，不属于当前 `main` 架构。
- macOS 热点新闻每日任务：2026-10-02 已按要求取消并移除当前任务清单。
- macOS「22 小时未活动提醒」：2026-09-12 已下线。
- macOS 临时 Token 探针与微信链路心跳监控：2026-09-11 已下线。
- 其余历史状态以 [`ROADMAP.md`](../ROADMAP.md) 为准；此处不把删除记录当作当前可用功能。
