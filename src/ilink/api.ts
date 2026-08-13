import { randomBytes, randomUUID } from "node:crypto";

import { HttpClient } from "./http-client.js";
import type { QrCodeResponse, QrStatusResponse, UpdatesResponse } from "./types.js";

export const DEFAULT_API_BASE_URL = "https://ilinkai.weixin.qq.com";
const CHANNEL_VERSION = "0.1.0";
const CLIENT_VERSION = String(1 << 16);

export class ILinkApi {
  constructor(private readonly http: HttpClient) {}

  getQrCode(localTokens: string[], signal?: AbortSignal): Promise<QrCodeResponse> {
    return this.http.json(
      `${DEFAULT_API_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`,
      {
        method: "POST",
        headers: { ...commonHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ local_token_list: localTokens.slice(0, 10) }),
        signal,
      },
      30_000,
    );
  }

  pollQrStatus(
    baseUrl: string,
    qrcode: string,
    verifyCode?: string,
    signal?: AbortSignal,
  ): Promise<QrStatusResponse> {
    const verify = verifyCode ? `&verify_code=${encodeURIComponent(verifyCode)}` : "";
    return this.http.json(
      `${baseUrl}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}${verify}`,
      { method: "GET", headers: commonHeaders(), signal },
      35_000,
    );
  }

  getUpdates(
    baseUrl: string,
    token: string,
    cursor: string,
    signal?: AbortSignal,
  ): Promise<UpdatesResponse> {
    return this.http.json(
      `${baseUrl}/ilink/bot/getupdates`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ get_updates_buf: cursor, base_info: baseInfo() }),
        signal,
      },
      40_000,
    );
  }

  async sendText(
    baseUrl: string,
    token: string,
    userId: string,
    contextToken: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.http.json(
      `${baseUrl}/ilink/bot/sendmessage`,
      {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          msg: {
            from_user_id: "",
            to_user_id: userId,
            client_id: randomUUID(),
            message_type: 2,
            message_state: 2,
            context_token: contextToken,
            item_list: [{ type: 1, text_item: { text } }],
          },
          base_info: baseInfo(),
        }),
        signal,
      },
      15_000,
    );
  }
}

function commonHeaders(): Record<string, string> {
  return {
    "iLink-App-Id": "bot",
    "iLink-App-ClientVersion": CLIENT_VERSION,
  };
}

function authHeaders(token: string): Record<string, string> {
  const uin = randomBytes(4).readUInt32BE(0);
  return {
    ...commonHeaders(),
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    Authorization: `Bearer ${token}`,
    "X-WECHAT-UIN": Buffer.from(String(uin)).toString("base64"),
  };
}

function baseInfo() {
  return {
    channel_version: CHANNEL_VERSION,
    bot_agent: "WeChatAgentBot/0.1.0",
  };
}
