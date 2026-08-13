export type TaskMode = "read" | "write";
export type TaskStatus =
  | "received"
  | "awaiting_confirmation"
  | "approved"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "rejected";

export interface TaskRecord {
  id: string;
  senderId: string;
  project: string;
  projectPath: string;
  mode: TaskMode;
  instruction: string;
  actionSummary: string;
  status: TaskStatus;
  confirmation?: {
    codeHash: string;
    reason: string;
    createdAt: string;
  };
  execution?: {
    sessionId?: string;
    startedAt: string;
    finishedAt?: string;
    result?: string;
    error?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TaskState {
  nextId: number;
  tasks: Record<string, TaskRecord>;
}
