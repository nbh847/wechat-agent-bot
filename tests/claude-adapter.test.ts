import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const adapter = resolve("scripts/claude-adapter.mjs");
const control = resolve(".");

test("Claude adapter fails closed on inconsistent permissions", async () => {
  const invalidRead = await run({
    ...baseRequest(),
    access: { readPaths: [control], writePaths: [control] },
  });
  assert.equal(invalidRead.status, "failed");
  assert.match(invalidRead.error, /只读任务权限不符合/);

  const invalidWrite = await run({
    ...baseRequest(),
    mode: "write",
    sessionId: "old-session",
    persistSession: false,
    access: { readPaths: [control], writePaths: [control] },
  });
  assert.equal(invalidWrite.status, "failed");
  assert.match(invalidWrite.error, /写入任务权限不符合/);
});

test("Claude adapter selects session flags and isolates write sessions", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "claude-adapter-test-"));
  const target = join(fixture, "target");
  const readOnly = await mkdtemp(join("/private/tmp", "claude-adapter-read-only-"));
  const fakeClaude = join(fixture, "claude");
  const argsLog = join(fixture, "args.json");
  await mkdir(target);
  await writeFile(fakeClaude, `#!/usr/bin/env node
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(argsLog)}, JSON.stringify(args) + "\\n");
let cwdWrite = null;
if (process.cwd() !== ${JSON.stringify(control)}) {
  try { writeFileSync(join(process.cwd(), "write-probe"), "ok"); cwdWrite = true; } catch { cwdWrite = false; }
}
let readOnlyWrite = false;
try { writeFileSync(${JSON.stringify(join(readOnly, "write-probe"))}, "blocked"); readOnlyWrite = true; } catch {}
let runtimeTempWrite = false;
try { writeFileSync(join(process.env.TMPDIR, "bash-sandbox-probe"), "ok"); runtimeTempWrite = true; } catch {}
const claudeTempMatches = process.env.CLAUDE_TMPDIR === process.env.TMPDIR;
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write(JSON.stringify({
  type: "result", subtype: "success", is_error: false,
  session_id: "claude-session", result: JSON.stringify({ cwdWrite, readOnlyWrite, runtimeTempWrite, claudeTempMatches })
})));
`);
  await chmod(fakeClaude, 0o755);
  const env = { ...process.env, PATH: `${fixture}:${process.env.PATH}` };

  const fresh = await run(baseRequest(), env);
  assert.equal(fresh.status, "succeeded", fresh.error);
  assert.equal(fresh.sessionId, "claude-session");
  assert.deepEqual(JSON.parse(fresh.summary ?? ""), { cwdWrite: null, readOnlyWrite: false, runtimeTempWrite: true, claudeTempMatches: true });

  const resumed = await run({ ...baseRequest(), sessionId: "claude-session" }, env);
  assert.equal(resumed.status, "succeeded", resumed.error);
  assert.equal(resumed.sessionId, "claude-session");

  const write = await run({
    ...baseRequest(),
    cwd: target,
    targetProject: { name: "target", path: target },
    mode: "write",
    persistSession: false,
    access: { readPaths: [control, target, readOnly], writePaths: [target] },
  }, env);
  assert.equal(write.status, "succeeded", write.error);
  assert.equal(write.sessionId, undefined);
  assert.deepEqual(JSON.parse(write.summary ?? ""), { cwdWrite: true, readOnlyWrite: false, runtimeTempWrite: true, claudeTempMatches: true });

  const calls = (await readFile(argsLog, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(calls[0].includes("--safe-mode"));
  assert.ok(calls[0].includes("--dangerously-skip-permissions"));
  assert.ok(!calls[0].includes("--no-session-persistence"));
  assert.deepEqual(calls[1].slice(-2), ["--resume", "claude-session"]);
  assert.ok(calls[2].includes("--no-session-persistence"));
  assert.ok(!calls[2].includes("--resume"));
});

test("Claude adapter returns a structured plan during analysis", async () => {
  const fixture = await mkdtemp(join(tmpdir(), "claude-adapter-plan-"));
  const fakeClaude = join(fixture, "claude");
  const proposal = {
    target: { name: "wechat-agent-bot", path: control },
    mode: "read",
    action: "检查项目并总结",
    sensitiveAccess: false,
    sensitivePaths: [],
    sensitiveReason: "",
    readPaths: [control],
    writePaths: [],
  };
  await writeFile(fakeClaude, `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on("end", () => process.stdout.write(JSON.stringify({
  type: "result", subtype: "success", is_error: false,
  session_id: "analysis-session", result: ${JSON.stringify(JSON.stringify(proposal))},
  structured_output: ${JSON.stringify(proposal)}
})));
`);
  await chmod(fakeClaude, 0o755);
  const result = await run({
    ...baseRequest(),
    phase: "analyze",
    targetProject: undefined,
    persistSession: false,
  }, { ...process.env, PATH: `${fixture}:${process.env.PATH}` });
  assert.equal(result.status, "succeeded", result.error);
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
): Promise<{ status: string; error: string; sessionId?: string; proposal?: unknown; summary?: string }> {
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
