import assert from "node:assert/strict";
import test from "node:test";

import { ProcessAgentRunner } from "../src/agent/process-runner.js";
import type { AgentRunRequest } from "../src/agent/types.js";

const request: AgentRunRequest = {
  version: 2,
  phase: "execute",
  taskId: "T0001",
  cwd: process.cwd(),
  controlProject: { name: "wechat-agent-bot", path: process.cwd() },
  targetProject: { name: "wechat-agent-bot", path: process.cwd() },
  mode: "read",
  instruction: "inspect",
  userInput: "inspect",
  persistSession: true,
  requiredContextFiles: ["README.md"],
  access: { readPaths: [process.cwd()], writePaths: [] },
};

test("process runner exchanges one JSON request and result", async () => {
  const script = [
    "let input = '';",
    "process.stdin.on('data', chunk => input += chunk);",
    "process.stdin.on('end', () => {",
    " const request = JSON.parse(input);",
    " process.stdout.write(JSON.stringify({version: 2, status: 'succeeded', sessionId: request.taskId, summary: request.mode}));",
    "});",
  ].join("\n");
  const result = await new ProcessAgentRunner(process.execPath, ["-e", script]).run(
    request,
    new AbortController().signal,
  );
  assert.equal(result.status, "succeeded");
  assert.equal(result.sessionId, "T0001");
  assert.equal(result.summary, "read");
});

test("process runner rejects invalid protocol output and launch failure", async () => {
  await assert.rejects(
    new ProcessAgentRunner(process.execPath, ["-e", "process.stdout.write('not-json')"]).run(
      request,
      new AbortController().signal,
    ),
    /有效 JSON/,
  );
  await assert.rejects(
    new ProcessAgentRunner("/definitely/missing/agent").run(request, new AbortController().signal),
  );
  await assert.rejects(
    new ProcessAgentRunner(process.execPath, ["-e", "process.stdout.write('null')"]).run(
      request,
      new AbortController().signal,
    ),
    /不符合协议/,
  );
  await assert.rejects(
    new ProcessAgentRunner(process.execPath, [
      "-e",
      "process.stdout.write(JSON.stringify({version:1,status:'succeeded',summary:42}))",
    ]).run(request, new AbortController().signal),
    /不符合协议/,
  );
});
