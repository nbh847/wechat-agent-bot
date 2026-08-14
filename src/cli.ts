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
import { RotatingFileLogger } from "./runtime/file-logger.js";
import { HealthReporter } from "./runtime/health.js";
import { acquireInstanceLock } from "./runtime/single-instance.js";

const runtimeDir = resolve("runtime-data/ilink");
const statePath = resolve(runtimeDir, "state.json");
const qrPath = resolve(runtimeDir, "login-qr.png");
const taskStatePath = resolve("runtime-data/tasks/state.json");
const serviceRuntimeDir = resolve("runtime-data/service");
const instanceLockPath = resolve(serviceRuntimeDir, "instance.lock");
const healthPath = resolve(serviceRuntimeDir, "health.json");
await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
const instanceLock = await acquireInstanceLock(instanceLockPath);
const health = new HealthReporter(healthPath);
const fileLogger = new RotatingFileLogger(resolve(serviceRuntimeDir, "service.log"));
await health.write("starting");
fileLogger.info("服务正在启动");

const store = new StateStore(statePath);
const api = new ILinkApi(new HttpClient());
const logger = {
  info: (message: string) => { consoleLogger.info(message); fileLogger.info(message); },
  warn: (message: string) => { consoleLogger.warn(message); fileLogger.warn(message); },
  error: (message: string) => { consoleLogger.error(message); fileLogger.error(message); },
};
const login = new LoginManager(api, store, logger);
const channel = new ILinkTextChannel(api, login, store, logger);
const taskStore = new TaskStore(taskStatePath);
const serviceProjectPath = resolve(".");
const interruptedTasks = await taskStore.recoverInterrupted();
if (interruptedTasks.length > 0) {
  console.log(`已将重启前未完成的任务标记为中断：${interruptedTasks.join(", ")}`);
  fileLogger.warn(`已将 ${interruptedTasks.length} 个未完成任务标记为中断`);
}
const agentExecutable = process.env.WECHAT_AGENT_EXECUTABLE;
const coordinator = agentExecutable
  ? new ExecutionCoordinator(
      taskStore,
      new ProcessAgentRunner(agentExecutable),
      {
        onStarted: async (task) => {
          await channel.queueReply(
            `execution-started:${task.id}`,
            task.senderId,
            "已开始生成回复。",
          );
        },
        onProgress: async (task) => {
          await channel.queueReply(
            `execution-progress:${task.id}:${Math.floor(Date.now() / 120_000)}`,
            task.senderId,
            "仍在生成回复中；可发送“状态”查看，或“取消当前任务”取消。",
          );
        },
        onFinished: async (task) => {
          await channel.queueReply(
            `execution:${task.id}`,
            task.senderId,
            formatExecutionResult(task),
          );
        },
      },
      serviceProjectPath,
    )
  : undefined;
const intake = new TaskIntake(
  taskStore,
  resolve(".."),
  "wechat-agent-bot",
  async () => (await store.load()).credentials?.userId,
  coordinator,
);

const shutdown = () => {
  fileLogger.info("服务正在停止");
  void health.write("stopping");
  channel.stop();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
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
      void health.write("listening", { restored });
      fileLogger.info(restored ? "iLink 会话已恢复，正在监听文本" : "iLink 登录成功，正在监听文本");
      console.log(restored ? "iLink 会话已恢复，正在监听文本" : "iLink 登录成功，正在监听文本");
    },
    onText: async (message) => intake.handle(message.userId, message.text),
    onTokenExpired: () => {
      void health.write("token_expired");
      fileLogger.error("iLink 登录凭证已失效，请重新扫码");
      console.error("iLink 登录凭证已失效，请重新扫码");
    },
  });
} finally {
  await fileLogger.flush();
  await instanceLock.release();
}
