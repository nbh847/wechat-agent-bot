import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { TaskIntake, type TaskExecutor } from "../src/tasks/intake.js";
import { TaskStore } from "../src/tasks/store.js";
import type { TaskProposal } from "../src/tasks/types.js";

async function createIntake(executor?: TaskExecutor) {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-tasks-"));
  const workspace = join(root, "workspace");
  const home = join(root, "home");
  await mkdir(join(workspace, "wechat-agent-bot"), { recursive: true });
  await mkdir(join(workspace, "other-project"));
  await mkdir(join(home, ".openclaw"), { recursive: true });
  await mkdir(join(home, ".qclaw"), { recursive: true });
  await mkdir(join(home, "Library/Application Support/QClaw"), { recursive: true });
  await mkdir(join(home, "Library/Application Support/com.tencent.qclaw"), { recursive: true });
  await mkdir(join(home, ".ssh"));
  const statePath = join(root, "runtime-data", "tasks.json");
  const store = new TaskStore(statePath);
  const intake = new TaskIntake(store, workspace, "wechat-agent-bot", async () => "owner", executor, home);
  return { home, workspace, intake, statePath, store };
}

function planner(proposal: TaskProposal | ((instruction: string) => TaskProposal)): TaskExecutor {
  return {
    plan: async (task) => typeof proposal === "function" ? proposal(task.instruction) : proposal,
    start: async () => "started",
    cancel: async () => false,
  };
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
  assert.equal(response, "当前没有可用执行端，任务未执行。");
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
  assert.match(response, /等待二次确认：跨项目写入/);
  assert.doesNotMatch(response, /T0001|confirm|reject/);
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");

  assert.equal(await intake.handle("owner", "confirm T0001 000000"), "T0001 确认码不匹配。");
  assert.equal(
    await intake.handle("owner", "确认"),
    "已确认授权；当前没有可用执行端，任务未执行。",
  );
  assert.equal((await store.get("T0001"))?.status, "approved");
  assert.equal(await intake.handle("owner", "确认"), "当前没有待确认操作。");
});

test("natural confirmation selects the current pending task without exposing ids", async () => {
  const { intake, store } = await createIntake();
  const first = await intake.handle("owner", "task other-project write update README title");
  const second = await intake.handle("owner", "task other-project write update ROADMAP status");
  assert.doesNotMatch(first, /T0001|confirm T/);
  assert.doesNotMatch(second, /T0002|confirm T/);
  assert.equal(await intake.handle("owner", "确认"), "已确认授权；当前没有可用执行端，任务未执行。");
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");
  assert.equal((await store.get("T0002"))?.status, "approved");
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
  assert.equal(response, "当前没有可用执行端，任务未执行。");
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
  assert.doesNotMatch(first, /T0001|reject T/);
  assert.equal(await intake.handle("owner", "拒绝"), "已拒绝。");
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
    "收到，正在生成回复中...",
  );
  assert.equal(await intake.handle("owner", "cancel T0001"), "T0001 正在取消。");
  assert.deepEqual(cancelled, ["T0001"]);
  assert.equal((await store.get("T0001"))?.status, "received");
});

test("natural language is delegated as raw input and the Agent proposal is validated", async () => {
  const fixture = await createIntake();
  const calls: string[] = [];
  const executor = planner((instruction) => {
    calls.push(instruction);
    return {
      target: { name: "other-project", path: join(fixture.workspace, "other-project") },
      mode: "read",
      action: "检查 README 并总结定位",
      sensitiveAccess: false,
      readPaths: [join(fixture.workspace, "other-project")],
      writePaths: [],
    };
  });
  const intake = new TaskIntake(
    fixture.store,
    fixture.workspace,
    "wechat-agent-bot",
    async () => "owner",
    executor,
    fixture.home,
  );
  assert.equal(await intake.handle("owner", "请帮我看看 README 并总结定位"), "收到，正在生成回复中...");
  assert.deepEqual(calls, ["请帮我看看 README 并总结定位"]);
  assert.equal((await fixture.store.get("T0001"))?.project, "other-project");
  assert.equal((await fixture.store.get("T0001"))?.mode, "read");
});

test("natural language uses the Agent proposal for a cross-project confirmation", async () => {
  const { intake, store } = await createIntake(planner((instruction) => ({
    target: { name: "other-project", path: instruction.includes("标题") ? "" : "" },
    mode: "write",
    action: instruction,
    sensitiveAccess: false,
    readPaths: [],
    writePaths: [],
  })));
  // A proposal with an invalid path is rejected by the Bot; it must not guess
  // a project from the prose or silently widen the write scope.
  const response = await intake.handle("owner", "修改 other-project 的 README 标题");
  assert.match(response, /Agent 返回的执行计划未通过安全校验/);
  assert.equal((await store.get("T0001"))?.status, "failed");
});

test("natural language low-risk writes execute only after an Agent plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-planner-"));
  const workspace = join(root, "workspace");
  const home = join(root, "home");
  const control = join(workspace, "wechat-agent-bot");
  await mkdir(control, { recursive: true });
  await mkdir(home, { recursive: true });
  const store = new TaskStore(join(root, "tasks.json"));
  const executor: TaskExecutor = {
    plan: async () => ({
      target: { name: "wechat-agent-bot", path: control },
      mode: "write",
      action: "把待办想法记录到 ROADMAP.md",
      sensitiveAccess: false,
      readPaths: [control],
      writePaths: [control],
    }),
    start: async () => "started",
    cancel: async () => false,
  };
  const intake = new TaskIntake(store, workspace, "wechat-agent-bot", async () => "owner", executor, home);
  assert.equal(await intake.handle("owner", "把待办想法记录到对应文档"), "收到，正在生成回复中...");
  assert.equal((await store.get("T0001"))?.mode, "write");
  assert.equal((await store.get("T0001"))?.project, "wechat-agent-bot");
  assert.equal((await store.get("T0001"))?.confirmation, undefined);
});

test("conversation controls switch tasks, report status and start a new session", async () => {
  const { intake, store } = await createIntake();
  await intake.handle("owner", "task other-project read inspect README");
  assert.equal(await intake.handle("owner", "状态"), "T0001：received；read other-project: inspect README");
  assert.equal(await intake.handle("owner", "继续 T0001"), "已切换到 T0001；任务目标：other-project。");
  assert.equal(await intake.handle("owner", "新任务"), "已开始新会话。请说明目标项目和任务。");
  const conversation = await store.getConversation("owner");
  assert.equal(conversation?.currentTaskId, undefined);
  assert.equal(conversation?.defaultTargetProject, undefined);
  assert.equal(conversation?.agentSessionId, undefined);
});

test("current project stays the control project when a task names another target", async () => {
  const { intake } = await createIntake();
  assert.equal(
    await intake.handle("owner", "当前项目是哪个项目啊？"),
    "散帅，Agent 当前运行项目固定为 wechat-agent-bot。",
  );
});

test("local app discovery is delegated to the Agent and its paths are revalidated", async () => {
  const fixture = await createIntake();
  const executor = planner({
    target: { name: "~/.qclaw", path: join(fixture.home, ".qclaw") },
    mode: "read",
    action: "读取 QClaw 任务配置，跳过凭据、密钥、token、日志和运行记录",
    sensitiveAccess: false,
    readPaths: [join(fixture.home, ".qclaw")],
    writePaths: [],
  });
  const intake = new TaskIntake(fixture.store, fixture.workspace, "wechat-agent-bot", async () => "owner", executor, fixture.home);
  const { home, store } = fixture;
  assert.equal(await intake.handle("owner", "查看 QClaw 专属配置和任务"), "收到，正在生成回复中...");
  const task = await store.get("T0001");
  assert.equal(task?.project, "~/.qclaw");
  assert.deepEqual(task?.authorizedReadPaths, [await realpath(join(home, ".qclaw"))]);
});

test("Agent plans outside the allowed workspace or home are rejected", async () => {
  const { intake, store } = await createIntake(planner({
    target: { name: "tmp", path: "/tmp" },
    mode: "read",
    action: "读取目录",
    sensitiveAccess: false,
    readPaths: ["/tmp"],
    writePaths: [],
  }));
  const response = await intake.handle("owner", "读取 /tmp 的内容");
  assert.match(response, /Agent 返回的执行计划未通过安全校验/);
  assert.equal((await store.get("T0001"))?.status, "failed");
});

test("sensitive local read plans still require confirmation", async () => {
  const fixture = await createIntake();
  const executor = planner({
    target: { name: "~/.ssh", path: join(fixture.home, ".ssh") },
    mode: "read",
    action: "检查目录",
    sensitiveAccess: true,
    readPaths: [join(fixture.home, ".ssh")],
    writePaths: [],
  });
  const intake = new TaskIntake(fixture.store, fixture.workspace, "wechat-agent-bot", async () => "owner", executor, fixture.home);
  const { home, store } = fixture;
  const response = await intake.handle("owner", "检查本机密钥目录");
  assert.match(response, /等待二次确认：凭证、密钥或 \.env 操作/);
  assert.equal((await store.get("T0001"))?.status, "awaiting_confirmation");
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
    conversation.sessionReadPaths = [join("unused", ".openclaw")];
  });
  await intake.handle("owner", "检查 other-project README");
  const task = await store.get("T0001");
  assert.equal(task?.resumeSessionId, undefined);
  assert.deepEqual(task?.authorizedReadPaths, [task?.projectPath]);
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
    conversation.sessionReadPaths = [join("unused", ".openclaw")];
  });
  await first.intake.handle("owner", "检查 other-project README");
  const rotated = await first.store.get("T0001");
  assert.equal(rotated?.resumeSessionId, undefined);
  assert.deepEqual(rotated?.authorizedReadPaths, [rotated?.projectPath]);
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
