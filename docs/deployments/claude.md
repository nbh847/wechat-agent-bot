# 部署微信 Bot（Claude）

## Agent 概览

- 以 **Claude Code** 作为 `wechat-acp` 的 ACP Agent，形成链路：

  ```text
  微信私聊 → wechat-acp → Claude ACP Agent → wechat-agent-bot 工作区
  ```

- 使用 `wechat-acp@0.10.0` 内置 `claude` preset：`@agentclientprotocol/claude-agent-acp`。`claude` preset 会通过 npm 启动该 ACP 适配器，**不是**直接把普通 Claude 交互终端当作 ACP Agent；不要自行改成其他 raw command。
- 前置：目标机器已安装 Claude Code（提供 `claude` 命令），Node.js ≥ 22（当前 Claude ACP 适配器要求）。
- 规则读取：Claude Code 先读 `CLAUDE.md`，再按其指引读 `AGENTS.md`、`ROADMAP.md`。
- 已知限制：多实例双消费会造成重复回复；Windows 下存在子进程清理风险（见各平台故障排查）。

同一个微信账号同一时间只能跑一个 `wechat-acp` daemon；在两个 agent（Claude ↔ CodeBuddy）间切换前，必须先 `wechat-acp stop` 停掉旧 daemon。

---

## macOS 部署

### 目标与边界

本文供 macOS 上的 Agent 执行，用 Claude 部署基础微信 Bot。只部署基础链路，不迁移 Windows 的定时任务，不配置 macOS 开机自启，不复制其他机器的微信登录凭据。

登录 token 写在 `~/.wechat-acp/token.json`。**若本机已存在有效 token（例如此前用 CodeBuddy 部署过同一微信 Bot），启动会直接复用，无需扫码。** 仅当 token 失效或首次部署时才需扫码。

以下命令假设 `cd /Users/mac/workspace/wechat-agent-bot`（其他机器替换为实际路径）。

### 1. 只读前提检查

```bash
git status --short --branch
git remote -v
git log -1 --oneline --decorate
claude --version
node --version
npx --version
```

通过标准：

- 当前目录是本仓库根目录。
- 工作区没有未提交改动；如果有，停止部署并向散帅报告具体文件，不覆盖。
- `claude --version` 正常输出版本；Node.js 不低于 22。

如果 Claude 未安装、未登录或 Node.js 低于 22，只报告缺口。安装、登录或升级会改变软件／登录状态，必须另行说明并等待散帅确认；不得直接执行。

### 2. 同步远程项目

```bash
git pull --ff-only
git status --short --branch
git log -1 --oneline --decorate
```

通过标准：本地分支与 `origin/main` 一致，工作区干净。若仓库尚未克隆，先让散帅确认目标目录，再 `git clone`。

### 3. 核验 wechat-acp CLI 与 Claude ACP 入口

```bash
npx -y wechat-acp@0.10.0 --version
npx -y wechat-acp@0.10.0 agents
```

通过标准：

- 版本输出为 `0.10.0`。
- agent 列表包含 `claude`。

若本机已全局安装 `wechat-acp`，也可直接 `wechat-acp` 或绝对路径 `/Users/mac/node_modules/.bin/wechat-acp` 代替 `npx -y wechat-acp@0.10.0`。

### 4. 首次启动与登录

执行前必须向散帅说明具体动作、影响范围、潜在风险与恢复方式，并取得一次性明确确认。确认后在仓库根目录执行。

macOS 推荐的启动方式（散帅实际用法）：命令**不带 `--cwd`，依赖当前工作目录**，因此必须先 `cd` 到仓库根目录；`--hide-thoughts` 让 wechat-acp 不在微信端转发 Agent 的思考过程。

```bash
cd /Users/mac/workspace/wechat-agent-bot
npx -y wechat-acp@latest --agent claude --hide-thoughts
```

备选（锁版本 + 显式工作目录 + `--hide-thoughts`，适合需要固定版本的多机/生产环境）：

```bash
RepoRoot=$(pwd)
npx -y wechat-acp@0.10.0 --agent claude --cwd "$RepoRoot" --hide-thoughts
```

随后：

1. 若终端出现二维码，让散帅用微信扫描；若直接显示 `Starting message polling...` 说明已复用 token，无需扫码。
2. 不复制其他机器的 `.wechat-acp` 目录和 token。
3. 保持前台进程运行，先完成下一步验收。

若 Claude 登录失效导致 ACP session 创建失败，停止进程并报告错误摘要；不得读取或输出完整凭据，不得擅自重新登录。

### 5. 微信端验收

按顺序从微信发送以下消息，每条等待完整回复：

```text
你当前的工作目录是什么？只回复绝对路径。
```

预期：回复本机仓库绝对路径 `/Users/mac/workspace/wechat-agent-bot`。

```text
请按顺序列出本项目要求你读取的规则文件，只列文件名，不执行其他操作。
```

预期至少包含：`README.md`、`CLAUDE.md`、`AGENTS.md`、`ROADMAP.md`。

```text
如果我要你删除文件，你应该在执行前做什么？只回答规则，不要执行。
```

预期：先说明具体动作、目标、风险、影响和恢复方式，并等待散帅明确确认。

```text
只回复：macOS Claude 微信 Bot 基础链路验证通过
```

预期：微信收到完全一致的文本。

验收期间同时观察终端，不能出现 ACP 初始化失败、持续重连、重复回复或进程退出。

### 6. 切换后台 daemon

基础验收通过后，`Ctrl+C` 停止前台进程。后台 daemon 属于常驻进程，启动前必须再次向散帅说明风险并取得一次性确认，随后执行。

macOS 推荐的 daemon 启动（散帅实际命令；不带 `--cwd`，需先 `cd` 到仓库根目录；`--hide-thoughts` 不转发思考）：

```bash
cd /Users/mac/workspace/wechat-agent-bot
npx -y wechat-acp@latest --agent claude --hide-thoughts --daemon
npx -y wechat-acp status
```

备选（锁版本 + 显式工作目录 + `--hide-thoughts`，适合多机/生产）：

```bash
RepoRoot=$(pwd)
npx -y wechat-acp@0.10.0 --agent claude --cwd "$RepoRoot" --hide-thoughts --daemon
npx -y wechat-acp status
```

通过标准：`status` 显示 daemon 正在运行。随后再从微信发一条：

```text
只回复：macOS Claude daemon 验证通过
```

微信收到完全一致的回复后，基础部署才算完成。

### 日常操作（macOS）

```bash
npx -y wechat-acp status            # 查看状态
npx -y wechat-acp stop              # 停止 daemon
```

强制重新扫码会替换登录状态，必须先取得散帅确认：

```bash
npx -y wechat-acp@latest --agent claude --hide-thoughts --cwd /Users/mac/workspace/wechat-agent-bot --login
```

不要在本文部署中创建 macOS 开机自启或 launchd 常驻项；启用系统常驻启动项属于系统配置变更，必须作为独立任务说明风险并取得确认。

### 故障排查（macOS）

- `claude` 命令不可用：仅执行 `claude --version` 收集非敏感摘要；不要重装 Claude，向散帅报告 PATH 或安装健康检查结果。
- `wechat-acp` 不在 PATH：用 `npx -y wechat-acp@0.10.0 ...` 或绝对路径 `/Users/mac/node_modules/.bin/wechat-acp ...` 代替。
- Node.js 版本不足：Claude ACP 适配器当前要求 Node.js ≥ 22；不要自行升级，报告当前版本并等待确认。
- ACP session 创建失败：依次核对 `npx -y wechat-acp@0.10.0 agents` 是否包含 `claude`、仓库路径是否真实且用双引号包裹、终端错误摘要指向 Claude 认证/网络/ACP 入口。
- 微信没有回复：`npx -y wechat-acp@0.10.0 status`；若 daemon 未运行先报告，不擅自启动。
- 重复回复或登录冲突：确认 macOS 只有一个 `wechat-acp` daemon，确认没有从其他机器复制 `.wechat-acp` 登录目录；先 `wechat-acp stop` 停当前 daemon 再报告，不删除 token。

不要输出 token、二维码内容、环境变量值或完整敏感日志。

---

## Win10 部署

### 目标与边界

Win10 可用 Claude 作为同一个微信 Bot 的 ACP Agent。整体流程与 macOS 的 Claude 部署一致，差异为 Windows 命令与路径；以下仍按完整步骤给出。

登录 token 写在 `%USERPROFILE%\.wechat-acp`。若本机已用 CodeBuddy 部署过同一微信账号，token 可复用，无需重新扫码。

### 1. 只读前提检查

在 PowerShell 中进入仓库根目录：

```powershell
Set-Location "D:\workspace\wechat-agent-bot"
git status --short --branch
git remote -v
git log -1 --oneline --decorate
claude --version
claude doctor
node --version
npm --version
npx --version
```

通过标准：

- 当前目录是本仓库根目录。
- 工作区没有未提交改动；如果有，停止部署并向散帅报告具体文件，不覆盖。
- 远程仓库是 `https://github.com/nbh847/wechat-agent-bot.git`。
- `claude --version` 正常输出版本，`claude doctor` 没有阻塞错误。
- Node.js 不低于 22。虽然 `wechat-acp` 本身只要求 Node.js 20，但当前 Claude ACP 适配器要求 Node.js ≥ 22。

如果 Claude 未安装、未登录或 Node.js 低于 22，只报告缺口。安装、登录或升级会改变软件／登录状态，必须另行说明并等待散帅确认；不得直接执行。

### 2. 同步远程项目

```powershell
git pull --ff-only
git status --short --branch
git log -1 --oneline --decorate
```

通过标准：本地分支与 `origin/main` 一致，工作区干净。若仓库尚未克隆，先让散帅确认目标目录，再 `git clone`。

### 3. 核验 wechat-acp CLI

```powershell
npx -y wechat-acp@0.10.0 --version
npx -y wechat-acp@0.10.0 agents
npm view @agentclientprotocol/claude-agent-acp version engines --json
```

通过标准：

- 版本输出为 `0.10.0`。
- agent 列表包含 `claude`。
- Claude ACP 适配器版本仍为 `0.69.0`，Node.js 要求仍为 `>=22`。如果版本或要求变化，停止部署并向散帅报告，不按旧文档继续。

`claude` preset 会通过 npm 启动 `@agentclientprotocol/claude-agent-acp`，不是直接把普通 Claude 交互终端当作 ACP Agent。不要自行改成其他 raw command。

### 4. 首次启动与登录

首次启动会展示微信二维码，并把 token、同步状态、日志和收件箱数据写入 `%USERPROFILE%\.wechat-acp`。执行前必须向散帅说明风险并取得一次性明确确认，随后在仓库根目录执行：

```powershell
$RepoRoot = (Get-Location).Path
npx -y wechat-acp@0.10.0 --agent claude --cwd "$RepoRoot"
```

随后：

1. 让散帅使用微信扫描终端二维码（或复用已有 token）。
2. 不复制 macOS 或其他机器的 `.wechat-acp` 目录和 token。
3. 保持 PowerShell 前台进程运行，先完成下一步验收。

若 Claude 登录失效导致 ACP session 创建失败，停止进程并报告错误摘要；不得读取或输出完整凭据，不得擅自重新登录。

### 5. 微信端验收

按顺序从微信发送以下消息，每条等待完整回复：

```text
你当前的工作目录是什么？只回复绝对路径。
```

预期：回复 Win10 上本仓库的绝对路径。

```text
请按顺序列出本项目要求你读取的规则文件，只列文件名，不执行其他操作。
```

预期至少包含：`README.md`、`CLAUDE.md`、`AGENTS.md`、`ROADMAP.md`。

```text
如果我要你删除文件，你应该在执行前做什么？只回答规则，不要执行。
```

预期：先说明具体动作、目标、风险、影响和恢复方式，并等待散帅明确确认。

```text
只回复：Win10 Claude 微信 Bot 基础链路验证通过
```

预期：微信收到完全一致的文本。

验收期间同时观察终端，不能出现 ACP 初始化失败、持续重连、重复回复或进程退出。

### 6. 切换后台 daemon

基础验收通过后，`Ctrl+C` 停止前台进程。后台 daemon 属于常驻进程，启动前必须再次向散帅说明风险并取得一次性确认，随后执行：

```powershell
$RepoRoot = (Get-Location).Path
npx -y wechat-acp@0.10.0 --agent claude --cwd "$RepoRoot" --daemon
npx -y wechat-acp@0.10.0 status
```

通过标准：`status` 显示 daemon 正在运行。随后再从微信发一条：

```text
只回复：Win10 Claude daemon 验证通过
```

微信收到完全一致的回复后，基础部署才算完成。

### 日常操作（Win10）

```powershell
npx -y wechat-acp@0.10.0 status     # 查看状态
npx -y wechat-acp@0.10.0 stop       # 停止 daemon
```

强制重新扫码需先确认：`npx -y wechat-acp@0.10.0 --agent claude --cwd "D:\workspace\wechat-agent-bot" --login`。

不要在本文部署中创建 Windows 计划任务或开机自启。

### 故障排查（Win10）

- `claude` 命令不可用：仅执行 `claude --version` 和 `claude doctor` 收集非敏感摘要；不要重装 Claude，向散帅报告 PATH 或安装健康检查结果。
- Node.js 版本不足：Claude ACP 适配器当前要求 Node.js ≥ 22；不要自行升级，报告当前版本并等待确认。
- ACP session 创建失败：依次核对 `claude doctor` 是否有阻塞错误、`npx -y wechat-acp@0.10.0 agents` 是否包含 `claude`、仓库路径是否真实且用双引号包裹、终端错误摘要指向 Claude 认证/网络/ACP 适配器。
- 微信没有回复：`npx -y wechat-acp@0.10.0 status`；若 daemon 未运行先报告，不擅自启动。
- 重复回复或登录冲突：确认 Win10 只有一个 daemon、没有从其他机器复制 `.wechat-acp`；先 `wechat-acp stop` 再报告。
- Windows 子进程清理风险：`wechat-acp` 存在 Windows 边缘问题——自定义 Agent 脱离 shell wrapper 派生后台子进程，wrapper 退出后可能残留后代进程。官方记录见 [Issue #71](https://github.com/formulahendry/wechat-acp/issues/71)。固定使用官方 `claude` preset、不添加自定义后台 wrapper 可规避。

不要输出 token、二维码内容、环境变量值或完整敏感日志。

---

## 完成标准

只有同时满足以下条件，才向散帅报告部署完成：

- 本地仓库与 `origin/main` 一致且工作区干净。
- Claude 与 Node.js 前提检查通过。
- `wechat-acp@0.10.0` 和 `claude` preset 核验通过。
- 微信扫码/复用 token、工作目录、规则读取、安全边界和消息回传全部通过。
- daemon 获得单独确认后启动，`status` 正常；daemon 模式下的微信回传验证通过。
- 没有复制、输出或删除任何登录凭据。

如果任一项未完成，明确报告“部署未完成”以及阻塞点，不得把部分成功写成完成。

## 官方来源

- [wechat-acp 官方仓库](https://github.com/formulahendry/wechat-acp)
- [wechat-acp v0.10.0](https://github.com/formulahendry/wechat-acp/releases/tag/v0.10.0)
- [wechat-acp npm 包](https://www.npmjs.com/package/wechat-acp/v/0.10.0)
- [Claude Agent ACP npm 包](https://www.npmjs.com/package/@agentclientprotocol/claude-agent-acp)
- [Claude Code 官方 Windows 安装与系统要求](https://code.claude.com/docs/en/setup)