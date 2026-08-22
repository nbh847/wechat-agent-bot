# 部署微信 Bot（Codex）

## Agent 概览

- 以 **Codex** 作为 `wechat-acp` 的 ACP Agent，形成链路：

  ```text
  微信私聊 → wechat-acp → Codex ACP Agent → wechat-agent-bot 工作区
  ```

- 使用 `wechat-acp@0.10.0` 内置 `codex` preset：`npx @zed-industries/codex-acp`，命令为 `--agent codex`。
- > **状态：待实机核验。** 本文仅登记 preset 与命令，前置要求、Node 版本、命令细节、规则读取、已知限制与验收结论均未在实机核验，**不得写成已验证**。实机部署通过后再回填对应小节。
- 同一个微信账号同一时间只能跑一个 `wechat-acp` daemon；在两个 agent 间切换前，必须先 `wechat-acp stop` 停掉旧 daemon（多 agent 共用的边界，详见 [codebuddy.md](codebuddy.md) 与 [claude.md](claude.md) 已核验部分）。

## macOS 部署

> 待实机核验。预期流程与 [claude.md](claude.md) macOS 节一致，差异仅为命令 `--agent codex`、`codex` 命令与 ACP 适配器前置要求。核验后回填「1. 只读前提检查」至「6. 切换后台 daemon」、日常操作与故障排查。

- 启动命令（前台 / 后台二选一，待核验）：

  ```bash
  RepoRoot=$(pwd)
  npx -y wechat-acp@0.10.0 --agent codex --cwd "$RepoRoot"
  # 后台常驻：
  npx -y wechat-acp@0.10.0 --agent codex --cwd "$RepoRoot" --daemon
  ```

- token 猜想：复用 `~/.wechat-acp/token.json` 即可免扫码（待核验）。
- 规则读取：Codex 读取 `AGENTS.md`（待确认，是否额外读取其他规则文件）。
- 已知限制：未知，待核验。

## Win10 部署

> 待实机核验。预期流程与 [claude.md](claude.md) Win10 节一致，差异仅为命令 `--agent codex`、PowerShell 命令细节与前置要求。核验后回填。

- 启动命令（前台 / 后台，待核验）：

  ```powershell
  $RepoRoot = (Get-Location).Path
  npx -y wechat-acp@0.10.0 --agent codex --cwd "$RepoRoot"
  # 后台常驻：
  npx -y wechat-acp@0.10.0 --agent codex --cwd "$RepoRoot" --daemon
  ```

- Win10 子进程清理风险见官方 [Issue #71](https://github.com/formulahendry/wechat-acp/issues/71)，是否影响 codex preset 待核验。

## 完成标准

待实机核验后，按 [claude.md](claude.md) / [codebuddy.md](codebuddy.md) 的完成标准补充。未核验前，不得将本文描述的部署标为完成。

## 官方来源

- [wechat-acp 官方仓库](https://github.com/formulahendry/wechat-acp)
- [wechat-acp v0.10.0](https://github.com/formulahendry/wechat-acp/releases/tag/v0.10.0)
- [wechat-acp npm 包](https://www.npmjs.com/package/wechat-acp/v/0.10.0)