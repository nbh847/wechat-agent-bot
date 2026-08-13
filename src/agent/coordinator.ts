import { access } from "node:fs/promises";
import { join } from "node:path";

import type { TaskStore } from "../tasks/store.js";
import type { TaskExecutor } from "../tasks/intake.js";
import type { TaskRecord } from "../tasks/types.js";
import { AGENT_PROTOCOL_VERSION, type AgentRunner } from "./types.js";

export interface ExecutionCallbacks {
  onFinished(task: TaskRecord): Promise<void> | void;
}

export class ExecutionCoordinator implements TaskExecutor {
  private active?: { taskId: string; controller: AbortController };

  constructor(
    private readonly store: TaskStore,
    private readonly runner: AgentRunner,
    private readonly callbacks: ExecutionCallbacks,
    private readonly timeoutMs = 10 * 60_000,
  ) {}

  start(task: TaskRecord): boolean {
    if (this.active || !isExecutable(task)) return false;
    const controller = new AbortController();
    this.active = { taskId: task.id, controller };
    void this.markRunningAndExecute(task, controller);
    return true;
  }

  cancel(taskId: string): boolean {
    if (this.active?.taskId !== taskId) return false;
    this.active.controller.abort(new Error("任务已由用户取消"));
    return true;
  }

  private async markRunningAndExecute(
    task: TaskRecord,
    controller: AbortController,
  ): Promise<void> {
    const timeout = setTimeout(
      () => controller.abort(new TimeoutError()),
      this.timeoutMs,
    );
    try {
      await this.store.updateTask(task.id, (next) => {
        next.status = "running";
        next.execution = { startedAt: new Date().toISOString() };
      });
      if (controller.signal.aborted) throw controller.signal.reason;
      const requiredContextFiles = await contextFiles(task.projectPath);
      if (controller.signal.aborted) throw controller.signal.reason;
      const result = await this.runner.run({
        version: AGENT_PROTOCOL_VERSION,
        taskId: task.id,
        cwd: task.projectPath,
        mode: task.mode,
        instruction: task.instruction,
        requiredContextFiles,
        access: {
          readPaths: [task.projectPath],
          writePaths: task.mode === "write" ? [task.projectPath] : [],
        },
      }, controller.signal);
      await this.store.updateTask(task.id, (next) => {
        next.status = result.status;
        next.execution = {
          ...next.execution!,
          sessionId: result.sessionId,
          finishedAt: new Date().toISOString(),
          result: result.summary,
          error: result.error,
        };
      });
    } catch (error) {
      await this.store.updateTask(task.id, (next) => {
        next.status = error instanceof TimeoutError
          ? "timed_out"
          : controller.signal.aborted
            ? "cancelled"
            : "failed";
        next.execution = {
          ...(next.execution ?? { startedAt: new Date().toISOString() }),
          finishedAt: new Date().toISOString(),
          error: safeError(error),
        };
      });
    } finally {
      clearTimeout(timeout);
      this.active = undefined;
      const finished = await this.store.get(task.id);
      if (finished) {
        try {
          await this.callbacks.onFinished(finished);
        } catch {
          // The callback owns durable delivery (for example the channel's
          // pending reply queue). A delivery error must not rerun the task.
        }
      }
    }
  }
}

function isExecutable(task: TaskRecord): boolean {
  return task.status === "received" || task.status === "approved";
}

async function contextFiles(projectPath: string): Promise<string[]> {
  const candidates = ["README.md", "AGENTS.md", "CLAUDE.md", "ROADMAP.md"];
  const existing: string[] = [];
  for (const name of candidates) {
    try {
      await access(join(projectPath, name));
      existing.push(name);
    } catch {
      // Optional project context file.
    }
  }
  return existing;
}

function safeError(error: unknown): string {
  if (error instanceof TimeoutError) return "Agent 执行超时";
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Agent 执行失败";
}

export function formatExecutionResult(task: TaskRecord): string {
  const prefix = `${task.id} ${task.status}`;
  if (task.status === "succeeded") {
    return `${prefix}：${truncate(task.execution?.result ?? "执行完成", 3_000)}`;
  }
  if (task.status === "cancelled") return `${prefix}：任务已取消。`;
  if (task.status === "timed_out") return `${prefix}：Agent 执行超时。`;
  return `${prefix}：${truncate(task.execution?.error ?? "Agent 执行失败", 500)}`;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

class TimeoutError extends Error {}
