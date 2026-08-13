import assert from "node:assert/strict";
import { mkdir, mkdtemp, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { TaskIntake } from "../src/tasks/intake.js";
import { TaskStore } from "../src/tasks/store.js";

async function createIntake() {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-tasks-"));
  const workspace = join(root, "workspace");
  await mkdir(join(workspace, "wechat-agent-bot"), { recursive: true });
  await mkdir(join(workspace, "other-project"));
  const statePath = join(root, "runtime-data", "tasks.json");
  const store = new TaskStore(statePath);
  const intake = new TaskIntake(store, workspace, "wechat-agent-bot", async () => "owner");
  return { intake, statePath, store };
}

test("rejects unauthorized senders without creating a task", async () => {
  const { intake, store } = await createIntake();
  const response = await intake.handle("stranger", "task other-project read inspect README");
  assert.match(response, /^拒绝/);
  assert.deepEqual((await store.load()).tasks, {});
});

test("rejects every sender when no bound owner identity is available", async () => {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-no-owner-"));
  const workspace = join(root, "workspace");
  await mkdir(join(workspace, "wechat-agent-bot"), { recursive: true });
  const store = new TaskStore(join(root, "tasks.json"));
  const intake = new TaskIntake(store, workspace, "wechat-agent-bot", async () => undefined);
  assert.match(
    await intake.handle("owner", "task wechat-agent-bot read inspect README"),
    /^拒绝/,
  );
  assert.deepEqual((await store.load()).tasks, {});
});

test("rejects paths outside the workspace", async () => {
  const { intake, store } = await createIntake();
  assert.match(await intake.handle("owner", "task ../outside read inspect"), /^拒绝/);
  assert.match(await intake.handle("owner", "task /tmp read inspect"), /^拒绝/);
  assert.deepEqual((await store.load()).tasks, {});
});

test("rejects a workspace symlink that resolves outside the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-symlink-"));
  const workspace = join(root, "workspace");
  await mkdir(join(workspace, "wechat-agent-bot"), { recursive: true });
  await symlink(root, join(workspace, "outside-link"));
  const store = new TaskStore(join(root, "tasks.json"));
  const intake = new TaskIntake(store, workspace, "wechat-agent-bot", async () => "owner");
  assert.match(await intake.handle("owner", "task outside-link read inspect"), /^拒绝/);
  assert.deepEqual((await store.load()).tasks, {});
});

test("records a read-only task without executing it", async () => {
  const { intake, statePath, store } = await createIntake();
  const response = await intake.handle("owner", "task other-project read inspect README");
  assert.equal(response, "已接收 T0001：当前没有可用执行端，任务未执行。");
  const task = await store.get("T0001");
  assert.equal(task?.status, "received");
  assert.equal(task?.mode, "read");
  assert.equal((await stat(statePath)).mode & 0o777, 0o600);
});

test("task records and status survive a store restart", async () => {
  const { intake, statePath } = await createIntake();
  await intake.handle("owner", "task other-project read inspect README");
  const restored = new TaskIntake(
    new TaskStore(statePath),
    join(statePath, "..", "..", "..", "workspace"),
    "wechat-agent-bot",
    async () => "owner",
  );
  assert.equal(
    await restored.handle("owner", "status T0001"),
    "T0001：received；read other-project: inspect README",
  );
});

test("cross-project writes require a task-bound one-time confirmation", async () => {
  const { intake, store } = await createIntake();
  const response = await intake.handle("owner", "task other-project write update README title");
  assert.match(response, /T0001 等待二次确认：跨项目写入/);
  const code = /confirm T0001 ([A-F0-9]{6})/.exec(response)?.[1];
  assert.ok(code);
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");

  assert.equal(await intake.handle("owner", "confirm T0001 000000"), "T0001 确认码不匹配。");
  assert.equal(
    await intake.handle("owner", `confirm T0001 ${code}`),
    "T0001 已确认授权；当前没有可用执行端，任务未执行。",
  );
  assert.equal((await store.get("T0001"))?.status, "approved");
  assert.equal(await intake.handle("owner", `confirm T0001 ${code}`), "T0001 当前不接受确认。");
});

test("a confirmation code cannot approve a different task or action", async () => {
  const { intake, store } = await createIntake();
  const first = await intake.handle("owner", "task other-project write update README title");
  const second = await intake.handle("owner", "task other-project write update ROADMAP status");
  const firstCode = /confirm T0001 ([A-F0-9]{6})/.exec(first)?.[1];
  assert.ok(firstCode);
  assert.equal(await intake.handle("owner", `confirm T0002 ${firstCode}`), "T0002 确认码不匹配。");
  assert.equal((await store.get("T0002"))?.status, "awaiting_confirmation");
  assert.match(second, /confirm T0002 [A-F0-9]{6}/);
});

test("high-risk operations require confirmation even in the current project", async () => {
  const cases = [
    ["delete old logs", "删除或高风险 Git／发布操作"],
    ["edit .env", "凭证、密钥或 .env 操作"],
    ["change database schema", "数据库结构或迁移操作"],
    ["install global dependency", "全局依赖或系统配置操作"],
    ["update Cloudflare DNS", "Cloudflare、部署或公开发布操作"],
  ];
  for (const [instruction, reason] of cases) {
    const { intake } = await createIntake();
    const response = await intake.handle(
      "owner",
      `task wechat-agent-bot write ${instruction}`,
    );
    assert.match(response, new RegExp(`等待二次确认：${reason}`));
  }
});

test("read-only risk analysis is not mistaken for a release operation", async () => {
  const { intake, store } = await createIntake();
  const response = await intake.handle(
    "owner",
    "task other-project read 全面检查测试覆盖和发布前风险",
  );
  assert.equal(response, "已接收 T0001：当前没有可用执行端，任务未执行。");
  assert.equal((await store.get("T0001"))?.status, "received");
});

test("read-only requests for credentials still require confirmation", async () => {
  const { intake, store } = await createIntake();
  const response = await intake.handle("owner", "task other-project read inspect .env token");
  assert.match(response, /等待二次确认：凭证、密钥或 \.env 操作/);
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");
});

test("pending tasks can be rejected or cancelled", async () => {
  const { intake, store } = await createIntake();
  const first = await intake.handle("owner", "task other-project write change README");
  const code = /reject T0001 ([A-F0-9]{6})/.exec(first)?.[1];
  assert.ok(code);
  assert.equal(await intake.handle("owner", `reject T0001 ${code}`), "T0001 已拒绝。");
  assert.equal((await store.get("T0001"))?.status, "rejected");

  await intake.handle("owner", "task other-project read inspect tests");
  assert.equal(await intake.handle("owner", "cancel T0002"), "T0002 已取消。");
  assert.equal((await store.get("T0002"))?.status, "cancelled");
});

test("cancel delegates to an active executor before changing stored state", async () => {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-active-cancel-"));
  const workspace = join(root, "workspace");
  await mkdir(join(workspace, "wechat-agent-bot"), { recursive: true });
  const store = new TaskStore(join(root, "tasks.json"));
  const cancelled: string[] = [];
  const intake = new TaskIntake(
    store,
    workspace,
    "wechat-agent-bot",
    async () => "owner",
    {
      start: async () => "started",
      cancel: async (id) => { cancelled.push(id); return true; },
    },
  );
  assert.equal(
    await intake.handle("owner", "task wechat-agent-bot read inspect README"),
    "T0001 已接收并开始执行。",
  );
  assert.equal(await intake.handle("owner", "cancel T0001"), "T0001 正在取消。");
  assert.deepEqual(cancelled, ["T0001"]);
  assert.equal((await store.get("T0001"))?.status, "received");
});

test("natural language uses the current project and continues the agent session", async () => {
  const { intake, store } = await createIntake();
  assert.equal(await intake.handle("owner", "切换项目 other-project"), "已设置默认目标项目：other-project。请继续说明任务。");
  assert.equal(
    await intake.handle("owner", "检查 README 并总结定位"),
    "已接收 T0001：当前没有可用执行端，任务未执行。",
  );
  await store.updateTask("T0001", (task) => {
    task.status = "succeeded";
    task.execution = { startedAt: task.createdAt, finishedAt: task.updatedAt, sessionId: "session-1" };
  });
  await store.updateConversation("owner", (conversation) => { conversation.agentSessionId = "session-1"; });
  await intake.handle("owner", "再看看测试覆盖情况");
  const followUp = await store.get("T0002");
  assert.equal(followUp?.project, "other-project");
  assert.equal(followUp?.parentTaskId, "T0001");
  assert.equal(followUp?.resumeSessionId, "session-1");
});

test("natural language refuses an unknown project and confirms writes", async () => {
  const { intake, store } = await createIntake();
  assert.match(await intake.handle("owner", "帮我总结项目"), /无法确定目标项目/);
  assert.deepEqual((await store.load()).tasks, {});
  const response = await intake.handle("owner", "修改 other-project 的 README 标题");
  assert.match(response, /等待二次确认：跨项目写入/);
  assert.match(response, /系统理解：项目 other-project；模式 write/);
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");
});

test("natural language writes in the current project still require confirmation", async () => {
  const { intake, store } = await createIntake();
  await intake.handle("owner", "切换项目 wechat-agent-bot");
  const response = await intake.handle("owner", "修改 README 标题");
  assert.match(response, /等待二次确认：口语化写入操作/);
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");
});

test("conversation controls switch tasks, report status and start a new session", async () => {
  const { intake, store } = await createIntake();
  await intake.handle("owner", "task other-project read inspect README");
  assert.equal(await intake.handle("owner", "状态"), "T0001：received；read other-project: inspect README");
  assert.equal(await intake.handle("owner", "继续 T0001"), "已切换到 T0001；默认目标项目：other-project。");
  assert.equal(await intake.handle("owner", "新任务"), "已开始新会话。请说明目标项目和任务。");
  const conversation = await store.getConversation("owner");
  assert.equal(conversation?.currentTaskId, undefined);
  assert.equal(conversation?.defaultTargetProject, undefined);
  assert.equal(conversation?.agentSessionId, undefined);
});

test("an explicit project mention changes the target without starting a new agent session", async () => {
  const { intake, store } = await createIntake();
  await intake.handle("owner", "切换项目 wechat-agent-bot");
  await store.updateConversation("owner", (conversation) => {
    conversation.currentTaskId = "T0099";
    conversation.agentSessionId = "session-1";
  });
  assert.equal(
    await intake.handle("owner", "检查 other-project 的 README"),
    "已接收 T0001：当前没有可用执行端，任务未执行。",
  );
  const task = await store.get("T0001");
  assert.equal(task?.project, "other-project");
  assert.equal(task?.mode, "read");
  assert.equal(task?.parentTaskId, "T0099");
  assert.equal(task?.resumeSessionId, "session-1");
  assert.equal((await store.getConversation("owner"))?.defaultTargetProject, "other-project");
});

test("an explicit cross-project write switches target but still requires confirmation", async () => {
  const { intake, store } = await createIntake();
  await intake.handle("owner", "切换项目 wechat-agent-bot");
  const response = await intake.handle("owner", "修改 other-project 的 README 标题");
  assert.match(response, /等待二次确认：跨项目写入/);
  const task = await store.get("T0001");
  assert.equal(task?.project, "other-project");
  assert.equal(task?.status, "awaiting_confirmation");
  assert.equal(task?.resumeSessionId, undefined);
});

test("store marks running and queued tasks interrupted after restart", async () => {
  const { store, statePath } = await createIntake();
  const running = await store.create((id, now) => ({
    id, senderId: "owner", project: "other-project", projectPath: "unused", mode: "read",
    instruction: "one", actionSummary: "read other-project: one", status: "running",
    createdAt: now, updatedAt: now,
  }));
  const queued = await store.create((id, now) => ({
    ...running, id, instruction: "two", actionSummary: "read other-project: two", status: "queued",
    createdAt: now, updatedAt: now,
  }));
  const restored = new TaskStore(statePath);
  assert.deepEqual(await restored.recoverInterrupted(), [running.id, queued.id]);
  assert.equal((await restored.get(running.id))?.status, "interrupted");
  assert.equal((await restored.get(queued.id))?.status, "interrupted");
});

test("starts a fresh agent session on a new Shanghai date with a short handoff", async () => {
  const { intake, store } = await createIntake();
  await store.updateConversation("owner", (conversation) => {
    conversation.defaultTargetProject = "other-project";
    conversation.defaultTargetProjectPath = join("unused", "other-project");
    conversation.currentTaskId = "T0001";
    conversation.agentSessionId = "old-session";
    conversation.agentSessionDate = "2000-01-01";
    conversation.agentTurnCount = 3;
  });
  await intake.handle("owner", "检查 other-project README");
  const task = await store.get("T0001");
  assert.equal(task?.resumeSessionId, undefined);
  assert.match(task?.handoffSummary ?? "", /跨自然日/);
  assert.ok((task?.handoffSummary?.length ?? 0) <= 1_000);
});

test("starts a fresh agent session after 30 turns but not when the target changes", async () => {
  const first = await createIntake();
  await first.store.updateConversation("owner", (conversation) => {
    conversation.defaultTargetProject = "wechat-agent-bot";
    conversation.defaultTargetProjectPath = "unused";
    conversation.agentSessionId = "old-session";
    conversation.agentSessionDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    conversation.agentTurnCount = 30;
  });
  await first.intake.handle("owner", "检查 other-project README");
  const rotated = await first.store.get("T0001");
  assert.equal(rotated?.resumeSessionId, undefined);
  assert.match(rotated?.handoffSummary ?? "", /达到 30 轮/);

  const second = await createIntake();
  await second.store.updateConversation("owner", (conversation) => {
    conversation.defaultTargetProject = "wechat-agent-bot";
    conversation.defaultTargetProjectPath = "unused";
    conversation.agentSessionId = "active-session";
    conversation.agentSessionDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    conversation.agentTurnCount = 2;
  });
  await second.intake.handle("owner", "检查 other-project README");
  assert.equal((await second.store.get("T0001"))?.resumeSessionId, "active-session");
});
