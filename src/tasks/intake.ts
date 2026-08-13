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

const AGENT_SESSION_TURN_LIMIT = 30;
const SESSION_TIME_ZONE = "Asia/Shanghai";

export interface TaskExecutor {
  start(task: TaskRecord): Promise<"started" | "queued" | "busy" | "rejected">;
  cancel(taskId: string): Promise<boolean>;
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
        return this.naturalLanguage(senderId, text);
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
    const conversation = await this.store.getConversation(senderId);
    const session = await this.sessionForNextTask(conversation, senderId);
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
      parentTaskId: conversation?.currentTaskId,
      resumeSessionId: session.sessionId,
      handoffSummary: session.handoffSummary,
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
      const outcome = this.executor ? await this.executor.start(task) : undefined;
      if (outcome === "busy") await this.markQueueFull(task.id);
      else if (outcome !== "rejected") await this.bindConversation(task);
      return this.startResponse(task.id, outcome);
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
    if (await this.executor?.cancel(id)) return `${id} 正在取消。`;
    if (["cancelled", "rejected", "succeeded", "failed", "timed_out", "interrupted"].includes(task.status)) {
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
    if (!approved) return "未找到对应任务。";
    const outcome = this.executor ? await this.executor.start(approved) : undefined;
    if (outcome === "busy") await this.markQueueFull(id);
    else if (outcome !== "rejected") await this.bindConversation(approved);
    if (outcome === "started") return `${id} 已确认授权并开始执行。`;
    if (outcome === "queued") return `${id} 已确认授权并排队等待执行。`;
    if (outcome === "busy") return `${id} 已确认授权，但执行队列已满。`;
    return `${id} 已确认授权；当前没有可用执行端，任务未执行。`;
  }

  private async naturalLanguage(senderId: string, text: string): Promise<string> {
    if (!text) return HELP;
    if (/^(?:状态|status)$/i.test(text)) {
      const conversation = await this.store.getConversation(senderId);
      return conversation?.currentTaskId
        ? this.status(senderId, `status ${conversation.currentTaskId}`)
        : "当前没有任务。";
    }
    if (/^(?:取消当前任务|cancel current)$/i.test(text)) {
      const conversation = await this.store.getConversation(senderId);
      return conversation?.currentTaskId
        ? this.cancel(senderId, `cancel ${conversation.currentTaskId}`)
        : "当前没有任务。";
    }
    if (/^(?:新任务|新会话|new session)$/i.test(text)) {
      await this.store.updateConversation(senderId, (conversation) => {
        conversation.currentTaskId = undefined;
        conversation.defaultTargetProject = undefined;
        conversation.defaultTargetProjectPath = undefined;
        conversation.agentSessionId = undefined;
        conversation.agentSessionDate = undefined;
        conversation.agentTurnCount = 0;
      });
      return "已开始新会话。请说明目标项目和任务。";
    }
    const continueMatch = /^(?:继续|continue)\s+(T\d+)$/i.exec(text);
    if (continueMatch) {
      const task = await this.ownedTask(senderId, continueMatch[1].toUpperCase());
      if (!task) return "未找到对应任务。";
      await this.store.updateConversation(senderId, (conversation) => {
        conversation.currentTaskId = task.id;
        conversation.defaultTargetProject = task.project;
        conversation.defaultTargetProjectPath = task.projectPath;
        conversation.agentSessionId = task.execution?.sessionId;
      });
      return `已切换到 ${task.id}；默认目标项目：${task.project}。`;
    }
    const switchMatch = /^(?:切换项目|switch project)\s+(\S+)$/i.exec(text);
    if (switchMatch) {
      try {
        const project = await resolveProject(this.workspacePath, switchMatch[1]);
        await this.store.updateConversation(senderId, (conversation) => {
          conversation.currentTaskId = undefined;
          conversation.defaultTargetProject = project.name;
          conversation.defaultTargetProjectPath = project.path;
          conversation.agentSessionId = undefined;
        });
        return `已设置默认目标项目：${project.name}。请继续说明任务。`;
      } catch (error) {
        return `拒绝：${(error as Error).message}。`;
      }
    }

    const conversation = await this.store.getConversation(senderId);
    const mentionedProjects = await this.findMentionedProjects(text);
    if (mentionedProjects.length > 1) {
      return `无法确定目标项目：${mentionedProjects.map((project) => project.name).join("、")}。请使用“切换项目 <project>”。`;
    }
    const project = mentionedProjects[0] ?? (
      conversation?.defaultTargetProject && conversation.defaultTargetProjectPath
        ? { name: conversation.defaultTargetProject, path: conversation.defaultTargetProjectPath }
        : undefined
    );
    if (!project) {
      return "无法确定目标项目。请说“切换项目 <project>”，或使用 task <project> <read|write> <任务说明>。";
    }
    const mode = inferMode(text);
    const parent = conversation?.currentTaskId;
    const session = await this.sessionForNextTask(conversation, senderId);
    return this.createNaturalTask(
      senderId,
      project,
      mode,
      text,
      parent,
      session.sessionId,
      session.handoffSummary,
    );
  }

  private async createNaturalTask(
    senderId: string,
    project: { name: string; path: string },
    mode: TaskMode,
    instruction: string,
    parentTaskId?: string,
    resumeSessionId?: string,
    handoffSummary?: string,
  ): Promise<string> {
    const reason = confirmationReason(project.name, this.currentProject, mode, instruction)
      ?? (mode === "write" ? "口语化写入操作" : undefined);
    const code = reason ? randomBytes(3).toString("hex").toUpperCase() : undefined;
    const actionSummary = `${mode} ${project.name}: ${instruction}`;
    const task = await this.store.create((id, now) => ({
      id, senderId, project: project.name, projectPath: project.path, mode,
      instruction, actionSummary, parentTaskId, resumeSessionId, handoffSummary,
      status: reason ? "awaiting_confirmation" : "received",
      confirmation: reason && code ? {
        codeHash: hashCode(id, actionSummary, code), reason, createdAt: now,
      } : undefined,
      createdAt: now, updatedAt: now,
    }));
    if (reason && code) {
      await this.bindConversation(task);
      return [
        `${task.id} 等待二次确认：${reason}。`,
        `系统理解：项目 ${project.name}；模式 ${mode}；动作 ${instruction}`,
        `确认：confirm ${task.id} ${code}`,
        `拒绝：reject ${task.id} ${code}`,
      ].join("\n");
    }
    const outcome = this.executor ? await this.executor.start(task) : undefined;
    if (outcome === "busy") {
      await this.markQueueFull(task.id);
    } else if (outcome !== "rejected") {
      await this.bindConversation(task);
    }
    return this.startResponse(task.id, outcome);
  }

  private async findMentionedProjects(text: string): Promise<Array<{ name: string; path: string }>> {
    const { readdir } = await import("node:fs/promises");
    const names = await readdir(this.workspacePath);
    const matches = names.filter((name) => text.toLowerCase().includes(name.toLowerCase()));
    return Promise.all(matches.map((name) => resolveProject(this.workspacePath, name)));
  }

  private async bindConversation(task: TaskRecord): Promise<void> {
    await this.store.updateConversation(task.senderId, (conversation) => {
      conversation.currentTaskId = task.id;
      conversation.defaultTargetProject = task.project;
      conversation.defaultTargetProjectPath = task.projectPath;
      conversation.agentSessionId = task.resumeSessionId;
    });
  }

  private async sessionForNextTask(
    conversation: Awaited<ReturnType<TaskStore["getConversation"]>>,
    senderId: string,
  ): Promise<{ sessionId?: string; handoffSummary?: string }> {
    if (!conversation?.agentSessionId) return {};
    const expiredByDate = conversation.agentSessionDate !== undefined
      && conversation.agentSessionDate !== shanghaiDate();
    const expiredByTurns = (conversation.agentTurnCount ?? 0) >= AGENT_SESSION_TURN_LIMIT;
    if (!expiredByDate && !expiredByTurns) return { sessionId: conversation.agentSessionId };
    const current = conversation.currentTaskId
      ? await this.ownedTask(senderId, conversation.currentTaskId)
      : undefined;
    return { handoffSummary: buildHandoffSummary(conversation, current, expiredByDate ? "跨自然日" : "达到 30 轮") };
  }

  private async markQueueFull(taskId: string): Promise<void> {
    await this.store.updateTask(taskId, (task) => {
      task.status = "failed";
      task.execution = {
        startedAt: task.updatedAt,
        finishedAt: new Date().toISOString(),
        error: "执行队列已满",
      };
    });
  }

  private startResponse(id: string, outcome?: "started" | "queued" | "busy" | "rejected"): string {
    if (outcome === "started") return `${id} 已接收并开始执行。`;
    if (outcome === "queued") return `${id} 已接收并排队等待执行。`;
    if (outcome === "busy") return `${id} 未执行：当前已有运行任务和一个排队任务。`;
    return `已接收 ${id}：当前没有可用执行端，任务未执行。`;
  }

  private async ownedTask(senderId: string, id: string): Promise<TaskRecord | undefined> {
    const task = await this.store.get(id);
    return task?.senderId === senderId ? task : undefined;
  }
}

function inferMode(text: string): TaskMode {
  return /修改|新增|创建|写入|实现|修复|更新|编辑|删除|安装|提交|commit|\b(?:write|edit|create|fix|update|delete|install)\b/i.test(text)
    ? "write"
    : "read";
}

function shanghaiDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SESSION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function buildHandoffSummary(
  conversation: NonNullable<Awaited<ReturnType<TaskStore["getConversation"]>>>,
  task: TaskRecord | undefined,
  reason: string,
): string {
  const lines = [
    `上下文轮换原因：${reason}。`,
    "Agent 工作目录固定为 wechat-agent-bot；目标项目只是每轮动态访问范围。",
    conversation.defaultTargetProject ? `默认目标项目：${conversation.defaultTargetProject}。` : "",
    task ? `上一任务：${task.id}（${task.status}）${task.actionSummary}。` : "",
    task?.execution?.result ? `上一结果：${task.execution.result}` : "",
    "跨项目写入及红线操作仍须本轮独立确认，不得继承旧授权。",
  ].filter(Boolean);
  return lines.join("\n").slice(0, 1_000);
}

function hashCode(taskId: string, actionSummary: string, code: string): string {
  return createHash("sha256").update(`${taskId}\0${actionSummary}\0${code}`).digest("hex");
}
