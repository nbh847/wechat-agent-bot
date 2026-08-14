import { createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";

import {
  confirmationReason,
  proposalConfirmationReason,
  resolveProject,
  validateTaskProposal,
  type ResolvedProject,
} from "./policy.js";
import type { TaskStore } from "./store.js";
import type { TaskMode, TaskProposal, TaskRecord } from "./types.js";

const HELP = [
  "指令格式：",
  "task <project> <read|write> <任务说明>",
  "status <task-id>",
  "cancel <task-id>",
  "确认／拒绝",
  "confirm <task-id> <确认码>",
  "reject <task-id> <确认码>",
].join("\n");

const AGENT_SESSION_TURN_LIMIT = 30;
const SESSION_TIME_ZONE = "Asia/Shanghai";

export interface TaskExecutor {
  plan?(task: TaskRecord): Promise<TaskProposal>;
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
    private readonly homePath = homedir(),
  ) {}

  async handle(senderId: string, input: string): Promise<string> {
    const authorized = await this.authorizedSenderId();
    if (!authorized || senderId !== authorized) return "拒绝：当前微信用户未获得任务权限。";

    const text = input.trim();
    const naturalDecision = /^(确认|拒绝)(?:\s+([\s\S]+))?$/.exec(text);
    if (naturalDecision) {
      return this.decidePending(senderId, naturalDecision[1] === "确认", naturalDecision[2]);
    }
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
    const authorizedReadPaths = mode === "read"
      ? mergeReadPaths(session.resetReadPaths ? [] : conversation?.sessionReadPaths, project.readPaths ?? [project.path])
      : [project.path];
    const code = reason ? randomBytes(3).toString("hex").toUpperCase() : undefined;
    const actionSummary = `${mode} ${project.name}: ${instruction}`;
    const task = await this.store.create((id, now) => ({
      id,
      senderId,
      project: project.name,
      projectPath: project.path,
      authorizedReadPaths,
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
      return this.startResponse(outcome);
    }
    await this.markPendingConversation(task);
    return [
      `等待二次确认：${reason}。`,
      `目标：${task.project}`,
      `动作：${task.actionSummary}`,
      "请回复“确认”或“拒绝”。",
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

  private async decidePending(senderId: string, approve: boolean, descriptor?: string): Promise<string> {
    const pending = await this.store.pendingConfirmations(senderId);
    if (pending.length === 0) return "当前没有待确认操作。";
    const conversation = await this.store.getConversation(senderId);
    const current = conversation?.currentTaskId
      ? pending.find((task) => task.id === conversation.currentTaskId)
      : undefined;
    let matches = descriptor
      ? pending.filter((task) => matchesDescription(task, descriptor))
      : [];
    if (!descriptor && current) matches = [current];
    if (!descriptor && !current && pending.length === 1) matches = pending;
    if (descriptor && matches.length === 0 && current && /刚才|这个|该操作/.test(descriptor)) {
      matches = [current];
    }
    if (matches.length !== 1) {
      return [
        matches.length > 1 ? "有多个操作符合你的描述：" : "当前有多个待确认操作：",
        ...pending.map((task) => `- ${task.project}：${task.actionSummary}`),
        "请说“确认 <项目或动作关键词>”或“拒绝 <项目或动作关键词>”。",
      ].join("\n");
    }
    return this.decideTask(senderId, matches[0], approve);
  }

  private async decideTask(senderId: string, task: TaskRecord, approve: boolean): Promise<string> {
    await this.store.updateTask(task.id, (next) => {
      next.status = approve ? "approved" : "rejected";
      next.confirmation = undefined;
    });
    if (!approve) return "已拒绝。";
    const approved = await this.store.get(task.id);
    if (!approved) return "未找到待确认操作。";
    const outcome = this.executor ? await this.executor.start(approved) : undefined;
    if (outcome === "busy") await this.markQueueFull(task.id);
    else if (outcome !== "rejected") await this.bindConversation(approved);
    if (outcome === "started") return "已确认授权，正在生成回复。";
    if (outcome === "queued") return "已确认授权，正在排队等待执行。";
    if (outcome === "busy") return "已确认授权，但当前执行队列已满。";
    return "已确认授权；当前没有可用执行端，任务未执行。";
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
    if (/当前项目/i.test(text) && /哪个|什么|哪里|当前项目[呢啊?？]*$/i.test(text)) {
      const conversation = await this.store.getConversation(senderId);
      const current = conversation?.currentTaskId
        ? await this.ownedTask(senderId, conversation.currentTaskId)
        : undefined;
      return current && current.project !== this.currentProject
        ? `散帅，Agent 当前运行项目固定为 ${this.currentProject}；最近任务目标是 ${current.project}。`
        : `散帅，Agent 当前运行项目固定为 ${this.currentProject}。`;
    }
    if (/^(?:新任务|新会话|new session)$/i.test(text)) {
      await this.store.updateConversation(senderId, (conversation) => {
        conversation.currentTaskId = undefined;
        conversation.defaultTargetProject = undefined;
        conversation.defaultTargetProjectPath = undefined;
        conversation.defaultTargetPinned = false;
        conversation.sessionReadPaths = [];
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
        conversation.agentSessionId = task.execution?.sessionId;
        conversation.sessionReadPaths = task.authorizedReadPaths ?? [task.projectPath];
      });
      return `已切换到 ${task.id}；任务目标：${task.project}。`;
    }
    const switchMatch = /^(?:切换项目|switch project)\s+(\S+)$/i.exec(text);
    if (switchMatch) {
      try {
        const project = await resolveProject(this.workspacePath, switchMatch[1]);
        await this.store.updateConversation(senderId, (conversation) => {
          conversation.currentTaskId = undefined;
          conversation.defaultTargetProject = project.name;
          conversation.defaultTargetProjectPath = project.path;
          conversation.defaultTargetPinned = true;
          conversation.agentSessionId = undefined;
          conversation.sessionReadPaths = [];
        });
        return `已设置默认目标项目：${project.name}。请继续说明任务。`;
      } catch (error) {
        return `拒绝：${(error as Error).message}。`;
      }
    }

    const conversation = await this.store.getConversation(senderId);
    const controlProject = await resolveProject(this.workspacePath, this.currentProject);
    const session = await this.sessionForNextTask(conversation, senderId);
    return this.createNaturalTask(
      senderId,
      controlProject,
      text,
      conversation?.currentTaskId,
      session.sessionId,
      session.handoffSummary,
      session.resetReadPaths ? [] : conversation?.sessionReadPaths,
    );
  }

  private async createNaturalTask(
    senderId: string,
    controlProject: ResolvedProject,
    instruction: string,
    parentTaskId?: string,
    resumeSessionId?: string,
    handoffSummary?: string,
    sessionReadPaths?: string[],
  ): Promise<string> {
    const initialActionSummary = `待 Agent 分析：${instruction}`;
    const task = await this.store.create((id, now) => ({
      id,
      senderId,
      project: controlProject.name,
      projectPath: controlProject.path,
      authorizedReadPaths: mergeReadPaths(sessionReadPaths, [controlProject.path]),
      mode: "read",
      instruction,
      actionSummary: initialActionSummary,
      parentTaskId,
      resumeSessionId,
      handoffSummary,
      status: "planning",
      createdAt: now, updatedAt: now,
    }));
    await this.markPendingConversation(task);

    if (!this.executor?.plan) {
      await this.store.updateTask(task.id, (next) => {
        next.status = "received";
        next.actionSummary = `read ${controlProject.name}: ${instruction}`;
      });
      return this.startResponse(undefined);
    }

    let proposal: TaskProposal;
    try {
      proposal = await this.executor.plan(task);
    } catch (error) {
      const current = await this.store.get(task.id);
      if (current?.status !== "cancelled") {
        await this.store.updateTask(task.id, (next) => {
          next.status = "failed";
          next.execution = {
            startedAt: next.createdAt,
            finishedAt: new Date().toISOString(),
            error: safeTaskError(error),
          };
        });
      }
      return "当前执行端无法分析这条任务，未执行。";
    }

    let validated;
    try {
      validated = await validateTaskProposal(
        proposal,
        this.workspacePath,
        this.homePath,
      );
    } catch (error) {
      await this.store.updateTask(task.id, (next) => {
        next.status = "failed";
        next.execution = {
          startedAt: next.createdAt,
          finishedAt: new Date().toISOString(),
          error: safeTaskError(error),
        };
      });
      return `Agent 返回的执行计划未通过安全校验：${safeTaskError(error)}。`;
    }

    const actionSummary = `${validated.mode} ${validated.project.name}: ${validated.instruction}`;
    const reason = proposalConfirmationReason(
      validated.project.name,
      this.currentProject,
      validated,
    );
    const code = reason ? randomBytes(3).toString("hex").toUpperCase() : undefined;
    const planned = await this.store.updateTask(task.id, (next) => {
      next.project = validated.project.name;
      next.projectPath = validated.project.path;
      next.authorizedReadPaths = validated.mode === "read"
        ? mergeReadPaths(sessionReadPaths, validated.readPaths)
        : [validated.project.path];
      next.mode = validated.mode;
      next.instruction = validated.instruction;
      next.actionSummary = actionSummary;
      next.proposal = {
        target: validated.project,
        mode: validated.mode,
        action: validated.instruction,
        sensitiveAccess: validated.sensitiveAccess,
        readPaths: validated.readPaths,
        writePaths: validated.writePaths,
      };
      next.status = reason ? "awaiting_confirmation" : "received";
      next.confirmation = reason && code ? {
        codeHash: hashCode(next.id, actionSummary, code), reason, createdAt: new Date().toISOString(),
      } : undefined;
    });
    if (!planned) return "任务状态保存失败，未执行。";
    if (reason) {
      return [
        `等待二次确认：${reason}。`,
        `系统理解：项目 ${planned.project}；模式 ${planned.mode}；动作 ${planned.instruction}`,
        "请回复“确认”或“拒绝”。",
      ].join("\n");
    }

    const outcome = await this.executor.start(planned);
    if (outcome === "busy") {
      await this.markQueueFull(task.id);
    } else if (outcome !== "rejected") {
      await this.bindConversation(planned);
    }
    return this.startResponse(outcome);
  }

  private async bindConversation(task: TaskRecord): Promise<void> {
    await this.store.updateConversation(task.senderId, (conversation) => {
      conversation.currentTaskId = task.id;
      conversation.agentSessionId = task.resumeSessionId;
      if (task.mode === "read") conversation.sessionReadPaths = task.authorizedReadPaths ?? [task.projectPath];
    });
  }

  private async markPendingConversation(task: TaskRecord): Promise<void> {
    await this.store.updateConversation(task.senderId, (conversation) => {
      conversation.currentTaskId = task.id;
    });
  }

  private async sessionForNextTask(
    conversation: Awaited<ReturnType<TaskStore["getConversation"]>>,
    senderId: string,
  ): Promise<{ sessionId?: string; handoffSummary?: string; resetReadPaths?: boolean }> {
    if (!conversation?.agentSessionId) return { resetReadPaths: true };
    const expiredByDate = conversation.agentSessionDate !== undefined
      && conversation.agentSessionDate !== shanghaiDate();
    const expiredByTurns = (conversation.agentTurnCount ?? 0) >= AGENT_SESSION_TURN_LIMIT;
    if (!expiredByDate && !expiredByTurns) return { sessionId: conversation.agentSessionId };
    const current = conversation.currentTaskId
      ? await this.ownedTask(senderId, conversation.currentTaskId)
      : undefined;
    return {
      handoffSummary: buildHandoffSummary(conversation, current, expiredByDate ? "跨自然日" : "达到 30 轮"),
      resetReadPaths: true,
    };
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

  private startResponse(outcome?: "started" | "queued" | "busy" | "rejected"): string {
    if (outcome === "started") return "收到，正在生成回复中...";
    if (outcome === "queued") return "已接收并排队等待执行。";
    if (outcome === "busy") return "当前已有运行任务和一个排队任务，暂未执行。";
    return "当前没有可用执行端，任务未执行。";
  }

  private async ownedTask(senderId: string, id: string): Promise<TaskRecord | undefined> {
    const task = await this.store.get(id);
    return task?.senderId === senderId ? task : undefined;
  }
}

function mergeReadPaths(existing: string[] | undefined, added: string[]): string[] {
  return [...new Set([...(existing ?? []), ...added])].slice(-10);
}

function matchesDescription(task: TaskRecord, descriptor: string): boolean {
  const query = descriptor.replace(/刚才|这个|该操作/g, "").trim().toLowerCase();
  if (!query) return false;
  const haystack = `${task.project} ${task.actionSummary} ${task.instruction}`.toLowerCase();
  return haystack.includes(query)
    || query.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
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
    "Agent 控制项目固定为 wechat-agent-bot；只读任务从控制项目运行，已确认写任务临时从目标项目运行。",
    conversation.defaultTargetPinned && conversation.defaultTargetProject
      ? `显式默认目标项目：${conversation.defaultTargetProject}。`
      : "",
    task ? `上一任务：${task.id}（${task.status}）${task.actionSummary}。` : "",
    task?.execution?.result ? `上一结果：${task.execution.result}` : "",
    "跨项目写入及红线操作仍须本轮独立确认，不得继承旧授权。",
  ].filter(Boolean);
  return lines.join("\n").slice(0, 1_000);
}

function hashCode(taskId: string, actionSummary: string, code: string): string {
  return createHash("sha256").update(`${taskId}\0${actionSummary}\0${code}`).digest("hex");
}

function safeTaskError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Agent 计划失败";
}
