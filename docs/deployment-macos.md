# macOS 部署微信 Bot（CodeBuddy）

## 目标与边界

本文供 macOS 上的 Agent 执行，将本仓库作为 `wechat-acp` 的工作目录，用 **CodeBuddy Code** 作为 ACP Agent，形成以下链路：

```text
微信私聊 → wechat-acp → CodeBuddy ACP Agent → wechat-agent-bot 工作区
```

已知前提：目标 macOS 已安装 CodeBuddy Code（提供 `codebuddy` 命令且支持 `--acp`）。部署过程中只验证现有 CodeBuddy，不重新安装、不升级、不修改 CodeBuddy 配置。

本文只部署基础微信 Bot，不迁移 Windows 的定时任务，不配置 macOS 开机自启，不复制其他机器的微信登录凭据。

与 Windows 部署的区别：`wechat-acp@0.10.0` **没有内置 `codebuddy` preset**，必须用 raw command `codebuddy --acp`；且本机若已存在 `~/.wechat-acp/token.json`，启动会直接复用，无需重新扫码。

## Agent 执行规则

开始部署前，依次完整读取：

1. `README.md`
2. `AGENTS.md`
3. `ROADMAP.md`
4. 本文

CodeBuddy 还会自动读取全局 `CODEBUDDY.md`（已内嵌本项目规则），无需单独配置项目级入口。

必须遵守以下边界：

- 不读取、输出或复制 `~/.wechat-acp` 中的 token、凭据和完整日志。
- 不修改 `.env`、CodeBuddy 登录状态、系统配置或全局依赖，除非先向散帅说明具体动作、目标、风险、影响和恢复方式，并取得当前对话中的一次性确认。
- 首次微信扫码会创建本机登录凭据；启动后台 daemon 会创建常驻进程。这两步分别执行确认门禁。
- 不覆盖脏工作区，不删除文件，不执行 Git 回滚、清理、push 或历史修改。
- 不把 `wechat-acp` 自动批准 ACP 权限请求描述为人工确认或技术隔离。

## 版本基线

本手册核验和使用以下稳定版本：

- `wechat-acp@0.10.0`
- `codebuddy` 命令支持 ACP：已通过 `codebuddy --help` 确认存在 `--acp` 与 `--acp-transport stdio`（默认 stdio）
- 核验时 Node.js：`v24.15.0`（≥ 22）

`wechat-acp@0.10.0` 的内置 preset 列表（claude / codex / copilot / gemini / qwen / opencode / openclaw / kiro / hermes / kimi / pi）**不含 `codebuddy`**，因此本文固定使用 raw command `codebuddy --acp`，不使用任何 preset。不要在部署时改用 `wechat-acp@next` 或自造其他 raw command。

## 第一步：只读前提检查

在终端进入仓库根目录（以下为本机实际路径，其他机器替换为实际路径）：

```bash
cd /Users/mac/workspace/wechat-agent-bot
```

执行：

```bash
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

## 第二步：同步远程项目

确认工作区干净后执行：

```bash
git pull --ff-only
git status --short --branch
git log -1 --oneline --decorate
```

通过标准：

- 本地分支与 `origin/main` 一致。
- 工作区仍然干净。
- 能读取本文以及根目录必读文件。

## 第三步：核验 wechat-acp CLI 与 CodeBuddy ACP 入口

执行：

```bash
npx -y wechat-acp@0.10.0 --version
npx -y wechat-acp@0.10.0 agents
codebuddy --acp --acp-transport stdio --help 2>&1 | head -5
```

通过标准：

- 版本输出为 `0.10.0`。
- `agents` 列表**不包含** `codebuddy`（确认需走 raw command）。
- `codebuddy --acp` 可正常解析（说明 ACP 入口可用）。

若本机已全局安装 `wechat-acp`，也可直接用 `wechat-acp` 或绝对路径 `/Users/mac/node_modules/.bin/wechat-acp` 代替 `npx -y wechat-acp@0.10.0`。

## 第四步：首次启动与登录

`wechat-acp` 的登录 token 写在 `~/.wechat-acp/token.json`。**若本机已存在有效 token（例如此前用 Claude 部署过同一微信 Bot），启动会直接复用，无需扫码。** 仅当 token 失效或首次部署时才需扫码。

执行前必须向散帅说明：

- 具体动作：启动 `wechat-acp@0.10.0`，使用 raw command `codebuddy --acp` 和当前仓库目录；若 token 失效则扫码创建本机微信 Bot 登录状态。
- 影响范围：只影响当前 macOS 用户；本机将新增／复用 `~/.wechat-acp` 运行数据。
- 潜在风险：`wechat-acp` 会自动允许 ACP Agent 发出的权限请求；扫码凭据属于敏感登录状态；与另一台机器复用同一份 token 可能导致重复消费或登录冲突。
- 恢复方式：按 `Ctrl+C` 停止前台进程；不删除运行数据。若需清理凭据，另行确认后处理。

取得散帅一次性明确确认后，在仓库根目录执行：

```bash
RepoRoot=$(pwd)
npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot"
```

随后：

1. 若终端出现二维码，让散帅使用微信扫描；若直接显示 `Starting message polling...` 说明已复用 token，无需扫码。
2. 不复制其他机器的 `.wechat-acp` 目录和 token。
3. 保持前台进程运行，先完成下一步验收。

macOS 终端通常可直接渲染微信二维码；若遇半块字符二维码变形扫不出（Windows 端曾出现），参考 Windows 部署手册把二维码渲染为图片再扫。

如果 CodeBuddy 登录失效导致 ACP session 创建失败，停止进程并报告错误摘要；不得读取或输出完整凭据，不得擅自重新登录。

## 第五步：微信端验收

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

## 第六步：切换后台 daemon

基础验收通过后，按 `Ctrl+C` 停止前台进程。

后台 daemon 属于常驻进程。启动前必须再次向散帅说明：

- 具体动作：以相同版本、raw command `codebuddy --acp` 和仓库目录启动后台 daemon。
- 影响范围：当前 macOS 用户；进程持续接收微信消息，运行数据写入 `~/.wechat-acp`。
- 潜在风险：持续占用本机资源；ACP 权限请求仍自动允许；电脑重启后不保证自动恢复。
- 恢复方式：使用 `wechat-acp stop` 停止，不删除登录凭据和历史运行数据。

取得散帅一次性明确确认后执行：

```bash
RepoRoot=$(pwd)
npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd "$RepoRoot" --daemon
npx -y wechat-acp@0.10.0 status
```

通过标准：`status` 显示 daemon 正在运行。随后再从微信发送一条：

```text
只回复：macOS CodeBuddy daemon 验证通过
```

微信收到完全一致的回复后，基础部署才算完成。

## 日常操作

查看状态：

```bash
npx -y wechat-acp@0.10.0 status
```

停止 daemon：

```bash
npx -y wechat-acp@0.10.0 stop
```

强制重新扫码会替换登录状态，必须先取得散帅确认：

```bash
npx -y wechat-acp@0.10.0 --agent "codebuddy --acp" --cwd /Users/mac/workspace/wechat-agent-bot --login
```

不要在本文部署中创建 macOS 开机自启或 launchd 常驻项。启用系统常驻启动项属于系统配置变更，必须作为独立任务说明风险并取得确认。

## 已知限制

- **无内置 `codebuddy` preset**：必须用 raw command `--agent "codebuddy --acp"`，不能写 `--agent codebuddy`。
- **`_codebuddy.ai/command` 方法未实现**：wechat-acp 会探测该 ACP 扩展方法，CodeBuddy 返回 `Method not found`。这是非致命的能力缺口，核心的消息收发、工具调用、权限自动放行均正常；但 wechat-acp 的 `/acp-*` 聊天命令类扩展可能不可用。
- **多实例双消费**：同一微信账号同时跑两个 `wechat-acp` 会造成重复回复。切换 agent（如 Claude ↔ CodeBuddy）前，必须先 `wechat-acp stop` 停掉旧 daemon，再启动新的。

## 故障排查

### `codebuddy` 命令不可用或没有 `--acp`

只执行 `codebuddy --version` 和 `codebuddy --help` 收集非敏感摘要。不要重装 CodeBuddy；向散帅报告 PATH 或安装健康检查结果。

### `wechat-acp` 不在 PATH

用 `npx -y wechat-acp@0.10.0 ...` 或绝对路径 `/Users/mac/node_modules/.bin/wechat-acp ...` 代替。

### Node.js 版本不足

CodeBuddy ACP 当前要求 Node.js ≥ 22。不要自行升级 Node.js；报告当前版本并等待确认。

### ACP session 创建失败

依次核对：

1. `codebuddy --acp` 是否能解析。
2. `npx -y wechat-acp@0.10.0 agents` 是否不含 `codebuddy`（确认走 raw command）。
3. 仓库路径是否真实存在且使用双引号包裹。
4. 终端错误摘要是否指向 CodeBuddy 认证、网络或 ACP 入口。

不要输出 token、二维码内容、环境变量值或完整敏感日志。

### 微信没有回复

检查：

```bash
npx -y wechat-acp@0.10.0 status
```

如果 daemon 未运行，先报告，不擅自启动。若正在运行，只提供不含凭据和消息正文的错误摘要。

### 出现重复回复或登录冲突

- 确认 macOS 只有一个 `wechat-acp` daemon。
- 确认没有从其他机器复制 `.wechat-acp` 登录目录。
- 先使用 `wechat-acp stop` 停止当前 daemon，再向散帅报告；不要删除 token 或让另一台机器下线。

## 完成标准

只有同时满足以下条件，才向散帅报告部署完成：

- 本地仓库与 `origin/main` 一致且工作区干净。
- CodeBuddy 与 Node.js 前提检查通过。
- `wechat-acp@0.10.0` 与 raw command `codebuddy --acp` 核验通过。
- 微信登录（复用 token 或扫码）、工作目录、规则读取、安全边界和消息回传全部通过。
- daemon 获得单独确认后启动，`status` 正常。
- daemon 模式下的微信回传验证通过。
- 没有复制、输出或删除任何登录凭据。

如果任一项未完成，明确报告“部署未完成”以及阻塞点，不得把部分成功写成完成。

## 官方来源

核验日期：2026-08-18。

- [wechat-acp 官方仓库](https://github.com/formulahendry/wechat-acp)
- [wechat-acp v0.10.0](https://github.com/formulahendry/wechat-acp/releases/tag/v0.10.0)
- [wechat-acp npm 包](https://www.npmjs.com/package/wechat-acp/v/0.10.0)
