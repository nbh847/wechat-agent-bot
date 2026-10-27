# 微信 Bot 渠道切换（开发中）

本入口设计为仅从 macOS 或 Win10 的独立终端执行，不支持微信 Bot 内发起。脚本与测试在可由 Git 跟踪的 `tools/bot-switch/`；各机仍须分别准备本机启动脚本、配置和依赖，不能把 macOS 的结果当作 Win10 验收。

```text
node tools/bot-switch/switch-bot.js claude
node tools/bot-switch/switch-bot.js codex
node tools/bot-switch/switch-bot.js codebuddy
node tools/bot-switch/switch-bot.js codex --model gpt-6-luna --effort max
node tools/bot-switch/switch-bot.js --list-models
```

Codex 的 `--model`、`--effort` 参数目前仅适配 macOS；Win10 本机启动脚本尚未核验，指定参数时会在停止旧 Bot 前拒绝执行。不指定时沿用本机 Codex 专用配置。脚本内维护模型与强度的本地清单，来自 2026-10-27 macOS 上本机 Codex ACP 适配器实际返回的选项；`--list-models` 可查看，命中清单时不联网检查。清单未收录或组合不匹配时，停止切换并提示核对，Agent 再按需查询官方信息和本机适配器、更新清单；清单是该次账号和适配器的快照，不保证之后或另一台机器仍可用。Claude 和 CodeBuddy 不接受这些参数。临时配置写入 `.tmp/bot-switch-config/` 下本次创建的独立目录，不修改固定配置或全局设置；启动后清理本次临时目录，启动结果不明确时保留供排查。

脚本先识别系统，检查目标入口、构建或依赖，并校验本机 PID 与进程命令行。确认属于本项目的唯一旧 bridge 后，调用固定 CLI 停止并等待已观察到的进程树退出；再启动目标并检查新 PID、渠道和新增轮询标记。无法确认归属、检测到多个 bridge、旧进程未退出或目标依赖缺失时停止，不主动清除遗留 PID、强杀进程、重新登录或下载包。启动后检测失败不代表目标进程已退出，需检查现场。脚本不能检测另一台机器是否使用同一账号；使用前需自行确保另一台机器没有同时消费同一账号。

macOS 使用本机固定修复版 bridge：Claude 和 Codex 调用已有启动脚本，CodeBuddy 使用本地 `codebuddy --acp`。Win10 使用项目内 Codex 所在目录的 `wechat-acp@0.10.0`；Codex 调用本机现有 PowerShell 启动脚本，Claude 要求项目内安装 `@agentclientprotocol/claude-agent-acp@0.85.1`，CodeBuddy 要求本机 `codebuddy --acp`。Win10 的 Claude 本地适配器尚未确认安装，CodeBuddy 组合尚未实机验收；缺少依赖时不会先停止旧实例。跨渠道不保证继承旧会话。

**状态：开发中。2026-10-27 在 macOS 使用统一入口完成 Claude 重启，以及从 Claude 切换至 Codex 的停止、启动、单实例及轮询检查；其他渠道之间的切换、故障路径和 Win10 尚未完整验证。** 散帅已确认此前 Claude 微信收发通过，切换至 Codex 后微信收发尚未验证。不要将此入口视为全部渠道均已验收的日常操作工具。旧实例如果是其他构建、前台启动或缺少 PID 文件，脚本会拒绝处理。

开发检查：`node --test tools/bot-switch/test-switch-bot.js`。测试覆盖进程识别、参数和配置生成，并使用模拟进程信息检查 macOS 启动预检；不证明自定义模型的真实切换或账号支持情况。
