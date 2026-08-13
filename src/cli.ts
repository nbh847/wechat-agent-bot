import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { ILinkApi } from "./ilink/api.js";
import { ExecutionCoordinator, formatExecutionResult } from "./agent/coordinator.js";
import { ProcessAgentRunner } from "./agent/process-runner.js";
import { ILinkTextChannel } from "./ilink/channel.js";
import { HttpClient } from "./ilink/http-client.js";
import { consoleLogger } from "./ilink/logger.js";
import { LoginManager } from "./ilink/login.js";
import { writeQrCode } from "./ilink/qr-code.js";
import { StateStore } from "./ilink/state-store.js";
import { TaskIntake } from "./tasks/intake.js";
import { TaskStore } from "./tasks/store.js";

const runtimeDir = resolve("runtime-data/ilink");
const statePath = resolve(runtimeDir, "state.json");
const qrPath = resolve(runtimeDir, "login-qr.png");
const taskStatePath = resolve("runtime-data/tasks/state.json");
await mkdir(runtimeDir, { recursive: true, mode: 0o700 });

const store = new StateStore(statePath);
const api = new ILinkApi(new HttpClient());
const login = new LoginManager(api, store, consoleLogger);
const channel = new ILinkTextChannel(api, login, store, consoleLogger);
const taskStore = new TaskStore(taskStatePath);
const agentExecutable = process.env.WECHAT_AGENT_EXECUTABLE;
const coordinator = agentExecutable
  ? new ExecutionCoordinator(
      taskStore,
      new ProcessAgentRunner(agentExecutable),
      {
        onFinished: async (task) => {
          await channel.queueReply(
            `execution:${task.id}`,
            task.senderId,
            formatExecutionResult(task),
          );
        },
      },
    )
  : undefined;
const intake = new TaskIntake(
  taskStore,
  resolve(".."),
  "wechat-agent-bot",
  async () => (await store.load()).credentials?.userId,
  coordinator,
);

const shutdown = () => channel.stop();
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await channel.start({
  onQrCode: async (url) => {
    await writeQrCode(qrPath, url);
    console.log(`新的登录二维码已生成：${qrPath}`);
    console.log(`备用登录链接：${url}`);
  },
  onScanned: () => console.log("二维码已扫描，请在微信中确认"),
  onVerifyCode: async (isRetry) => {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await readline.question(
      isRetry ? "配对数字不匹配，请重新输入：" : "请输入手机微信显示的配对数字：",
    );
    readline.close();
    return answer.trim();
  },
  onReady: (restored) => {
    console.log(restored ? "iLink 会话已恢复，正在监听文本" : "iLink 登录成功，正在监听文本");
  },
  onText: async (message) => intake.handle(message.userId, message.text),
  onTokenExpired: () => console.error("iLink 登录凭证已失效，请重新扫码"),
});
