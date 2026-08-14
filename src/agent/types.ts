import type { TaskMode, TaskProposal } from "../tasks/types.js";

export const AGENT_PROTOCOL_VERSION = 2;
export type AgentRunPhase = "analyze" | "execute";

export interface AgentRunRequest {
  version: typeof AGENT_PROTOCOL_VERSION;
  phase: AgentRunPhase;
  taskId: string;
  cwd: string;
  controlProject: {
    name: string;
    path: string;
  };
  targetProject?: {
    name: string;
    path: string;
  };
  mode: TaskMode;
  instruction: string;
  /** Original user wording. The Agent owns its interpretation. */
  userInput: string;
  proposal?: TaskProposal;
  context?: {
    defaultTargetProject?: {
      name: string;
      path: string;
    };
    currentTaskId?: string;
  };
  sessionId?: string;
  handoffSummary?: string;
  persistSession: boolean;
  requiredContextFiles: string[];
  access: {
    readPaths: string[];
    writePaths: string[];
  };
}

export interface AgentRunResult {
  version: typeof AGENT_PROTOCOL_VERSION;
  status: "succeeded" | "failed";
  sessionId?: string;
  summary?: string;
  proposal?: TaskProposal;
  error?: string;
}

export interface AgentRunner {
  run(request: AgentRunRequest, signal: AbortSignal): Promise<AgentRunResult>;
}
