# WeChat Agent Bot Claude Code 规则

Claude Code 在本项目工作时，依次读取：

1. `README.md`
2. 本文件
3. `AGENTS.md`
4. `ROADMAP.md`

本项目的通用入口是 `README.md`，阶段、边界、文档结构、调研证据要求和安全约束统一以 `AGENTS.md` 与 `ROADMAP.md` 为准。Claude Code 不得建立专属工作流或绕过串行 Goal 和人工验收 Gate。

项目不绑定某一种 AI Agent。任何 Claude Code 专用适配都只能是未来可能的执行器适配之一，不得成为核心架构的默认前提。
