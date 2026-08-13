import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { TaskRecord, TaskState } from "./types.js";

const EMPTY_STATE: TaskState = { nextId: 1, tasks: {} };

export class TaskStore {
  private state?: TaskState;

  constructor(private readonly path: string) {}

  async load(): Promise<TaskState> {
    if (this.state) return structuredClone(this.state);
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as Partial<TaskState>;
      this.state = {
        nextId: parsed.nextId ?? 1,
        tasks: parsed.tasks ?? {},
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

  private async update(mutator: (state: TaskState) => void): Promise<void> {
    const next = await this.load();
    mutator(next);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.path);
    this.state = next;
  }
}
