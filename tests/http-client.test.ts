import assert from "node:assert/strict";
import test from "node:test";

import { ILinkApiError } from "../src/ilink/errors.js";
import { HttpClient } from "../src/ilink/http-client.js";

test("HttpClient converts iLink token expiry into a typed error", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ ret: -14, errmsg: "session timeout" }), {
      status: 200,
    });
  const client = new HttpClient(fetchImpl as typeof fetch);
  await assert.rejects(
    client.json("https://example.invalid", {}, 1_000),
    (error: unknown) =>
      error instanceof ILinkApiError && error.isTokenExpired,
  );
});
