export type TaskMode = "read" | "write";
export type TaskStatus =
  | "received"
  | "awaiting_confirmation"
  | "approved"
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
  createdAt: string;
  updatedAt: string;
}

export interface TaskState {
  nextId: number;
  tasks: Record<string, TaskRecord>;
}
