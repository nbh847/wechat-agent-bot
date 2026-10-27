# 部署微信 Bot（Codex）

## Agent 概览

- 以 **Codex** 作为 `wechat-acp` 的 ACP Agent，形成链路：

  ```text
  微信私聊 → wechat-acp → Codex ACP Agent → wechat-agent-bot 工作区
  ```

- macOS 使用项目内修复版 `wechat-acp@0.10.0`；Win10 使用项目内固定安装的官方 `wechat-acp@0.10.0`。两台机器均通过 raw command 固定调用项目内 `@agentclientprotocol/codex-acp@2.2.2`，不使用该版本内置且已弃用的 `@zed-industries/codex-acp` preset。
- Bot 专用设置为 `model = "gpt-6-luna"`、`model_reasoning_effort = "max"`，通过适配器 `CODEX_CONFIG` 环境变量传入，不修改全局 Codex 设置。初始权限模式为 `workspace-write`。
- **状态：2026-10-17，macOS 的模型响应、后台切换与微信实收验收通过；Win10 的固定依赖、真实模型请求与后台轮询启动通过，微信实收待确认；两机实际 Bot 会话的项目规则读取和安全边界专项验收待补。**
- 同一个微信账号同一时间只能跑一个 `wechat-acp` daemon；在两个 agent 间切换前，必须先 `wechat-acp stop` 停掉旧 daemon（多 agent 共用的边界，详见 [codebuddy.md](codebuddy.md) 与 [claude.md](claude.md) 已核验部分）。

## macOS 部署

本节仅适用于当前 Mac，路径不可直接复制到 Win10。

本地依赖位于 `/Users/mac/workspace/wechat-agent-bot/runtime-data/codex-acp/`，适配器自带兼容 Codex CLI，实际版本由项目内 `package-lock.json` 固定。启动不使用 `npx` 下载包，沿用本机 Codex 登录与微信登录，不复制或输出凭据。当前 Node.js 为 `24.21.0`。

启动入口：

```bash
bash /Users/mac/workspace/wechat-agent-bot/scripts/wechat-acp/start-codex-daemon.sh
```

入口先核对既有微信修复构建指纹、Codex 适配器与配置指纹、单实例和微信登录文件存在性，再启动后台 daemon；保留 `--hide-thoughts`，不注册开机自启。配置位于 `/Users/mac/workspace/wechat-agent-bot/scripts/wechat-acp/codex-config.json`，本地指纹位于同目录 `codex-manifest.json`。这些文件受项目忽略规则保护，不进入 Git。

日常只读状态查询：

```bash
node /Users/mac/workspace/wechat-agent-bot/runtime-data/vendor/wechat-acp/dist/bin/wechat-acp.js status
```

切换 Agent 前必须精确确认 PID 属于本项目的固定构建，再执行下列停止命令，并等待该 Bot 与所属 Agent 子进程退出；不得只看到 stop 成功就启动另一个实例。进程检查需要具备系统进程读取权限，受限沙箱中的 status 可能将权限错误误判为 stale PID，不能用其判断真实存活状态。

```bash
node /Users/mac/workspace/wechat-agent-bot/runtime-data/vendor/wechat-acp/dist/bin/wechat-acp.js stop
```

恢复 Claude：确认 Codex Bot 已完全退出后，执行 `/Users/mac/workspace/wechat-agent-bot/scripts/wechat-acp/start-claude-daemon.sh`。切换不删除旧会话或登录数据，默认新建所选 Agent 的会话，不承诺继承 Claude 对话上下文。智谱任务继续使用相同的 bridge 注入入口。

隔离验证入口（真实模型请求，不发送微信）：

```bash
python3 /Users/mac/workspace/wechat-agent-bot/scripts/wechat-acp/verify-codex.py
```

该验证读取 ACP 会话返回的实际模型与推理强度，再检查真实提示响应；拒绝工具权限请求，结束时清理测试进程组。验证摘要写入 `.tmp/codex-integration/verification.json`，不保存凭据或完整对话。

权限边界：`workspace-write` 不代表全部敏感操作均有技术保护。现有 bridge 仍会自动选择 ACP 允许选项，必须继续遵守项目对话确认规则。

### 2026-10-17 09:31 推理强度更新（仅 macOS）

- 按火球要求由 `medium` 改为 `max`，模型仍为 `gpt-6-luna`；专用配置、本地指纹和验证脚本已同步，不修改全局 Codex 配置。
- 隔离 ACP 会话返回 `gpt-6-luna[max]`、`reasoning_effort=max`，真实提示响应匹配且正常 `end_turn`。
- 旧 Codex Bot PID `28593` 及所属 15 个后代进程退出后，重新通过固定入口启动 PID `33846`；构建／配置指纹、单实例、工作目录与 `--hide-thoughts` 检查通过。
- 重启后确认微信登录复用、轮询启动，无新增 Fatal、会话过期或轮询错误；本轮未发送微信测试消息，`max` 重启后的微信实收待确认。

### 2026-10-17 首次接入验证记录（仅 macOS，当时为 medium）

- 本地适配器 `2.2.2` 与其 Codex CLI `0.160.1` 已安装，启动不依赖全局 CLI `0.159.2`。
- ACP initialize／session/new 返回 `gpt-6-luna[medium]`，配置选项分别为 `model=gpt-6-luna`、`reasoning_effort=medium`、`mode=workspace-write`；真实提示响应匹配且正常结束。
- 原 Claude 运行时，Codex 启动入口按预期拒绝重复启动。旧 Claude Bot PID `88657` 及两个子进程退出后，Codex Bot PID `28593` 启动；确认单实例、专用配置、本项目工作目录与 `--hide-thoughts`。
- 新增日志范围的脱敏标记确认微信登录复用、消息轮询启动，无 Fatal、会话过期或轮询错误；这只反映本次检查时状态。
- 微信发送与待取回相关 10 项回归通过，Shell／Python 语法检查通过。火球随后确认 Codex 微信验收通过；实际 Bot 会话的规则读取与安全边界专项验收尚待完成。

## Win10 部署

本节仅适用于 Win10。固定依赖安装在 `runtime-data/codex-acp/`，启动脚本为 `scripts/wechat-acp/start-codex-daemon.ps1`，配置为同目录 `codex-config.win10.json`。这些路径均被项目忽略，不进入 Git；登录数据继续位于 `%USERPROFILE%\.wechat-acp` 与 `%USERPROFILE%\.codex`，不得复制到仓库或另一台机器。

项目内安装命令：

```powershell
& "$env:ProgramFiles\nodejs\npm.cmd" install --prefix "runtime-data\codex-acp" --save-exact wechat-acp@0.10.0 @agentclientprotocol/codex-acp@2.2.2 @openai/codex@0.163.0
```

不要使用 `wechat-acp@0.10.0 --agent codex`：该内置 preset 实际调用已弃用的 `@zed-industries/codex-acp`。Win10 启动脚本改用 raw command，直接运行固定安装的维护版适配器，并通过 `CODEX_PATH` 指向同目录顶层的 `@openai/codex@0.163.0`；不使用适配器嵌套的旧 CLI，也不依赖全局 CLI 版本。

前台首次验收：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\wechat-acp\start-codex-daemon.ps1" -Foreground
```

前台完成微信实收、工作目录、规则读取和安全边界验收后，按 `Ctrl+C` 停止，再启动后台 daemon：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\wechat-acp\start-codex-daemon.ps1"
```

脚本固定注入 `CODEX_CONFIG={"model":"gpt-6-luna","model_reasoning_effort":"max"}`、指向项目内 `@openai/codex@0.163.0` 的 `CODEX_PATH` 与 `INITIAL_AGENT_MODE=workspace-write`，保留 `--hide-thoughts`，不修改全局 Codex 设置，不创建计划任务或开机自启。日常状态与停止命令使用项目内固定 CLI：

```powershell
node ".\runtime-data\codex-acp\node_modules\wechat-acp\dist\bin\wechat-acp.js" status
node ".\runtime-data\codex-acp\node_modules\wechat-acp\dist\bin\wechat-acp.js" stop
```

Win10 子进程清理风险见官方 [Issue #71](https://github.com/formulahendry/wechat-acp/issues/71)。停止后必须按 PID 与完整命令行确认 `wechat-acp`、`codex-acp` 及其 Codex 子进程均退出；不得按进程名批量结束全部 `node.exe`。

### 2026-10-17 Win10 接入验证记录

- 项目内固定安装 `wechat-acp@0.10.0` 与 `@agentclientprotocol/codex-acp@2.2.2`；启动入口校验文件存在、精确版本和专用配置，配置漂移时直接失败。
- 使用适配器自带 Codex CLI，以 `gpt-6-luna`、`model_reasoning_effort=max`、只读沙箱和临时会话发起真实模型请求，响应成功；该验证不发送微信，也不修改全局 Codex 配置。
- 后台 daemon 已由固定入口启动，进程命令行确认本项目工作目录、维护版 Codex ACP raw command 与 `--hide-thoughts`，微信登录复用并开始轮询；无新增启动错误。
- 本轮未主动发送微信测试消息。微信实收、实际 ACP Bot 会话中的工作目录／规则读取和安全边界仍待火球从微信发消息验收；未配置开机自启。

### 2026-10-20 Excel 连接器兼容性修复（仅 Win10）

- Bot 原固定 Codex CLI `0.160.1` 调用 `cua_repl` 的最小 `cua.getState()` 时，受信任 Node 进程退出并重置内核；同机全局 Codex CLI `0.163.0` 执行相同调用成功。
- 项目内新增固定 `@openai/codex@0.163.0`，启动脚本校验其精确版本并通过 `CODEX_PATH` 显式交给 `codex-acp@2.2.2`；隔离只读会话以 `gpt-6-luna`／`max` 调用 `cua.getState()` 返回 `CUA_INIT_OK`。Bot 重启为 PID `1856`，登录复用、消息轮询恢复且无启动 Fatal；未发送微信测试消息。
- 同日 22:38，确认项目 `.agents` 根目录所有者异常为 `CodexSandboxOffline`，导致 Windows `workspace-write` 沙箱写入 deny ACE 时因缺少 `WRITE_DAC` 而无法启动本地命令执行器。按火球授权，仅将该根目录所有者非递归改回 `DESKTOP-OKVTB4N\ronnie`，未修改目录内容；Bot 重启为 PID `20280` 后，隔离 `workspace-write` 会话执行 `Write-Output LOCAL_EXEC_OK` 成功。

### Google Calendar 插件（仅 Win10）

- 2026-10-18 通过 Codex 官方市场安装 `google-calendar@openai-curated-remote` `1.2.7`，由火球本人完成 Google OAuth；凭据不进入项目文件。
- 官方插件安装到用户级 Codex 环境，安装后须新开 Codex 会话加载工具。全局 Codex CLI `0.163.0` 与本项目固定 Codex CLI `0.160.1` 均以临时只读会话成功调用 `codex_apps/google_calendar.list_calendars`，测试未创建、修改或删除事件，也未输出日程正文。
- 2026-10-18 17:26 按火球授权重启 Win10 微信 Bot：旧 PID `17364` 的项目进程树完整退出后，由固定入口启动 PID `19636`；登录复用、微信轮询恢复，启动段无 Fatal。微信端自然语言触发与实收尚未单独验收。涉及创建、修改或删除日程时，继续遵守项目的外部写入与确认规则。

## 完成标准

- 本机依赖和构建指纹通过，ACP initialize／session/new 成功。
- ACP 返回实际模型 `gpt-6-luna`、推理强度 `max`，真实模型响应通过。
- 旧 Bot 完全退出，新 Codex Bot 单实例运行并开始微信轮询。
- 微信实收、工作目录／规则读取与安全边界专项消息分别验收。
- Win10 独立验证，不沿用 macOS 结论。

## 官方来源

- [wechat-acp 官方仓库](https://github.com/formulahendry/wechat-acp)
- [wechat-acp v0.10.0](https://github.com/formulahendry/wechat-acp/releases/tag/v0.10.0)
- [OpenAI GPT-6 Luna 模型与推理强度](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [wechat-acp npm 包](https://www.npmjs.com/package/wechat-acp/v/0.10.0)
- [Codex ACP 维护仓库与环境配置](https://github.com/agentclientprotocol/codex-acp/tree/v2.2.2)
- [OpenAI Codex 配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)
