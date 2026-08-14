export type TaskMode = "read" | "write";
export type TaskStatus =
  | "received"
  | "awaiting_confirmation"
  | "approved"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "rejected"
  | "interrupted";

export interface ConversationRecord {
  senderId: string;
  currentTaskId?: string;
  defaultTargetProject?: string;
  defaultTargetProjectPath?: string;
  defaultTargetPinned?: boolean;
  sessionReadPaths?: string[];
  adapterId?: string;
  agentSessionId?: string;
  agentSessionDate?: string;
  agentTurnCount?: number;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  senderId: string;
  project: string;
  projectPath: string;
  authorizedReadPaths?: string[];
  mode: TaskMode;
  instruction: string;
  actionSummary: string;
  parentTaskId?: string;
  resumeSessionId?: string;
  handoffSummary?: string;
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
  conversations: Record<string, ConversationRecord>;
}
