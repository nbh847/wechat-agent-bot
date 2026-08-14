import { spawn } from "node:child_process";

import {
  AGENT_PROTOCOL_VERSION,
  type AgentRunner,
  type AgentRunRequest,
  type AgentRunResult,
} from "./types.js";

export class ProcessAgentRunner implements AgentRunner {
  constructor(
    private readonly executable: string,
    private readonly args: string[] = [],
    private readonly maxOutputBytes = 1_000_000,
  ) {}

  run(request: AgentRunRequest, signal: AbortSignal): Promise<AgentRunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.executable, this.args, {
        cwd: request.cwd,
        env: allowedEnvironment(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      let forceKillTimer: NodeJS.Timeout | undefined;

      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        signal.removeEventListener("abort", abort);
        callback();
      };
      const abort = () => {
        child.kill("SIGTERM");
        forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 2_000);
        forceKillTimer.unref();
      };
      signal.addEventListener("abort", abort, { once: true });

      child.once("error", (error) => finish(() => reject(error)));
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        if (Buffer.byteLength(stdout) > this.maxOutputBytes) child.kill("SIGTERM");
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        if (Buffer.byteLength(stderr) > this.maxOutputBytes) child.kill("SIGTERM");
      });
      child.once("close", (code, closeSignal) => {
        finish(() => {
          if (signal.aborted) return reject(signal.reason ?? new Error("Agent 执行已取消"));
          if (Buffer.byteLength(stdout) > this.maxOutputBytes || Buffer.byteLength(stderr) > this.maxOutputBytes) {
            return reject(new Error("Agent 执行端输出超过限制"));
          }
          if (code !== 0) {
            return reject(new Error(`Agent 执行端异常退出（${code ?? closeSignal ?? "unknown"}）`));
          }
          let parsed: unknown;
          try {
            parsed = JSON.parse(stdout) as unknown;
          } catch {
            return reject(new Error("Agent 执行端未返回有效 JSON"));
          }
          if (!isAgentRunResult(parsed)) {
            return reject(new Error("Agent 执行端返回不符合协议"));
          }
          resolve(parsed);
        });
      });
      child.stdin.end(`${JSON.stringify(request)}\n`);
    });
  }
}

function isAgentRunResult(value: unknown): value is AgentRunResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AgentRunResult>;
  if (
    result.version !== AGENT_PROTOCOL_VERSION ||
    !["succeeded", "failed"].includes(result.status ?? "")
  ) return false;
  if (result.sessionId !== undefined && typeof result.sessionId !== "string") return false;
  if (result.summary !== undefined && typeof result.summary !== "string") return false;
  if (result.error !== undefined && typeof result.error !== "string") return false;
  if (result.proposal !== undefined && !isTaskProposal(result.proposal)) return false;
  return result.status === "succeeded"
    ? typeof result.summary === "string" || result.proposal !== undefined
    : typeof result.error === "string";
}

function isTaskProposal(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  const target = proposal.target;
  return Boolean(
    target && typeof target === "object"
      && typeof (target as Record<string, unknown>).name === "string"
      && typeof (target as Record<string, unknown>).path === "string"
      && (proposal.mode === "read" || proposal.mode === "write")
      && typeof proposal.action === "string"
      && Array.isArray(proposal.readPaths)
      && Array.isArray(proposal.writePaths)
      && proposal.readPaths.every((path) => typeof path === "string")
      && proposal.writePaths.every((path) => typeof path === "string"),
  );
}

function allowedEnvironment(): NodeJS.ProcessEnv {
  const allowed = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"];
  return Object.fromEntries(
    allowed.flatMap((name) => process.env[name] ? [[name, process.env[name]]] : []),
  );
}
