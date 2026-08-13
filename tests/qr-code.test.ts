import assert from "node:assert/strict";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeQrCode } from "../src/ilink/qr-code.js";

test("QR code is only readable and writable by its owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wechat-agent-qr-"));
  const path = join(directory, "login-qr.png");
  await writeQrCode(path, "https://example.com/login");
  assert.equal((await stat(path)).mode & 0o777, 0o600);
});
