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
  const project = join(root, "project");
  await mkdir(project);
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
  return { project, store, task };
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
  const { project, store, task } = await fixture();
  const runner = new FakeRunner();
  const finished: TaskRecord[] = [];
  const coordinator = new ExecutionCoordinator(store, runner, {
    onFinished: (record) => { finished.push(record); },
  });
  assert.equal(coordinator.start(task), true);
  const result = await waitForFinish(store, task.id);
  assert.equal(result.status, "succeeded");
  assert.equal(result.execution?.result, "done");
  assert.equal(runner.requests[0].cwd, project);
  assert.deepEqual(runner.requests[0].requiredContextFiles, ["README.md", "AGENTS.md"]);
  assert.deepEqual(runner.requests[0].access, {
    readPaths: [project],
    writePaths: [],
  });
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
  runner.runImpl = (_request, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  const coordinator = new ExecutionCoordinator(first.store, runner, { onFinished: () => undefined });
  assert.equal(coordinator.start(first.task), true);
  assert.equal(coordinator.start(second), false);
  assert.equal(coordinator.cancel(first.task.id), true);
  assert.equal((await waitForFinish(first.store, first.task.id)).status, "cancelled");
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
    5,
  );
  timeoutCoordinator.start(timed.task);
  assert.equal((await waitForFinish(timed.store, timed.task.id)).status, "timed_out");

  const failed = await fixture();
  const runner = new FakeRunner();
  runner.runImpl = async () => ({ version: 1, status: "failed", error: "agent failure" });
  new ExecutionCoordinator(failed.store, runner, { onFinished: () => undefined }).start(failed.task);
  const result = await waitForFinish(failed.store, failed.task.id);
  assert.equal(result.status, "failed");
  assert.equal(result.execution?.error, "agent failure");
});

test("rejects tasks that are not received or approved", async () => {
  const { store, task } = await fixture("write", "awaiting_confirmation");
  const coordinator = new ExecutionCoordinator(store, new FakeRunner(), { onFinished: () => undefined });
  assert.equal(coordinator.start(task), false);
});

test("a result delivery failure does not rerun or change the completed task", async () => {
  const { store, task } = await fixture();
  const runner = new FakeRunner();
  const coordinator = new ExecutionCoordinator(store, runner, {
    onFinished: () => { throw new Error("delivery failed after persistence"); },
  });
  coordinator.start(task);
  const result = await waitForFinish(store, task.id);
  assert.equal(result.status, "succeeded");
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(runner.requests.length, 1);
});
