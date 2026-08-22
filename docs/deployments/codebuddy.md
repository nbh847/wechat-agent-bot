# 部署微信 Bot（CodeBuddy）

## Agent 概览

- 以 **CodeBuddy Code** 作为 `wechat-acp` 的 ACP Agent，形成链路：

  ```text
  微信私聊 → wechat-acp → CodeBuddy ACP Agent → wechat-agent-bot 工作区
  ```

- `wechat-acp@0.10.0` **没有内置 `codebuddy` preset**，必须用 raw command `--agent "codebuddy --acp"`，不要写 `--agent codebuddy`。
- 前置：目标机器已安装 CodeBuddy（提供 `codebuddy` 命令且支持 ACP）。用 `codebuddy --version` 与 `codebuddy --help | grep -i acp`（Win 用 `findstr`）核验；若未安装或没有 `--acp`，只报告缺口，不擅自安装。
- 规则读取：CodeBuddy 读取全局 `CODEBUDDY.md`（已内嵌本项目规则）与 `AGENTS.md`，无需 `CLAUDE.md`。
- 已知限制：`_codebuddy.ai/command` ACP 方法未实现（slash 类扩展受限，核心收发链路正常）；多实例双消费会造成重复回复。

同一个微信账号同一时间只能跑一个 `wechat-acp` daemon；在两个 agent（Claude ↔ CodeBuddy）间切换前，必须先 `wechat-acp stop` 停掉旧 daemon。

---

## macOS 部署

### 目标与边界

本文供 macOS 上的 Agent 执行，用 CodeBuddy 部署基础微信 Bot。只部署基础链路，不迁移 Windows 的定时任务，不配置 macOS 开机自启，不复制其他机器的微信登录凭据。

以下命令按本机实际路径执行；其他机器替换为实际路径。

### 1. 只读前提检查

```bash
cd /Users/mac/workspace/wechat-agent-bot
git status --short --branch
git remote -v
git log -1 --oneline --decorate
codebuddy --version
codebuddy --help | grep -i acp
node --version
npx --version
```

通过标准：

- 当前目录是本仓库根目录。
- 工作区没有未提交改动；如果有，停止部署并向散帅报告具体文件，不覆盖。
- `codebuddy --version` 正常输出版本；`codebuddy --help | grep -i acp` 至少能看到 `--acp`。
- Node.js 版本不低于 22。

如果 CodeBuddy 未安装、未提供 `--acp`，或 Node.js 低于 22，只报告缺口。安装、登录或升级会改变软件／登录状态，必须另行说明并等待散帅确认；不得直接执行。

### 2. 同步远程项目

```bash
git pull --ff-only
git status --short --branch
git log -1 --oneline --decorate
```

通过标准：本地分支与 `origin/main` 一致，工作区干净，能读取本文及根目录必读文件。

若仓库尚未克隆，先让散帅确认目标目录，再 `git clone`。

### 3. 核验 wechat-acp CLI 与 CodeBuddy ACP 入口

```bash
npx -y wechat-acp@0.10.0 --version
npx -y wechat-acp@0.10.0 agents
codebuddy --acp --acp-transport stdio --help 2>&1 | head -5
```

通过标准：

- 版本输出为 `0.10.0`。
- `agents` 列表**不包含** `codebuddy`（确认需走 raw command）。
- `codebuddy --acp` 可正常解析（ACP 入口可用）。

若本机已全局安装 `wechat-acp`，也可直接 `wechat-acp` 或绝对路径 `/Users/mac/node_modules/.bin/wechat-acp` 代替 `npx -y wechat-acp@0.10.0`。

### 4. 首次启动与登录

登录 token 写在 `~/.wechat-acp/token.json`。**若本机已存在有效 token（例如此前用 Claude 部署过同一微信 Bot），启动会直接复用，无需扫码。** 仅当 token 失效或首次部署时才需扫码。

执行前必须向散帅说明具体动作、影响范围、潜在风险与恢复方式，并取得一次性明确确认。确认后在仓库根目录执行。

macOS 推荐的启动方式（散帅实际用法）：raw command **必须带 `--acp`**（`--agent "codebuddy --acp"`），写裸词 `--agent codebuddy` 会启动 CodeBuddy 普通交互终端、ACP 握手失败、消息无反应。该命令**不带 `--cwd`，依赖当前工作目录**，因此必须先 `cd` 到仓库根目录；`--hide-thoughts` 让 wechat-acp 不在微信端转发 Agent 的思考过程。

```bash
cd /Users/mac/workspace/wechat-agent-bot
npx -y wechat-acp@latest --agent "codebuddy --acp" --hide-thoughts
```

备选（锁版本 + 显式工作目录 + `--hide-thoughts`，适合需要固定版本的多机/生产环境）：

```bash
RepoRoot=$(pwd)
npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot" --hide-thoughts
```

随后：

1. 若终端出现二维码，让散帅用微信扫描；若直接显示 `Starting message polling...` 说明已复用 token，无需扫码。
2. 不复制其他机器的 `.wechat-acp` 目录和 token。
3. 保持前台进程运行，先完成下一步验收。

若 CodeBuddy 登录失效导致 ACP session 创建失败，停止进程并报告错误摘要；不得读取或输出完整凭据，不得擅自重新登录。

### 5. 微信端验收

按顺序从微信发送以下消息，每条等待完整回复：

```text
请只运行 pwd 命令，把输出原样告诉我当前工作目录是什么。
```

预期：回复本机仓库绝对路径 `/Users/mac/workspace/wechat-agent-bot`。

```text
请阅读本仓库 AGENTS.md，列出其中「敏感操作确认」一节要求哪些操作必须先说明并等待一次性确认（至少列 4 类）。
```

预期至少包含：删除/移动文件、修改 .env/密钥/token、数据库 schema 变更、安装全局依赖、Git push/release、Cloudflare 操作。

```text
如果我要你删除项目里的 ROADMAP.md，你应该在执行前做什么？只回答规则，不要执行。
```

预期：先说明具体动作、目标、风险、影响和恢复方式，并等待散帅明确确认；不乱删文件。

```text
只回复：macOS CodeBuddy 微信 Bot 基础链路验证通过
```

预期：微信收到完全一致的文本。

验收期间同时观察终端，不能出现 ACP 初始化失败、持续重连、重复回复或进程退出。

### 6. 切换后台 daemon

基础验收通过后，`Ctrl+C` 停止前台进程。后台 daemon 属于常驻进程，启动前必须再次向散帅说明风险并取得一次性确认，随后执行。

通过标准：`status` 显示 daemon 正在运行。macOS 推荐的 daemon 启动（散帅实际命令）：

```bash
cd /Users/mac/workspace/wechat-agent-bot
npx -y wechat-acp@latest --agent "codebuddy --acp" --hide-thoughts --daemon
npx -y wechat-acp status
```

备选（锁版本 + 显式工作目录 + `--hide-thoughts`，适合多机/生产）：

```bash
RepoRoot=$(pwd)
npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot" --hide-thoughts --daemon
npx -y wechat-acp status
```

随后再从微信发一条：

```text
只回复：macOS CodeBuddy daemon 验证通过
```

微信收到完全一致的回复后，基础部署才算完成。

### 日常操作（macOS）

```bash
npx -y wechat-acp status            # 查看状态
npx -y wechat-acp stop              # 停止 daemon
```

强制重新扫码会替换登录状态，必须先取得散帅确认：

```bash
npx -y wechat-acp@latest --agent "codebuddy --acp" --hide-thoughts --cwd /Users/mac/workspace/wechat-agent-bot --login
```

不要在本文部署中创建 macOS 开机自启或 launchd 常驻项；启用系统常驻启动项属于系统配置变更，必须作为独立任务说明风险并取得确认。

### 故障排查（macOS）

- `codebuddy` 命令不可用或没有 `--acp`：仅执行 `codebuddy --version` 和 `codebuddy --help | grep -i acp` 收集非敏感摘要；不要重装 CodeBuddy，向散帅报告 PATH 或安装健康检查结果。
- `wechat-acp` 不在 PATH：用 `npx -y wechat-acp@0.10.0 ...` 或绝对路径 `/Users/mac/node_modules/.bin/wechat-acp ...` 代替。
- Node.js 版本不足：CodeBuddy ACP 当前要求 Node.js ≥ 22；不要自行升级，报告当前版本并等待确认。
- ACP session 创建失败：依次核对 `codebuddy --acp` 能否解析、`npx -y wechat-acp@0.10.0 agents` 是否不含 `codebuddy`（确认走 raw command）、仓库路径是否真实且用双引号包裹、终端错误摘要指向 CodeBuddy 认证/网络/ACP 入口。
- 微信没有回复：`npx -y wechat-acp@0.10.0 status`；若 daemon 未运行先报告，不擅自启动。
- 重复回复或登录冲突：确认 macOS 只有一个 `wechat-acp` daemon，确认没有从其他机器复制 `.wechat-acp` 登录目录；先 `wechat-acp stop` 停当前 daemon 再报告，不删除 token。

不要输出 token、二维码内容、环境变量值或完整敏感日志。

---

## Win10 部署

### 目标与边界

除 macOS 外，Win10 也可用 CodeBuddy 作为同一个微信 Bot 的 ACP Agent。整体流程与 macOS 的 CodeBuddy 部署一致，差异为 Windows 命令与路径；以下仍按完整步骤给出。

> **状态**：Win10 + CodeBuddy 组合**尚未在 Win10 实机跑通**，目前仅 macOS 端已完成端到端验收。Win10 实装并通过验收后，再回填本段验收结论，不要提前写成已验证。

登录 token 写在 `%USERPROFILE%\.wechat-acp`。若本机已用 Claude 部署过同一微信账号，token 可复用，无需重新扫码；但同一账号同一时间只能跑一个 daemon，从 Claude 切到 CodeBuddy 前必须先 `wechat-acp stop` 停掉旧 daemon。

### 1–6（Win10）

以下步骤在 PowerShell 中执行，`$RepoRoot = (Get-Location).Path` 代表仓库根目录：

- 前提检查：`git status --short --branch`、`git remote -v`、`git log -1 --oneline --decorate`、`codebuddy --version`、`codebuddy --help | findstr acp`、`node --version`、`npm --version`、`npx --version`。工作区脏则停止并向散帅报告，不覆盖。
- 同步远程：`git pull --ff-only` 并确认与 `origin/main` 一致。
- 核验 CLI：`npx -y wechat-acp@0.10.0 --version`、`npx -y wechat-acp@0.10.0 agents`（应不含 `codebuddy`）、`codebuddy --acp --acp-transport stdio --help`。
- 首次启动与登录：确认后执行前台：

  ```powershell
  $RepoRoot = (Get-Location).Path
  npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot"
  ```

  若需扫码，让散帅扫终端二维码；若显示 `Starting message polling...` 说明复用 token。
- 微信端验收：按 macOS 第 5 步的 4 条消息执行，预期工作目录为 `D:\workspace\wechat-agent-bot`（实际路径替换）、规则链读 `AGENTS.md`「敏感操作确认」、删除红线不执行、指定句一字不差回传。
- 切换后台 daemon：确认后执行：

  ```powershell
  $RepoRoot = (Get-Location).Path
  npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot" --daemon
  npx -y wechat-acp@0.10.0 status
  ```

  再从微信发 `只回复：Win10 CodeBuddy daemon 验证通过`。

### 日常操作（Win10）

```powershell
npx -y wechat-acp@0.10.0 status     # 查看状态
npx -y wechat-acp@0.10.0 stop       # 停止 daemon
```

强制重新扫码需先确认：`npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot" --login`。

不要在本文部署中创建 Windows 计划任务或开机自启。

### 故障排查（Win10）

- 确认进程存活须用 `tasklist` / `wmic process where "name='node.exe'" get ProcessId,CommandLine`（能看到完整命令行），不要用 Git Bash `ps` 判断进程状态，否则会漏判多实例。
- 重复回复/登录冲突：确认 Win10 只有一个 daemon、没有从其他机器复制 `.wechat-acp`；先 `wechat-acp stop` 再报告。
- Windows 子进程清理风险：`wechat-acp` 存在 Windows 边缘问题——自定义 Agent 脱离 shell wrapper 派生后台子进程，wrapper 退出后可能残留后代进程。官方记录见 [Issue #71](https://github.com/formulahendry/wechat-acp/issues/71)。固定使用 raw command、不添加自定义后台 wrapper 可规避。

不要输出 token、二维码内容、环境变量值或完整敏感日志。

---

## 完成标准

只有同时满足以下条件，才向散帅报告部署完成：

- 本地仓库与 `origin/main` 一致且工作区干净。
- CodeBuddy 与 Node.js 前提检查通过。
- `wechat-acp@0.10.0` 与 raw command `codebuddy --acp` 核验通过。
- 微信登录（复用 token 或扫码）、工作目录、规则读取、安全边界和消息回传全部通过。
- daemon 获得单独确认后启动，`status` 正常；daemon 模式下的微信回传验证通过。
- （Win10 组合）实机验收通过后方可标完成。
- 没有复制、输出或删除任何登录凭据。

如果任一项未完成，明确报告“部署未完成”以及阻塞点，不得把部分成功写成完成。

## 官方来源

- [wechat-acp 官方仓库](https://github.com/formulahendry/wechat-acp)
- [wechat-acp v0.10.0](https://github.com/formulahendry/wechat-acp/releases/tag/v0.10.0)
- [wechat-acp npm 包](https://www.npmjs.com/package/wechat-acp/v/0.10.0)