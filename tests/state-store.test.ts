import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { StateStore } from "../src/ilink/state-store.js";

test("StateStore persists state privately and reloads it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-state-"));
  const path = join(directory, "state.json");
  const store = new StateStore(path);
  await store.update((state) => {
    state.cursor = "cursor-1";
    state.contextTokens.user = "context-secret";
    state.processedMessageIds.push("message-1");
  });

  const reloaded = await new StateStore(path).load();
  assert.equal(reloaded.cursor, "cursor-1");
  assert.equal(reloaded.contextTokens.user, "context-secret");
  assert.deepEqual(reloaded.processedMessageIds, ["message-1"]);
  assert.deepEqual(reloaded.pendingReplies, {});
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.doesNotMatch(await readFile(path, "utf8"), /undefined/);
});

test("StateStore caps processed message IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-state-"));
  const store = new StateStore(join(directory, "state.json"), 2);
  await store.update((state) => state.processedMessageIds.push("1", "2", "3"));
  assert.deepEqual((await store.load()).processedMessageIds, ["2", "3"]);
});
