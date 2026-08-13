import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ILinkApi } from "../src/ilink/api.js";
import { ILinkTextChannel } from "../src/ilink/channel.js";
import { ILinkApiError } from "../src/ilink/errors.js";
import { silentLogger } from "../src/ilink/logger.js";
import type { LoginManager } from "../src/ilink/login.js";
import { StateStore } from "../src/ilink/state-store.js";
import { credentials, FakeApi } from "./helpers.js";

async function createChannel(api: FakeApi) {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-channel-"));
  const store = new StateStore(join(directory, "state.json"));
  await store.update((state) => {
    state.credentials = credentials;
  });
  const login = {
    getCredentials: async () => ({ credentials, restored: true }),
  } as unknown as LoginManager;
  const channel = new ILinkTextChannel(
    api as unknown as ILinkApi,
    login,
    store,
    silentLogger,
    { initialMs: 1, maxMs: 2 },
  );
  return { channel, store };
}

test("channel records message before callback and ignores duplicate delivery", async () => {
  const api = new FakeApi();
  const message = {
    message_id: 42,
    from_user_id: "user-1",
    message_type: 1,
    context_token: "context-1",
    item_list: [{ type: 1, text_item: { text: "ping" } }],
  };
  api.updates.push(
    { msgs: [message], get_updates_buf: "cursor-1" },
    { msgs: [message], get_updates_buf: "cursor-2" },
  );
  const { channel, store } = await createChannel(api);
  api.onUpdateRequest = (count) => {
    if (count === 3) setImmediate(() => channel.stop());
  };
  let calls = 0;

  await channel.start({
    onQrCode: () => undefined,
    onText: async () => {
      calls++;
      return "Echo: ping";
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(api.sent, [
    { userId: "user-1", contextToken: "context-1", text: "Echo: ping" },
  ]);
  const state = await store.load();
  assert.deepEqual(state.processedMessageIds, ["42"]);
  assert.equal(state.contextTokens["user-1"], "context-1");
  assert.equal(state.cursor, "cursor-2");
  assert.deepEqual(state.pendingReplies, {});
});

test("channel retries a persisted reply without invoking callback again", async () => {
  const api = new FakeApi();
  const message = {
    message_id: 43,
    from_user_id: "user-1",
    message_type: 1,
    context_token: "context-1",
    item_list: [{ type: 1, text_item: { text: "ping" } }],
  };
  api.sendErrors.push(new Error("temporary send failure"));
  api.updates.push(
    { msgs: [message], get_updates_buf: "cursor-1" },
    { msgs: [message], get_updates_buf: "cursor-2" },
  );
  const { channel, store } = await createChannel(api);
  api.onUpdateRequest = (count) => {
    if (count === 3) setImmediate(() => channel.stop());
  };
  let calls = 0;
  await channel.start({
    onQrCode: () => undefined,
    onText: async () => {
      calls++;
      return "Echo: ping";
    },
  });

  assert.equal(calls, 1);
  assert.equal(api.sent.length, 1);
  assert.deepEqual((await store.load()).pendingReplies, {});
});

test("queued execution result is persisted before sending and retried by polling", async () => {
  const api = new FakeApi();
  const { channel, store } = await createChannel(api);
  await store.update((state) => {
    state.contextTokens["user-1"] = "context-1";
  });
  api.sendErrors.push(new Error("temporary send failure"));
  await assert.rejects(channel.queueReply("execution:T0001", "user-1", "done"));
  assert.equal((await store.load()).pendingReplies["execution:T0001"]?.text, "done");

  api.updates.push(new ILinkApiError("expired", -14));
  await channel.start({ onQrCode: () => undefined, onText: async () => undefined });
  assert.deepEqual(api.sent, [
    { userId: "user-1", contextToken: "context-1", text: "done" },
  ]);
  assert.deepEqual((await store.load()).pendingReplies, {});
});

test("concurrent flushes send the same persisted reply only once", async () => {
  const api = new FakeApi();
  const { channel, store } = await createChannel(api);
  await store.update((state) => {
    state.contextTokens["user-1"] = "context-1";
  });

  let ready!: () => void;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  const running = channel.start({
    onQrCode: () => undefined,
    onReady: ready,
    onText: async () => undefined,
  });
  await started;
  await Promise.all([
    channel.queueReply("execution:T0001", "user-1", "done"),
    channel.queueReply("execution:T0001", "user-1", "done"),
  ]);
  channel.stop();
  await running;

  assert.deepEqual(api.sent, [
    { userId: "user-1", contextToken: "context-1", text: "done" },
  ]);
  assert.deepEqual((await store.load()).pendingReplies, {});
});

test("channel stops polling when token expires", async () => {
  const api = new FakeApi();
  api.updates.push(new ILinkApiError("expired", -14));
  const { channel, store } = await createChannel(api);
  let expired = false;
  await channel.start({
    onQrCode: () => undefined,
    onText: async () => undefined,
    onTokenExpired: () => {
      expired = true;
    },
  });
  assert.equal(expired, true);
  const state = await store.load();
  assert.equal(state.credentials, undefined);
  assert.equal(state.cursor, "");
  assert.deepEqual(state.contextTokens, {});
});

test("channel continues after a normal long-poll timeout", async () => {
  const api = new FakeApi();
  const timeout = new Error("timeout");
  timeout.name = "TimeoutError";
  api.updates.push(timeout, new ILinkApiError("expired", -14));
  const { channel } = await createChannel(api);
  await channel.start({
    onQrCode: () => undefined,
    onText: async () => undefined,
  });
  assert.equal(api.updateRequests, 2);
});

test("channel stop aborts a pending poll", async () => {
  const api = new FakeApi();
  const { channel } = await createChannel(api);
  const running = channel.start({
    onQrCode: () => undefined,
    onText: async () => undefined,
    onReady: () => setImmediate(() => channel.stop()),
  });
  await running;
});
