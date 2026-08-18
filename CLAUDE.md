# WeChat Agent Bot Workspace Claude Code 规则

Claude Code 在本仓库工作时依次读取：

1. `README.md`
2. 本文件
3. `AGENTS.md`
4. `ROADMAP.md`
5. 与当前任务直接相关的 `docs/research/` 文档

`AGENTS.md` 是本仓库的通用规则源。本文件只负责 Claude Code 入口适配，不建立独立工作流，也不得降低通用安全边界。

本仓库作为 `wechat-acp` 的目标工作目录时，Claude Agent 必须遵守 `AGENTS.md` 中的工作区边界和敏感操作确认规则。ACP 层自动批准权限不等于散帅确认；敏感工具调用必须在执行前通过当前对话取得一次性明确授权。

## 手动启动本项目的 wechat-acp Agent（Windows 10）

以下命令为 **Win10 平台**的手动启动方式（终端 / bash）：

```bash
npx -y wechat-acp@0.10.0 --agent claude --cwd "D:\workspace\wechat-agent-bot" --hide-thoughts --daemon
```

- `--agent claude`：Claude agent 后端
- `--cwd`：指定本项目作为目标工作目录
- `--hide-thoughts`：隐藏推理过程
- `--daemon`：后台守护运行
