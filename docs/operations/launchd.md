# macOS launchd 运行方案

## 当前状态

本文件只交付配置方案。尚未向 `~/Library/LaunchAgents` 写入文件，也未执行 `launchctl bootstrap` 或启用系统常驻服务。实际安装属于系统配置变更，必须先取得散帅单独确认。

## 使用前提

- 项目固定路径：`/Users/mac/workspace/wechat-agent-bot`。
- 先执行 `npm run build`。
- 将模板中的 `WECHAT_AGENT_EXECUTABLE` 替换为经过权限审查的长期适配器绝对路径。
- 标准输出和错误输出不得指向公开或同步目录；项目自身日志位于 `runtime-data/service/`。

## 模板

模板见 `docs/operations/com.bni.wechat-agent-bot.plist.example`。建议安装目标为：

```text
/Users/mac/Library/LaunchAgents/com.bni.wechat-agent-bot.plist
```

安装、加载、卸载和删除均需散帅对具体动作单独确认。
