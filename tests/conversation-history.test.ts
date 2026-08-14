import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ConversationHistoryStore } from "../src/runtime/conversation-history.js";

test("conversation history persists only minimal messages with private permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-conversations-"));
  const path = join(root, "runtime-data", "conversations", "state.json");
  const store = new ConversationHistoryStore(path);
  await store.appendTurn("context-1", "owner", "记住暗号海棠", "已记住");

  const restored = new ConversationHistoryStore(path);
  assert.deepEqual((await restored.load()).contexts["context-1"].messages.map(({ role, text }) => ({ role, text })), [
    { role: "user", text: "记住暗号海棠" },
    { role: "bot", text: "已记住" },
  ]);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("conversation history expires old contexts and caps contexts and messages", async () => {
  const root = await mkdtemp(join(tmpdir(), "wechat-agent-conversation-retention-"));
  let now = new Date("2026-08-14T00:00:00.000Z");
  const store = new ConversationHistoryStore(join(root, "state.json"), {
    ttlMs: 100,
    maxContexts: 2,
    maxMessagesPerContext: 2,
    now: () => now,
  });
  await store.append("context-1", "owner", "user", "one");
  await store.append("context-1", "owner", "bot", "two");
  await store.append("context-1", "owner", "user", "three");
  assert.deepEqual((await store.load()).contexts["context-1"].messages.map((message) => message.text), ["two", "three"]);

  now = new Date(now.getTime() + 10);
  await store.append("context-2", "owner", "user", "newer");
  now = new Date(now.getTime() + 10);
  await store.append("context-3", "owner", "user", "newest");
  assert.deepEqual(Object.keys((await store.load()).contexts).sort(), ["context-2", "context-3"]);

  now = new Date(now.getTime() + 200);
  await store.prune();
  assert.deepEqual((await store.load()).contexts, {});
});
