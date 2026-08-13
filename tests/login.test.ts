import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { ILinkApi } from "../src/ilink/api.js";
import { LoginManager } from "../src/ilink/login.js";
import { silentLogger } from "../src/ilink/logger.js";
import { StateStore } from "../src/ilink/state-store.js";
import { FakeApi } from "./helpers.js";

async function createLogin(api: FakeApi) {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-login-"));
  const store = new StateStore(join(directory, "state.json"));
  return { login: new LoginManager(api as unknown as ILinkApi, store, silentLogger), store };
}

test("login treats QR long-poll timeout as wait", async () => {
  const api = new FakeApi();
  const timeout = new Error("timeout");
  timeout.name = "TimeoutError";
  api.qrCodes.push({ qrcode: "q1", qrcode_img_content: "url-1" });
  api.statuses.push(timeout, {
    status: "confirmed",
    bot_token: "token",
    ilink_bot_id: "bot",
    ilink_user_id: "owner",
    baseurl: "https://api.example",
  });
  const { login } = await createLogin(api);
  const result = await login.getCredentials({ onQrCode: () => undefined });
  assert.equal(result.credentials.token, "token");
});

test("login reports scanned state before confirmation", async () => {
  const api = new FakeApi();
  api.qrCodes.push({ qrcode: "q1", qrcode_img_content: "url-1" });
  api.statuses.push(
    { status: "scaned" },
    {
      status: "confirmed",
      bot_token: "token",
      ilink_bot_id: "bot",
      ilink_user_id: "owner",
    },
  );
  const { login } = await createLogin(api);
  let scanned = 0;
  await login.getCredentials({
    onQrCode: () => undefined,
    onScanned: () => scanned++,
  });
  assert.equal(scanned, 1);
});

test("login refreshes an expired QR code", async () => {
  const api = new FakeApi();
  api.qrCodes.push(
    { qrcode: "q1", qrcode_img_content: "url-1" },
    { qrcode: "q2", qrcode_img_content: "url-2" },
  );
  api.statuses.push(
    { status: "expired" },
    {
      status: "confirmed",
      bot_token: "token",
      ilink_bot_id: "bot",
      ilink_user_id: "owner",
    },
  );
  const shown: string[] = [];
  const { login } = await createLogin(api);
  await login.getCredentials({
    onQrCode: (url) => {
      shown.push(url);
    },
  });
  assert.deepEqual(shown, ["url-1", "url-2"]);
});
