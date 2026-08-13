import type { Credentials, QrCodeResponse, QrStatusResponse, UpdatesResponse } from "../src/ilink/types.js";

export const credentials: Credentials = {
  token: "test-token",
  baseUrl: "https://example.invalid",
  accountId: "bot-id",
  userId: "owner-id",
  savedAt: "2026-08-13T00:00:00.000Z",
};

export class FakeApi {
  qrCodes: QrCodeResponse[] = [];
  statuses: Array<QrStatusResponse | Error> = [];
  updates: Array<UpdatesResponse | Error | Promise<UpdatesResponse>> = [];
  sent: Array<{ userId: string; contextToken: string; text: string }> = [];
  qrRequests = 0;
  updateRequests = 0;
  onUpdateRequest?: (count: number) => void;
  sendErrors: Error[] = [];

  async getQrCode(): Promise<QrCodeResponse> {
    const value = this.qrCodes[this.qrRequests++];
    if (!value) throw new Error("missing fake qr code");
    return value;
  }

  async pollQrStatus(): Promise<QrStatusResponse> {
    const value = this.statuses.shift();
    if (!value) throw new Error("missing fake qr status");
    if (value instanceof Error) throw value;
    return value;
  }

  async getUpdates(
    _baseUrl?: string,
    _token?: string,
    _cursor?: string,
    signal?: AbortSignal,
  ): Promise<UpdatesResponse> {
    this.updateRequests++;
    this.onUpdateRequest?.(this.updateRequests);
    const value = this.updates.shift();
    if (!value) {
      return new Promise((_, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(signal.reason),
          { once: true },
        );
      });
    }
    if (value instanceof Error) throw value;
    return value;
  }

  async sendText(
    _baseUrl: string,
    _token: string,
    userId: string,
    contextToken: string,
    text: string,
  ): Promise<void> {
    const error = this.sendErrors.shift();
    if (error) throw error;
    this.sent.push({ userId, contextToken, text });
  }
}
