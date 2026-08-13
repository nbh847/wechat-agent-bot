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
  assert.match(response, /^已接收 T0001/);
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
  assert.match(await intake.handle("owner", `confirm T0001 ${code}`), /已确认授权/);
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
