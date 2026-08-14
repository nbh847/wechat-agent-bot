import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
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

test("StateStore expires stale context tokens and pending replies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-state-retention-"));
  let now = new Date("2026-08-14T00:00:00.000Z");
  const store = new StateStore(join(directory, "state.json"), 1_000, {
    contextTokenTtlMs: 100,
    maxContextTokens: 2,
    pendingReplyTtlMs: 100,
    maxPendingReplies: 2,
    now: () => now,
  });
  await store.update((state) => {
    state.contextTokens.owner = "context-token";
    state.contextTokenUpdatedAt.owner = now.toISOString();
    state.pendingReplies.reply = {
      messageId: "reply",
      userId: "owner",
      text: "result",
      createdAt: now.toISOString(),
    };
  });
  now = new Date(now.getTime() + 200);
  await store.update(() => undefined);
  const state = await store.load();
  assert.deepEqual(state.contextTokens, {});
  assert.deepEqual(state.contextTokenUpdatedAt, {});
  assert.deepEqual(state.pendingReplies, {});
});

test("StateStore gives legacy retained data a migration timestamp", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-state-migration-"));
  const path = join(directory, "state.json");
  await writeFile(path, JSON.stringify({
    cursor: "",
    contextTokens: { owner: "legacy-context" },
    processedMessageIds: [],
    pendingReplies: { legacy: { messageId: "legacy", userId: "owner", text: "reply" } },
  }));
  const state = await new StateStore(path).load();
  assert.ok(state.contextTokenUpdatedAt.owner);
  assert.ok(state.pendingReplies.legacy.createdAt);
});
