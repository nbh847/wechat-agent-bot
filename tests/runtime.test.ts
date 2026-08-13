import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RotatingFileLogger } from "../src/runtime/file-logger.js";
import { HealthReporter } from "../src/runtime/health.js";
import { acquireInstanceLock } from "../src/runtime/single-instance.js";

test("instance lock rejects a live owner and releases its own lock", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-lock-"));
  const path = join(directory, "instance.lock");
  const lock = await acquireInstanceLock(path);
  await assert.rejects(acquireInstanceLock(path), /服务已经运行/);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await lock.release();
  await assert.rejects(stat(path), /ENOENT/);
});

test("instance lock recovers a stale or invalid lock", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-stale-lock-"));
  const path = join(directory, "instance.lock");
  await writeFile(path, "invalid\n");
  const lock = await acquireInstanceLock(path);
  assert.equal(JSON.parse(await readFile(path, "utf8")).pid, process.pid);
  await lock.release();
});

test("health reporter writes a private minimal status file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-health-"));
  const path = join(directory, "health.json");
  await new HealthReporter(path).write("listening", { restored: true });
  const health = JSON.parse(await readFile(path, "utf8"));
  assert.deepEqual(Object.keys(health).sort(), ["pid", "restored", "status", "updatedAt"]);
  assert.equal(health.status, "listening");
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("file logger redacts sensitive fields and rotates with bounded retention", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-log-"));
  const path = join(directory, "service.log");
  const logger = new RotatingFileLogger(path, 80, 2);
  logger.info("token=super-secret should not appear");
  logger.warn("context_token: another-secret should not appear");
  logger.error("x".repeat(100));
  await logger.flush();
  const contents = await Promise.all(
    [path, `${path}.1`, `${path}.2`].map((file) => readFile(file, "utf8").catch(() => "")),
  );
  const combined = contents.join("\n");
  assert.doesNotMatch(combined, /super-secret|another-secret/);
  assert.match(combined, /\[REDACTED\]/);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await assert.rejects(stat(`${path}.3`), /ENOENT/);
});
