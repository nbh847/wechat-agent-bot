# WeChat Agent Bot 运行手册

## 运行前提

- 将项目克隆到本机任意固定路径。
- 使用 Node.js 22 以上版本；当前已验证 Node.js 24.15.0。
- 项目内提供 `scripts/codex-adapter.mjs` 和 `scripts/claude-adapter.mjs`；也可替换为其他经过权限审查、符合 `docs/architecture/agent-execution-protocol.md` 的适配器绝对路径。
- Claude Code 适配器需要 macOS `sandbox-exec`，并要求本机 Claude Code CLI 已登录。

## 构建与启动

当前操作仓库的 Agent 只负责按文档启动服务，不因此自动成为 Bot 的执行端。启动前先从下表选择一个本机已安装并登录的执行端：

| 执行端 | `WECHAT_AGENT_EXECUTABLE` |
| --- | --- |
| Claude Code | `$PWD/scripts/claude-adapter.mjs` |
| Codex | `$PWD/scripts/codex-adapter.mjs` |

标准启动流程如下，示例选择 Claude Code；切换执行端时只替换适配器路径：

```bash
cd /absolute/path/to/wechat-agent-bot
WECHAT_AGENT_EXECUTABLE="$PWD/scripts/claude-adapter.mjs" npm run service:start
npm run service:status
```

`service:start` 会先构建项目，无需单独执行 `npm run build`。其他 Agent 可以执行上述启动命令；若要作为 Bot 的执行端，必须先实现并验证符合 `docs/architecture/agent-execution-protocol.md` 的适配器，再将其绝对路径传给 `WECHAT_AGENT_EXECUTABLE`。不得把普通 Agent CLI 路径直接当作适配器路径。

健康状态为 `listening` 才表示微信长轮询已经启动。`service:start` 只在本机后台启动，不配置开机自启。

## 停止

```bash
cd /absolute/path/to/wechat-agent-bot
npm run service:stop
npm run service:status
```

正常停止后状态应为 `stopped`，`runtime-data/service/instance.lock` 应被释放。

## 首次登录与重新扫码

首次登录时，二维码写入 `runtime-data/ilink/login-qr.png`，文件权限为 `0600`。手机扫码并确认后，绑定凭证写入 `runtime-data/ilink/state.json`。

只要服务端没有明确判定凭证失效，启动和重连都复用现有凭证，不主动刷新。服务端明确返回 token 失效后，服务清除失效凭证并生成新二维码；不要手工编辑状态文件。

## 状态与日志

- 健康状态：`runtime-data/service/health.json`。
- 服务日志：`runtime-data/service/service.log`，单文件最多约 1 MB，最多保留当前文件和 3 个轮转文件。
- 任务状态：`runtime-data/tasks/state.json`。
- 上下文消息：`runtime-data/conversations/state.json`。
- 微信凭证、游标和待回复：`runtime-data/ilink/state.json`。

这些文件均属于本机运行数据，不提交、不复制到其他目录、不输出内容。是否清理由散帅决定。

## 数据保留

- 上下文消息：30 天，最多 30 个上下文，每个上下文最多 200 条消息。
- 已结束任务：90 天，最多 1000 条；运行中、排队和待确认任务不自动删除。
- 微信上下文 token：30 天，最多 100 个。
- 待发送回复：7 天，最多 1000 条。
- 消息去重 ID：最近 1000 个。
- 服务日志：单文件约 1 MB，保留当前文件和 3 个轮转文件。

登录凭证只在服务端明确判定失效时清理。待办、提醒和定时任务等业务数据按自身状态清理，不使用统一创建时间 TTL。

## 故障排查

### 第二个实例无法启动

运行 `npm run service:status`。若原进程仍存活，停止重复启动；若进程已不存在，下一次启动会自动回收失效锁。

### 服务显示 `stopped`

按“构建与启动”选择适配器并在同一条命令中设置 `WECHAT_AGENT_EXECUTABLE`，再运行 `service:start`。若刚执行过构建或系统重启，需要重新启动；当前未启用开机自启。

### 微信无回复

先检查健康状态是否为 `listening`，再检查任务 `status <task-id>`。普通网络错误会有限退避重试；不要通过启动第二实例解决。

### 凭证失效

等待服务生成新二维码并重新扫码。不得删除或手工修改凭证文件；若文件清理确有必要，必须先取得散帅确认。

### 任务在重启时运行

重启前处于 `running` 或 `queued` 的任务会标记为 `interrupted`，不会自动重跑。重新执行必须由散帅发送新任务。

## 开机自启

`docs/operations/launchd.md` 只保存可选方案，当前不安装、不启用。未来如需开机自启，必须先确认长期执行适配器，再取得散帅对具体系统配置操作的单独批准。
