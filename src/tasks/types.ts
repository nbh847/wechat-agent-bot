export type TaskMode = "read" | "write";
export type TaskStatus =
  | "received"
  | "planning"
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

/**
 * A plan is the only business-shaped data the Agent is allowed to hand back
 * to the Bot.  The Bot does not infer these fields from the user's prose; it
 * only validates their safety before an execution request is created.
 */
export interface TaskProposal {
  target: {
    name: string;
    path: string;
  };
  mode: TaskMode;
  action: string;
  sensitiveAccess: boolean;
  readPaths: string[];
  writePaths: string[];
}

export interface ConversationRecord {
  senderId: string;
  historyContextId?: string;
  historyContextStartedAt?: string;
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
  conversationContextId?: string;
  proposal?: TaskProposal;
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
