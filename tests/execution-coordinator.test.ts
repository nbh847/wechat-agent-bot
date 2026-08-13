import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ExecutionCoordinator } from "../src/agent/coordinator.js";
import type { AgentRunner, AgentRunRequest, AgentRunResult } from "../src/agent/types.js";
import { TaskStore } from "../src/tasks/store.js";
import type { TaskRecord } from "../src/tasks/types.js";

class FakeRunner implements AgentRunner {
  requests: AgentRunRequest[] = [];
  runImpl: (request: AgentRunRequest, signal: AbortSignal) => Promise<AgentRunResult> =
    async () => ({ version: 1, status: "succeeded", summary: "done" });

  run(request: AgentRunRequest, signal: AbortSignal): Promise<AgentRunResult> {
    this.requests.push(request);
    return this.runImpl(request, signal);
  }
}

async function fixture(mode: "read" | "write" = "read", status: TaskRecord["status"] = "received") {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-execution-"));
  const serviceProject = join(root, "wechat-agent-bot");
  const project = join(root, "project");
  await mkdir(serviceProject);
  await mkdir(project);
  await writeFile(join(serviceProject, "README.md"), "# service\n");
  await writeFile(join(serviceProject, "AGENTS.md"), "service rules\n");
  await writeFile(join(project, "README.md"), "# project\n");
  await writeFile(join(project, "AGENTS.md"), "rules\n");
  const store = new TaskStore(join(root, "tasks.json"));
  const task = await store.create((id, now) => ({
    id,
    senderId: "owner",
    project: "project",
    projectPath: project,
    mode,
    instruction: "inspect project",
    actionSummary: `${mode} project: inspect project`,
    status,
    createdAt: now,
    updatedAt: now,
  }));
  return { project, serviceProject, store, task };
}

async function waitForFinish(store: TaskStore, id: string): Promise<TaskRecord> {
  for (let index = 0; index < 100; index++) {
    const task = await store.get(id);
    if (task && ["succeeded", "failed", "timed_out", "cancelled"].includes(task.status)) {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("task did not finish");
}

test("runs one eligible task with project context and persists success", async () => {
  const { project, serviceProject, store, task } = await fixture();
  const runner = new FakeRunner();
  const finished: TaskRecord[] = [];
  const coordinator = new ExecutionCoordinator(store, runner, {
    onFinished: (record) => { finished.push(record); },
  }, serviceProject);
  assert.equal(await coordinator.start(task), "started");
  const result = await waitForFinish(store, task.id);
  assert.equal(result.status, "succeeded");
  assert.equal(result.execution?.result, "done");
  assert.equal(runner.requests[0].cwd, serviceProject);
  assert.deepEqual(runner.requests[0].controlProject, { name: "wechat-agent-bot", path: serviceProject });
  assert.deepEqual(runner.requests[0].targetProject, { name: "project", path: project });
  assert.deepEqual(runner.requests[0].requiredContextFiles, [
    join(serviceProject, "README.md"), join(serviceProject, "AGENTS.md"),
    join(project, "README.md"), join(project, "AGENTS.md"),
  ]);
  assert.deepEqual(runner.requests[0].access, {
    readPaths: [serviceProject, project],
    writePaths: [],
  });
  assert.equal(runner.requests[0].persistSession, true);
  while (finished.length === 0) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(finished.length, 1);
});

test("does not start a second task while one is active", async () => {
  const first = await fixture();
  const second = await first.store.create((id, now) => ({
    ...first.task,
    id,
    createdAt: now,
    updatedAt: now,
  }));
  const runner = new FakeRunner();
  runner.runImpl = (request, signal) => request.taskId === first.task.id
    ? new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })
    : Promise.resolve({ version: 1, status: "succeeded", summary: "done" });
  const coordinator = new ExecutionCoordinator(first.store, runner, { onFinished: () => undefined }, first.serviceProject);
  assert.equal(await coordinator.start(first.task), "started");
  assert.equal(await coordinator.start(second), "queued");
  assert.equal(await coordinator.cancel(first.task.id), true);
  assert.equal((await waitForFinish(first.store, first.task.id)).status, "cancelled");
  assert.equal((await waitForFinish(first.store, second.id)).status, "succeeded");
});

test("queues only one task and resumes the same agent session", async () => {
  const first = await fixture();
  const second = await first.store.create((id, now) => ({
    ...first.task,
    id,
    parentTaskId: first.task.id,
    resumeSessionId: "session-1",
    instruction: "follow up",
    createdAt: now,
    updatedAt: now,
  }));
  const third = await first.store.create((id, now) => ({
    ...first.task,
    id,
    createdAt: now,
    updatedAt: now,
  }));
  const runner = new FakeRunner();
  const started: string[] = [];
  let release!: () => void;
  runner.runImpl = async (request) => {
    if (request.taskId === first.task.id) await new Promise<void>((resolve) => { release = resolve; });
    return { version: 1, status: "succeeded", sessionId: request.sessionId ?? "session-1", summary: "done" };
  };
  const coordinator = new ExecutionCoordinator(first.store, runner, {
    onStarted: (task) => { started.push(task.id); },
    onFinished: () => undefined,
  }, first.serviceProject);
  assert.equal(await coordinator.start(first.task), "started");
  assert.equal(await coordinator.start(second), "queued");
  assert.equal(await coordinator.start(third), "busy");
  assert.equal((await first.store.get(second.id))?.status, "queued");
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  release();
  await waitForFinish(first.store, second.id);
  assert.equal(runner.requests[1].sessionId, "session-1");
  assert.deepEqual(started, [second.id]);
  assert.equal((await first.store.get(third.id))?.status, "received");
  const conversation = await first.store.getConversation("owner");
  assert.equal(conversation?.agentSessionId, "session-1");
  for (let index = 0; index < 100; index++) {
    if ((await first.store.getConversation("owner"))?.agentTurnCount === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.equal((await first.store.getConversation("owner"))?.agentTurnCount, 2);
});

test("marks timeout and failed protocol results", async () => {
  const timed = await fixture();
  const hanging = new FakeRunner();
  hanging.runImpl = (_request, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const timeoutCoordinator = new ExecutionCoordinator(
    timed.store,
    hanging,
    { onFinished: () => undefined },
    timed.serviceProject,
    5,
  );
  timeoutCoordinator.start(timed.task);
  assert.equal((await waitForFinish(timed.store, timed.task.id)).status, "timed_out");

  const failed = await fixture();
  const runner = new FakeRunner();
  runner.runImpl = async () => ({ version: 1, status: "failed", error: "agent failure" });
  new ExecutionCoordinator(failed.store, runner, { onFinished: () => undefined }, failed.serviceProject).start(failed.task);
  const result = await waitForFinish(failed.store, failed.task.id);
  assert.equal(result.status, "failed");
  assert.equal(result.execution?.error, "agent failure");
});

test("reports limited progress without exposing agent output", async () => {
  const { store, task } = await fixture();
  const runner = new FakeRunner();
  runner.runImpl = (_request, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const progress: string[] = [];
  const coordinator = new ExecutionCoordinator(
    store,
    runner,
    {
      onProgress: (current) => { progress.push(`${current.id}:${current.status}`); },
      onFinished: () => undefined,
    },
    (await fixture()).serviceProject,
    50,
    "test-adapter",
    10,
  );
  await coordinator.start(task);
  const result = await waitForFinish(store, task.id);
  assert.equal(result.status, "timed_out");
  assert.ok(progress.length >= 1 && progress.length <= 6);
  assert.ok(progress.every((entry) => entry === `${task.id}:running`));
});

test("rejects tasks that are not received or approved", async () => {
  const { serviceProject, store, task } = await fixture("write", "awaiting_confirmation");
  const coordinator = new ExecutionCoordinator(store, new FakeRunner(), { onFinished: () => undefined }, serviceProject);
  assert.equal(await coordinator.start(task), "rejected");
});

test("approved writes run from the target in an isolated non-persistent session", async () => {
  const { project, serviceProject, store, task } = await fixture("write", "approved");
  await store.updateConversation("owner", (conversation) => {
    conversation.currentTaskId = task.id;
    conversation.agentSessionId = "read-session";
  });
  task.resumeSessionId = "read-session";
  const runner = new FakeRunner();
  runner.runImpl = async () => ({ version: 1, status: "succeeded", sessionId: "write-session", summary: "written" });
  const coordinator = new ExecutionCoordinator(store, runner, { onFinished: () => undefined }, serviceProject);
  assert.equal(await coordinator.start(task), "started");
  assert.equal((await waitForFinish(store, task.id)).status, "succeeded");
  assert.equal(runner.requests[0].cwd, project);
  assert.equal(runner.requests[0].sessionId, undefined);
  assert.equal(runner.requests[0].persistSession, false);
  assert.deepEqual(runner.requests[0].access.writePaths, [project]);
  assert.equal((await store.getConversation("owner"))?.agentSessionId, "read-session");
});

test("a result delivery failure does not rerun or change the completed task", async () => {
  const { serviceProject, store, task } = await fixture();
  const runner = new FakeRunner();
  const coordinator = new ExecutionCoordinator(store, runner, {
    onFinished: () => { throw new Error("delivery failed after persistence"); },
  }, serviceProject);
  coordinator.start(task);
  const result = await waitForFinish(store, task.id);
  assert.equal(result.status, "succeeded");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(runner.requests.length, 1);
});
