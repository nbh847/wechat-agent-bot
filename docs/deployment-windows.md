# Win10 原生部署微信 Bot（Claude / CodeBuddy）

## 目标与边界

本文供 Win10 上的 Agent 执行，将本仓库作为 `wechat-acp` 的工作目录，形成以下链路：

```text
微信私聊 → wechat-acp → Claude 或 CodeBuddy ACP Agent → wechat-agent-bot 工作区
```

已知前提：目标 Win10 已安装 Claude Code。部署过程中只验证现有 Claude，不重新安装、不升级、不修改 Claude 配置。

本文只部署基础微信 Bot，不迁移 macOS 的 `launchd` 定时任务，不配置 Windows 开机自启，不复制其他机器的微信登录凭据。

## CodeBuddy 变体（Win10）

除 Claude 外，Win10 也可使用 **CodeBuddy Code** 作为同一微信 Bot 的 ACP Agent。整体流程与本文 Claude 部署一致，差异如下，其余步骤（同步远程、验收、daemon、故障排查）沿用上文：

- 前提：Win10 已安装 CodeBuddy（提供 `codebuddy` 命令且支持 `--acp`）。用 `codebuddy --version` 与 `codebuddy --help | findstr acp` 核验；若未安装或没有 `--acp`，只报告缺口，不擅自安装。
- `wechat-acp@0.10.0` **没有内置 `codebuddy` preset**，必须用 raw command `--agent "codebuddy --acp"`，不要写 `--agent codebuddy`。
- 规则读取：CodeBuddy 读取全局 `CODEBUDDY.md`（已内嵌本项目规则）与 `AGENTS.md`，无需 `CLAUDE.md`。
- 登录 token 写在 `%USERPROFILE%\.wechat-acp`。若本机已用 Claude 部署过同一微信账号，token 可复用，无需重新扫码；但同一账号同一时间只能跑一个 `wechat-acp` daemon，从 Claude 切到 CodeBuddy 前必须先 `wechat-acp stop` 停掉旧 daemon，避免重复回复。
- 启动命令（PowerShell，前台 / 后台二选一）：

  ```powershell
  $RepoRoot = "D:\workspace\wechat-agent-bot"
  npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot"
  # 后台常驻：
  npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot" --daemon
  ```

- 验收同 macOS 4 条（见 `docs/deployment-macos.md` 第五步）：预期工作目录为 `D:\workspace\wechat-agent-bot`，规则链读 `AGENTS.md`「敏感操作确认」，删除红线不执行，指定句一字不差回传。
- 已知限制（与 macOS 相同）：`_codebuddy.ai/command` ACP 方法未实现（slash 类扩展受限，核心收发正常）；多实例双消费。

> 状态：此 Win10 + CodeBuddy 变体**尚未在 Win10 实机跑通**，目前仅 macOS 端已完成端到端验收（见 `ROADMAP.md`）。Win10 实装并通过验收后，再回填本段验收结论，不要提前写成已验证。

## Agent 执行规则

开始部署前，依次完整读取：

1. `README.md`
2. `CLAUDE.md`
3. `AGENTS.md`
4. `ROADMAP.md`
5. 本文

必须遵守以下边界：

- 不读取、输出或复制 `%USERPROFILE%\.wechat-acp`、`%USERPROFILE%\.claude` 中的 token、凭据和完整日志。
- 不修改 `.env`、Claude 登录状态、系统配置或全局依赖，除非先向散帅说明具体动作、目标、风险、影响和恢复方式，并取得当前对话中的一次性确认。
- 首次微信扫码会创建本机登录凭据；启动后台 daemon 会创建常驻进程。这两步分别执行确认门禁。
- 不覆盖脏工作区，不删除文件，不执行 Git 回滚、清理、push 或历史修改。
- 不把 `wechat-acp` 自动批准 ACP 权限请求描述为人工确认或技术隔离。

## 版本基线

本手册核验和使用以下稳定版本：

- `wechat-acp@0.10.0`
- `wechat-acp` 内置 `claude` preset：`@agentclientprotocol/claude-agent-acp`
- 核验时 Claude ACP 适配器最新版：`0.69.0`，要求 Node.js ≥ 22

`wechat-acp@0.10.0` 的内置 preset 没有固定 Claude ACP 适配器版本，会由 `npx` 解析当时的最新版。不要在部署时改用 `wechat-acp@next`；如果适配器最新版已经不是 `0.69.0`，也先停止并报告版本变化。版本升级必须重新核对 release notes、Node.js 要求和 Windows 已知问题。

## 第一步：只读前提检查

在 PowerShell 中进入仓库根目录。以下路径只是示例，必须替换为实际路径：

```powershell
Set-Location "D:\workspace\wechat-agent-bot"
```

执行：

```powershell
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
- Node.js 版本不低于 22。虽然 `wechat-acp` 本身只要求 Node.js 20，但当前 Claude ACP 适配器要求 Node.js ≥ 22。

如果 Claude 未安装、未登录或 Node.js 低于 22，只报告缺口。安装、登录或升级会改变软件／登录状态，必须另行说明并等待散帅确认；不得直接执行。

## 第二步：同步远程项目

确认工作区干净后执行：

```powershell
git pull --ff-only
git status --short --branch
git log -1 --oneline --decorate
```

通过标准：

- 本地分支与 `origin/main` 一致。
- 工作区仍然干净。
- 能读取本文以及根目录四份必读文件。

同步完成后，重新按本文开头的顺序读取五份文件，确保后续执行使用远程最新规则。

如果仓库尚未克隆，先让散帅确认目标目录，再执行：

```powershell
git clone https://github.com/nbh847/wechat-agent-bot.git "D:\workspace\wechat-agent-bot"
```

## 第三步：核验 wechat-acp CLI

执行：

```powershell
npx -y wechat-acp@0.10.0 --version
npx -y wechat-acp@0.10.0 agents
npm view @agentclientprotocol/claude-agent-acp version engines --json
```

通过标准：

- 版本输出为 `0.10.0`。
- agent 列表包含 `claude`。
- Claude ACP 适配器版本仍为 `0.69.0`，Node.js 要求仍为 `>=22`。如果版本或要求发生变化，停止部署并向散帅报告，不按旧文档继续。

`claude` preset 会通过 npm 启动 `@agentclientprotocol/claude-agent-acp`，不是直接把普通 Claude 交互终端当作 ACP Agent。不要自行改成其他 raw command。

## 第四步：首次前台启动和扫码

首次启动会展示微信二维码，并把登录 token、同步状态、日志和收件箱数据写入 `%USERPROFILE%\.wechat-acp`。执行前必须向散帅说明：

- 具体动作：启动 `wechat-acp@0.10.0`，使用 Claude preset 和当前仓库目录，扫码创建本机微信 Bot 登录状态。
- 影响范围：只影响当前 Win10 用户；本机将新增 `%USERPROFILE%\.wechat-acp` 运行数据。
- 潜在风险：`wechat-acp` 会自动允许 ACP Agent 发出的权限请求；扫码凭据属于敏感登录状态；与另一台机器复用同一份 token 可能导致重复消费或登录冲突。
- 恢复方式：按 `Ctrl+C` 停止前台进程；不删除运行数据。若需清理凭据，另行确认后处理。

取得散帅一次性明确确认后，在仓库根目录执行：

```powershell
$RepoRoot = (Get-Location).Path
npx -y wechat-acp@0.10.0 --agent claude --cwd "$RepoRoot"
```

随后：

1. 让散帅使用微信扫描终端二维码。
2. 不复制 macOS 或其他机器的 `.wechat-acp` 目录和 token。
3. 保持 PowerShell 前台进程运行，先完成下一步验收。

如果 Claude 登录失效导致 ACP session 创建失败，停止进程并报告错误摘要；不得读取或输出完整凭据，不得擅自重新登录。

## 第五步：微信端验收

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
只回复：Win10 微信 Bot 基础链路验证通过
```

预期：微信收到完全一致的文本。

验收期间同时观察终端，不能出现 ACP 初始化失败、持续重连、重复回复或进程退出。

## 第六步：切换后台 daemon

基础验收通过后，按 `Ctrl+C` 停止前台进程。

后台 daemon 属于常驻进程。启动前必须再次向散帅说明：

- 具体动作：以相同版本、Claude preset 和仓库目录启动后台 daemon。
- 影响范围：当前 Win10 用户；进程持续接收微信消息，运行数据写入 `%USERPROFILE%\.wechat-acp`。
- 潜在风险：持续占用本机资源；ACP 权限请求仍自动允许；电脑重启后不保证自动恢复。
- 恢复方式：使用 `wechat-acp stop` 停止，不删除登录凭据和历史运行数据。

取得散帅一次性明确确认后执行：

```powershell
$RepoRoot = (Get-Location).Path
npx -y wechat-acp@0.10.0 --agent claude --cwd "$RepoRoot" --daemon
npx -y wechat-acp@0.10.0 status
```

通过标准：`status` 显示 daemon 正在运行。随后再从微信发送一条：

```text
只回复：Win10 daemon 验证通过
```

微信收到完全一致的回复后，基础部署才算完成。

## 日常操作

查看状态：

```powershell
npx -y wechat-acp@0.10.0 status
```

停止 daemon：

```powershell
npx -y wechat-acp@0.10.0 stop
```

强制重新扫码会替换登录状态，必须先取得散帅确认：

```powershell
npx -y wechat-acp@0.10.0 --agent claude --cwd "D:\workspace\wechat-agent-bot" --login
```

不要在本文部署中创建 Windows 计划任务或开机自启。启用系统常驻启动项属于系统配置变更，必须作为独立任务说明风险并取得确认。

## 故障排查

### `claude` 命令不可用

只执行 `claude --version` 和 `claude doctor` 收集非敏感摘要。不要重装 Claude；向散帅报告 PATH 或安装健康检查结果。

### Node.js 版本不足

Claude ACP 适配器当前要求 Node.js ≥ 22。不要自行升级 Node.js；报告当前版本并等待确认。

### ACP session 创建失败

依次核对：

1. `claude doctor` 是否有阻塞错误。
2. `npx -y wechat-acp@0.10.0 agents` 是否包含 `claude`。
3. 仓库路径是否真实存在且使用双引号包裹。
4. 终端错误摘要是否指向 Claude 认证、网络或 ACP 适配器。

不要输出 token、二维码内容、环境变量值或完整敏感日志。

### 微信没有回复

检查：

```powershell
npx -y wechat-acp@0.10.0 status
```

如果 daemon 未运行，先报告，不擅自启动。若正在运行，只提供不含凭据和消息正文的错误摘要。

### 出现重复回复或登录冲突

- 确认 Win10 只有一个 `wechat-acp` daemon。
- 确认没有从其他机器复制 `.wechat-acp` 登录目录。
- 先使用 `wechat-acp stop` 停止 Win10 daemon，再向散帅报告；不要删除 token 或让另一台机器下线。

### Windows 子进程清理风险

`wechat-acp` 当前存在一个 Windows 边缘问题：自定义 Agent 如果脱离 shell wrapper 派生后台子进程，wrapper 退出后可能残留后代进程。本文固定使用官方 `claude` preset，不添加自定义后台 wrapper。相关记录见官方 [Issue #71](https://github.com/formulahendry/wechat-acp/issues/71) 。

## 完成标准

只有同时满足以下条件，才向散帅报告部署完成：

- 本地仓库与 `origin/main` 一致且工作区干净。
- Claude 与 Node.js 前提检查通过。
- `wechat-acp@0.10.0` 和 `claude` preset 核验通过。
- 微信扫码、工作目录、规则读取、安全边界和消息回传全部通过。
- daemon 获得单独确认后启动，`status` 正常。
- daemon 模式下的微信回传验证通过。
- 没有复制、输出或删除任何登录凭据。

如果任一项未完成，明确报告“部署未完成”以及阻塞点，不得把部分成功写成完成。

## 官方来源

核验日期：2026-08-17。

- [wechat-acp 官方仓库](https://github.com/formulahendry/wechat-acp)
- [wechat-acp v0.10.0](https://github.com/formulahendry/wechat-acp/releases/tag/v0.10.0)
- [wechat-acp npm 包](https://www.npmjs.com/package/wechat-acp/v/0.10.0)
- [Claude Agent ACP npm 包](https://www.npmjs.com/package/@agentclientprotocol/claude-agent-acp)
- [Claude Code 官方 Windows 安装与系统要求](https://code.claude.com/docs/en/setup)
