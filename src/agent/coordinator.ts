import { access } from "node:fs/promises";
import { join } from "node:path";

import type { TaskStore } from "../tasks/store.js";
import type { TaskExecutor } from "../tasks/intake.js";
import type { TaskRecord } from "../tasks/types.js";
import { AGENT_PROTOCOL_VERSION, type AgentRunner } from "./types.js";

export interface ExecutionCallbacks {
  onStarted?(task: TaskRecord): Promise<void> | void;
  onProgress?(task: TaskRecord): Promise<void> | void;
  onFinished(task: TaskRecord): Promise<void> | void;
}

export class ExecutionCoordinator implements TaskExecutor {
  private active?: { taskId: string; controller: AbortController };
  private queued?: TaskRecord;

  constructor(
    private readonly store: TaskStore,
    private readonly runner: AgentRunner,
    private readonly callbacks: ExecutionCallbacks,
    private readonly serviceProjectPath: string,
    private readonly timeoutMs = 10 * 60_000,
    private readonly adapterId = "configured-process-adapter",
    private readonly progressIntervalMs = 2 * 60_000,
  ) {}

  async start(task: TaskRecord): Promise<"started" | "queued" | "busy" | "rejected"> {
    if (!isExecutable(task)) return "rejected";
    if (this.active) {
      if (this.queued) return "busy";
      this.queued = task;
      await this.store.updateTask(task.id, (next) => { next.status = "queued"; });
      return "queued";
    }
    this.launch(task, false);
    return "started";
  }

  private launch(task: TaskRecord, notifyStarted: boolean): void {
    const controller = new AbortController();
    this.active = { taskId: task.id, controller };
    void this.markRunningAndExecute(task, controller, notifyStarted);
  }

  async cancel(taskId: string): Promise<boolean> {
    if (this.active?.taskId === taskId) {
      this.active.controller.abort(new Error("任务已由用户取消"));
      return true;
    }
    if (this.queued?.id === taskId) {
      this.queued = undefined;
      await this.store.updateTask(taskId, (task) => { task.status = "cancelled"; });
      return true;
    }
    return false;
  }

  private async markRunningAndExecute(
    task: TaskRecord,
    controller: AbortController,
    notifyStarted: boolean,
  ): Promise<void> {
    const timeout = setTimeout(
      () => controller.abort(new TimeoutError()),
      this.timeoutMs,
    );
    const progress = this.callbacks.onProgress
      ? setInterval(() => {
          void this.store.get(task.id).then(async (current) => {
            if (!current || current.status !== "running") return;
            try {
              await this.callbacks.onProgress?.(current);
            } catch {
              // Progress delivery is best effort and must not fail the task.
            }
          });
        }, this.progressIntervalMs)
      : undefined;
    progress?.unref();
    try {
      await this.store.updateTask(task.id, (next) => {
        next.status = "running";
        next.execution = { startedAt: new Date().toISOString() };
      });
      await this.store.updateConversation(task.senderId, (conversation) => {
        conversation.agentSessionDate = shanghaiDate();
        conversation.agentTurnCount = (conversation.agentTurnCount ?? 0) + 1;
        if (conversation.currentTaskId && conversation.currentTaskId !== task.id) return;
        conversation.currentTaskId = task.id;
        conversation.defaultTargetProject = task.project;
        conversation.defaultTargetProjectPath = task.projectPath;
        conversation.adapterId = this.adapterId;
        conversation.agentSessionId = task.resumeSessionId;
      });
      if (notifyStarted) {
        try {
          await this.callbacks.onStarted?.((await this.store.get(task.id)) ?? task);
        } catch {
          // Progress delivery is best effort and must not fail or rerun the task.
        }
      }
      if (controller.signal.aborted) throw controller.signal.reason;
      const requiredContextFiles = [
        ...await contextFiles(this.serviceProjectPath),
        ...await contextFiles(task.projectPath),
      ].filter((path, index, paths) => paths.indexOf(path) === index);
      if (controller.signal.aborted) throw controller.signal.reason;
      const result = await this.runner.run({
        version: AGENT_PROTOCOL_VERSION,
        taskId: task.id,
        cwd: task.mode === "write" ? task.projectPath : this.serviceProjectPath,
        controlProject: { name: "wechat-agent-bot", path: this.serviceProjectPath },
        targetProject: { name: task.project, path: task.projectPath },
        mode: task.mode,
        instruction: task.instruction,
        sessionId: task.mode === "write" ? undefined : task.resumeSessionId,
        handoffSummary: task.handoffSummary,
        persistSession: task.mode === "read",
        requiredContextFiles,
        access: {
          readPaths: [this.serviceProjectPath, task.projectPath]
            .filter((path, index, paths) => paths.indexOf(path) === index),
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
      await this.store.updateConversation(task.senderId, (conversation) => {
        if (conversation.currentTaskId && conversation.currentTaskId !== task.id) return;
        conversation.currentTaskId = task.id;
        conversation.defaultTargetProject = task.project;
        conversation.defaultTargetProjectPath = task.projectPath;
        conversation.adapterId = this.adapterId;
        if (task.mode === "read") {
          conversation.agentSessionId = result.sessionId ?? task.resumeSessionId;
        }
        conversation.agentSessionDate = shanghaiDate();
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
      if (progress) clearInterval(progress);
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
      let next = this.queued;
      this.queued = undefined;
      if (next && finished?.execution?.sessionId && next.parentTaskId === finished.id && !next.resumeSessionId) {
        next = (await this.store.updateTask(next.id, (queued) => {
          queued.resumeSessionId = finished.execution?.sessionId;
        })) ?? next;
      }
      if (next) this.launch(next, true);
    }
  }
}

function isExecutable(task: TaskRecord): boolean {
  return task.status === "received" || task.status === "approved" || task.status === "queued";
}

async function contextFiles(projectPath: string): Promise<string[]> {
  const candidates = ["README.md", "AGENTS.md", "CLAUDE.md", "ROADMAP.md"];
  const existing: string[] = [];
  for (const name of candidates) {
    try {
      await access(join(projectPath, name));
      existing.push(join(projectPath, name));
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
  if (task.status === "interrupted") return `${prefix}：服务重启导致任务中断，未自动重试。`;
  return `${prefix}：${truncate(task.execution?.error ?? "Agent 执行失败", 500)}`;
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

class TimeoutError extends Error {}

function shanghaiDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
