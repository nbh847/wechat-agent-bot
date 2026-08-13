import { HttpError, ILinkApiError } from "./errors.js";

export type FetchLike = typeof fetch;

export class HttpClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async json<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    const response = await this.fetchImpl(url, { ...init, signal });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T & ApiEnvelope) : ({} as T & ApiEnvelope);

    if (!response.ok) {
      throw new HttpError(`iLink HTTP ${response.status}`, response.status);
    }
    const code = data.errcode ?? data.ret ?? 0;
    if (code !== 0) {
      throw new ILinkApiError(data.errmsg ?? `iLink API error ${code}`, code);
    }
    return data;
  }
}

interface ApiEnvelope {
  ret?: number;
  errcode?: number;
  errmsg?: string;
}
