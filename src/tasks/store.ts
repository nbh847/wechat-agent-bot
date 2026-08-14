import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ConversationRecord, TaskRecord, TaskState } from "./types.js";

const EMPTY_STATE: TaskState = { nextId: 1, tasks: {}, conversations: {} };

const TERMINAL_STATUSES = new Set<TaskRecord["status"]>([
  "succeeded", "failed", "timed_out", "cancelled", "rejected", "interrupted",
]);

export interface TaskRetention {
  terminalTtlMs?: number;
  maxTerminalTasks?: number;
  conversationTtlMs?: number;
  maxConversations?: number;
  now?: () => Date;
}

export class TaskStore {
  private state?: TaskState;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly retention: TaskRetention = {},
  ) {}

  async load(): Promise<TaskState> {
    if (this.state) return structuredClone(this.state);
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as Partial<TaskState>;
      const conversations = parsed.conversations ?? {};
      for (const conversation of Object.values(conversations) as Array<ConversationRecord & {
        currentProject?: string;
        currentProjectPath?: string;
      }>) {
        conversation.defaultTargetProject ??= conversation.currentProject;
        conversation.defaultTargetProjectPath ??= conversation.currentProjectPath;
        conversation.defaultTargetPinned ??= false;
        conversation.sessionReadPaths ??= [];
        delete conversation.currentProject;
        delete conversation.currentProjectPath;
      }
      this.state = {
        nextId: parsed.nextId ?? 1,
        tasks: parsed.tasks ?? {},
        conversations,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.state = structuredClone(EMPTY_STATE);
    }
    return structuredClone(this.state);
  }

  async create(
    build: (id: string, now: string) => TaskRecord,
  ): Promise<TaskRecord> {
    let created: TaskRecord | undefined;
    await this.update((state) => {
      const id = `T${String(state.nextId).padStart(4, "0")}`;
      state.nextId++;
      created = build(id, this.nowIso());
      state.tasks[id] = created;
    });
    return structuredClone(created!);
  }

  async get(id: string): Promise<TaskRecord | undefined> {
    return (await this.load()).tasks[id];
  }

  async pendingConfirmations(senderId: string): Promise<TaskRecord[]> {
    return Object.values((await this.load()).tasks)
      .filter((task) => task.senderId === senderId && task.status === "awaiting_confirmation")
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateTask(
    id: string,
    mutate: (task: TaskRecord) => void,
  ): Promise<TaskRecord | undefined> {
    let updated: TaskRecord | undefined;
    await this.update((state) => {
      const task = state.tasks[id];
      if (!task) return;
      mutate(task);
      task.updatedAt = this.nowIso();
      updated = task;
    });
    return updated ? structuredClone(updated) : undefined;
  }

  async getConversation(senderId: string): Promise<ConversationRecord | undefined> {
    return (await this.load()).conversations[senderId];
  }

  async updateConversation(
    senderId: string,
    mutate: (conversation: ConversationRecord) => void,
  ): Promise<ConversationRecord> {
    let updated: ConversationRecord | undefined;
    await this.update((state) => {
      const conversation = state.conversations[senderId] ?? {
        senderId,
        updatedAt: this.nowIso(),
      };
      mutate(conversation);
      conversation.updatedAt = this.nowIso();
      state.conversations[senderId] = conversation;
      updated = conversation;
    });
    return structuredClone(updated!);
  }

  async recoverInterrupted(): Promise<string[]> {
    const recovered: string[] = [];
    await this.update((state) => {
      for (const task of Object.values(state.tasks)) {
        if (task.status !== "planning" && task.status !== "running" && task.status !== "queued") continue;
        task.status = "interrupted";
        task.updatedAt = new Date().toISOString();
        task.execution = {
          ...(task.execution ?? { startedAt: task.updatedAt }),
          finishedAt: task.updatedAt,
          error: "服务重启导致任务中断，未自动重试",
        };
        recovered.push(task.id);
      }
    });
    return recovered;
  }

  private async update(mutator: (state: TaskState) => void): Promise<void> {
    const write = this.writes.then(async () => {
      const next = await this.load();
      mutator(next);
      pruneTaskState(next, this.retention);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.path}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
      await rename(temporaryPath, this.path);
      this.state = next;
    });
    this.writes = write.catch(() => undefined);
    await write;
  }

  private nowIso(): string {
    return (this.retention.now ?? (() => new Date()))().toISOString();
  }
}

function pruneTaskState(state: TaskState, retention: TaskRetention): void {
  const now = (retention.now ?? (() => new Date()))().getTime();
  const terminalTtlMs = retention.terminalTtlMs ?? 90 * 24 * 60 * 60_000;
  const maxTerminalTasks = retention.maxTerminalTasks ?? 1_000;
  const terminal = Object.values(state.tasks)
    .filter((task) => TERMINAL_STATUSES.has(task.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const [index, task] of terminal.entries()) {
    const timestamp = Date.parse(task.updatedAt);
    if (index >= maxTerminalTasks || !Number.isFinite(timestamp) || now - timestamp > terminalTtlMs) {
      delete state.tasks[task.id];
    }
  }

  const conversationTtlMs = retention.conversationTtlMs ?? 30 * 24 * 60 * 60_000;
  const maxConversations = retention.maxConversations ?? 30;
  const conversations = Object.values(state.conversations)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const [index, conversation] of conversations.entries()) {
    const timestamp = Date.parse(conversation.updatedAt);
    const hasActiveTask = Object.values(state.tasks).some(
      (task) => task.senderId === conversation.senderId && !TERMINAL_STATUSES.has(task.status),
    );
    if (!hasActiveTask && (
      index >= maxConversations
      || !Number.isFinite(timestamp)
      || now - timestamp > conversationTtlMs
    )) {
      delete state.conversations[conversation.senderId];
    }
  }
}
