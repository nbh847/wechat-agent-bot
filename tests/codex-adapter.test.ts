import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const adapter = resolve("scripts/codex-adapter.mjs");
const control = resolve(".");

test("Codex adapter fails closed on inconsistent read and write permissions", async () => {
  const invalidRead = await run({
    ...baseRequest(),
    mode: "read",
    cwd: control,
    persistSession: true,
    access: { readPaths: [control], writePaths: [control] },
  });
  assert.equal(invalidRead.status, "failed");
  assert.match(invalidRead.error, /只读任务权限不符合/);

  const invalidWrite = await run({
    ...baseRequest(),
    mode: "write",
    cwd: control,
    sessionId: "old-session",
    persistSession: false,
    access: { readPaths: [control], writePaths: [control] },
  });
  assert.equal(invalidWrite.status, "failed");
  assert.match(invalidWrite.error, /写入任务权限不符合/);
});

test("Codex adapter selects explicit sandbox and isolates write sessions", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "codex-adapter-test-"));
  const fakeCodex = join(fixture, "codex");
  const argsLog = join(fixture, "args.json");
  await writeFile(fakeCodex, `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(argsLog)}, JSON.stringify(args) + "\\n");
const output = args[args.indexOf("--output-last-message") + 1];
writeFileSync(output, "ok");
process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "read-session" }) + "\\n");
`);
  await chmod(fakeCodex, 0o755);
  const env = { ...process.env, PATH: `${fixture}:${process.env.PATH}`, CODEX_ARGS_LOG: argsLog };

  const fresh = await run(baseRequest(), env);
  assert.equal(fresh.status, "succeeded");
  assert.equal(fresh.sessionId, "read-session");

  const resumed = await run({ ...baseRequest(), sessionId: "read-session" }, env);
  assert.equal(resumed.status, "succeeded");
  assert.equal(resumed.sessionId, "read-session");

  const write = await run({
    ...baseRequest(),
    mode: "write",
    cwd: control,
    persistSession: false,
    access: { readPaths: [control], writePaths: [control] },
  }, env);
  assert.equal(write.status, "succeeded");
  assert.equal(write.sessionId, undefined);

  const calls = (await readFile(argsLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(calls[0].slice(-5), ["--sandbox", "read-only", "--cd", control, "-"]);
  assert.deepEqual(calls[1].slice(-5), ["resume", "--config", 'sandbox_mode="read-only"', "read-session", "-"]);
  assert.deepEqual(calls[2].slice(-5), ["--sandbox", "workspace-write", "--cd", control, "-"]);
});

test("Codex adapter returns a structured plan during the analysis phase", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "codex-adapter-plan-"));
  const fakeCodex = join(fixture, "codex");
  const proposal = {
    target: { name: "other-project", path: control },
    mode: "read",
    action: "检查项目并总结",
    sensitiveAccess: false,
    sensitivePaths: [],
    sensitiveReason: "",
    readPaths: [control],
    writePaths: [],
  };
  await writeFile(fakeCodex, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const output = args[args.indexOf("--output-last-message") + 1];
writeFileSync(output, ${JSON.stringify(JSON.stringify(proposal))});
`);
  await chmod(fakeCodex, 0o755);
  const env = { ...process.env, PATH: `${fixture}:${process.env.PATH}` };
  const result = await run({
    ...baseRequest(),
    phase: "analyze",
    targetProject: undefined,
    persistSession: false,
    access: { readPaths: [control], writePaths: [] },
  }, env);
  assert.equal(result.status, "succeeded");
  assert.deepEqual(result.proposal, proposal);
});

function baseRequest() {
  return {
    version: 2,
    phase: "execute",
    taskId: "T0001",
    cwd: control,
    controlProject: { name: "wechat-agent-bot", path: control },
    targetProject: { name: "wechat-agent-bot", path: control },
    mode: "read",
    instruction: "inspect",
    userInput: "inspect",
    persistSession: true,
    requiredContextFiles: [],
    access: { readPaths: [control], writePaths: [] },
  };
}

async function run(
  request: unknown,
  env = process.env,
): Promise<{ status: string; error: string; sessionId?: string; proposal?: unknown }> {
  const child = spawn(process.execPath, [adapter], { cwd: control, env, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stdin.end(JSON.stringify(request));
  await new Promise<void>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", () => resolveExit());
  });
  return JSON.parse(stdout);
}
