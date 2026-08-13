import { createHash, randomBytes } from "node:crypto";

import { confirmationReason, resolveProject } from "./policy.js";
import type { TaskStore } from "./store.js";
import type { TaskMode, TaskRecord } from "./types.js";

const HELP = [
  "指令格式：",
  "task <project> <read|write> <任务说明>",
  "status <task-id>",
  "cancel <task-id>",
  "confirm <task-id> <确认码>",
  "reject <task-id> <确认码>",
].join("\n");

export interface TaskExecutor {
  start(task: TaskRecord): boolean;
  cancel(taskId: string): boolean;
}

export class TaskIntake {
  constructor(
    private readonly store: TaskStore,
    private readonly workspacePath: string,
    private readonly currentProject: string,
    private readonly authorizedSenderId: () => Promise<string | undefined>,
    private readonly executor?: TaskExecutor,
  ) {}

  async handle(senderId: string, input: string): Promise<string> {
    const authorized = await this.authorizedSenderId();
    if (!authorized || senderId !== authorized) return "拒绝：当前微信用户未获得任务权限。";

    const text = input.trim();
    const [command = ""] = text.split(/\s+/, 1);
    switch (command.toLowerCase()) {
      case "task":
        return this.createTask(senderId, text);
      case "status":
        return this.status(senderId, text);
      case "cancel":
        return this.cancel(senderId, text);
      case "confirm":
        return this.decide(senderId, text, true);
      case "reject":
        return this.decide(senderId, text, false);
      default:
        return HELP;
    }
  }

  private async createTask(senderId: string, text: string): Promise<string> {
    const match = /^task\s+(\S+)\s+(read|write)\s+([\s\S]+)$/i.exec(text);
    if (!match) return HELP;
    const [, projectInput, rawMode, instruction] = match;
    const mode = rawMode.toLowerCase() as TaskMode;
    let project;
    try {
      project = await resolveProject(this.workspacePath, projectInput);
    } catch (error) {
      return `拒绝：${(error as Error).message}。`;
    }
    const reason = confirmationReason(project.name, this.currentProject, mode, instruction);
    const code = reason ? randomBytes(3).toString("hex").toUpperCase() : undefined;
    const actionSummary = `${mode} ${project.name}: ${instruction}`;
    const task = await this.store.create((id, now) => ({
      id,
      senderId,
      project: project.name,
      projectPath: project.path,
      mode,
      instruction,
      actionSummary,
      status: reason ? "awaiting_confirmation" : "received",
      confirmation: reason && code ? {
        codeHash: hashCode(id, actionSummary, code),
        reason,
        createdAt: now,
      } : undefined,
      createdAt: now,
      updatedAt: now,
    }));
    if (!reason) {
      const started = this.executor?.start(task) ?? false;
      return started
        ? `${task.id} 已接收并开始执行。`
        : `已接收 ${task.id}：当前没有可用执行端，任务未执行。`;
    }
    return [
      `${task.id} 等待二次确认：${reason}。`,
      `目标：${task.project}`,
      `动作：${task.actionSummary}`,
      `确认：confirm ${task.id} ${code}`,
      `拒绝：reject ${task.id} ${code}`,
    ].join("\n");
  }

  private async status(senderId: string, text: string): Promise<string> {
    const match = /^status\s+(T\d+)$/i.exec(text);
    if (!match) return HELP;
    const task = await this.ownedTask(senderId, match[1].toUpperCase());
    return task ? `${task.id}：${task.status}；${task.actionSummary}` : "未找到对应任务。";
  }

  private async cancel(senderId: string, text: string): Promise<string> {
    const match = /^cancel\s+(T\d+)$/i.exec(text);
    if (!match) return HELP;
    const id = match[1].toUpperCase();
    const task = await this.ownedTask(senderId, id);
    if (!task) return "未找到对应任务。";
    if (this.executor?.cancel(id)) return `${id} 正在取消。`;
    if (["cancelled", "rejected", "succeeded", "failed", "timed_out"].includes(task.status)) {
      return `${id} 已结束，不能取消。`;
    }
    if (task.status === "running") return `${id} 无法取消。`;
    await this.store.updateTask(id, (next) => {
      next.status = "cancelled";
      next.confirmation = undefined;
    });
    return `${id} 已取消。`;
  }

  private async decide(senderId: string, text: string, approve: boolean): Promise<string> {
    const match = /^(?:confirm|reject)\s+(T\d+)\s+([A-F0-9]{6})$/i.exec(text);
    if (!match) return HELP;
    const id = match[1].toUpperCase();
    const code = match[2].toUpperCase();
    const task = await this.ownedTask(senderId, id);
    if (!task) return "未找到对应任务。";
    if (task.status !== "awaiting_confirmation" || !task.confirmation) {
      return `${id} 当前不接受确认。`;
    }
    if (task.confirmation.codeHash !== hashCode(task.id, task.actionSummary, code)) {
      return `${id} 确认码不匹配。`;
    }
    await this.store.updateTask(id, (next) => {
      next.status = approve ? "approved" : "rejected";
      next.confirmation = undefined;
    });
    if (!approve) return `${id} 已拒绝。`;
    const approved = await this.store.get(id);
    const started = approved ? (this.executor?.start(approved) ?? false) : false;
    return started
      ? `${id} 已确认授权并开始执行。`
      : `${id} 已确认授权；当前没有可用执行端，任务未执行。`;
  }

  private async ownedTask(senderId: string, id: string): Promise<TaskRecord | undefined> {
    const task = await this.store.get(id);
    return task?.senderId === senderId ? task : undefined;
  }
}

function hashCode(taskId: string, actionSummary: string, code: string): string {
  return createHash("sha256").update(`${taskId}\0${actionSummary}\0${code}`).digest("hex");
}
