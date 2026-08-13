# WeChat Agent Bot

WeChat Agent Bot 是一个运行在本地的常驻服务：通过微信接收散帅发送的指令，将任务交给本地可用的 AI Agent 执行，再把结果回复到对应的微信会话。

项目不绑定 Codex、Claude Code 或其他具体 Agent。微信通道采用 iLink Bot API，服务实现采用 TypeScript + Node.js；最小文本通道已经完成实现与验证，Agent 调度、权限控制和系统常驻运行尚未实现。

## 当前状态

- Goal 1 已由散帅完成人工验收，Goal 2“安全任务入口与确认协议”进行中。
- 当前仅支持扫码登录、会话恢复以及文本接收和 Echo 回复。
- 微信绑定凭证保存在 `runtime-data/ilink/state.json`，有效期间持续复用；只有服务端明确返回 token 失效时才要求重新扫码，不做主动或定期刷新。
- 开发严格按 `docs/plans/development-goals.md` 串行推进；Goal 2 完成后仍需散帅人工验收，未通过前不开始 Goal 3。

## 当前不做

- 不接入或启动 AI Agent，不执行微信下发的本机任务。
- 不配置系统常驻服务，不支持多账号、群聊和媒体消息。
- 不以公开部署或多用户 SaaS 为默认目标。

## 文档入口

- `AGENTS.md`：Codex 项目规则。
- `CLAUDE.md`：Claude Code 项目规则。
- `ROADMAP.md`：项目阶段、待办和最近验证。
- `docs/research/README.md`：调研主题、材料规范和结论状态。
- `docs/decisions/001-ilink-channel-implementation.md`：微信通道实现决策。
- `docs/plans/development-goals.md`：串行开发 Goal、验收标准和推进规则。

## 目录约定

后续目录必须在对应需求确认后再建立：

- `docs/research/`：调研记录与方案比较。
- `docs/decisions/`：散帅已确认的重要技术与产品决策；编号按确认顺序递增。
- `docs/plans/`：实施计划与阶段 Goal；完成状态以 `ROADMAP.md` 为准。
- `runtime-data/`：登录凭证、同步游标等本机运行数据；禁止提交，是否清理由散帅决定。
- `src/`：项目源码；当前只包含 iLink 最小文本通道和 CLI。
- `tests/`：与当前 Goal 验收标准直接相关的自动化测试。

文件名使用小写英文和连字符。临时材料不得提交到项目目录；需要保留的材料应整理为调研文档。清理文件或目录前必须取得散帅确认。
