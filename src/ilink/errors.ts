export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

export class ILinkApiError extends Error {
  constructor(message: string, readonly code: number) {
    super(message);
    this.name = "ILinkApiError";
  }

  get isTokenExpired(): boolean {
    return this.code === -14;
  }
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
