import type { TaskMode } from "../tasks/types.js";

export const AGENT_PROTOCOL_VERSION = 1;

export interface AgentRunRequest {
  version: typeof AGENT_PROTOCOL_VERSION;
  taskId: string;
  cwd: string;
  controlProject: {
    name: string;
    path: string;
  };
  targetProject: {
    name: string;
    path: string;
  };
  mode: TaskMode;
  instruction: string;
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
  error?: string;
}

export interface AgentRunner {
  run(request: AgentRunRequest, signal: AbortSignal): Promise<AgentRunResult>;
}
