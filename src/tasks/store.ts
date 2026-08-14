import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ConversationRecord, TaskRecord, TaskState } from "./types.js";

const EMPTY_STATE: TaskState = { nextId: 1, tasks: {}, conversations: {} };

export class TaskStore {
  private state?: TaskState;
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

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
      created = build(id, new Date().toISOString());
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
      task.updatedAt = new Date().toISOString();
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
        updatedAt: new Date().toISOString(),
      };
      mutate(conversation);
      conversation.updatedAt = new Date().toISOString();
      state.conversations[senderId] = conversation;
      updated = conversation;
    });
    return structuredClone(updated!);
  }

  async recoverInterrupted(): Promise<string[]> {
    const recovered: string[] = [];
    await this.update((state) => {
      for (const task of Object.values(state.tasks)) {
        if (task.status !== "running" && task.status !== "queued") continue;
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
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.path}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
      await rename(temporaryPath, this.path);
      this.state = next;
    });
    this.writes = write.catch(() => undefined);
    await write;
  }
}
