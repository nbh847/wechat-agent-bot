import { appendFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import type { Logger } from "../ilink/logger.js";

const SENSITIVE = /(?:token|secret|password|credential|context_token|bot_token)[=:]\s*\S+/gi;

export class RotatingFileLogger implements Logger {
  constructor(
    private readonly path: string,
    private readonly maxBytes = 1_000_000,
    private readonly maxFiles = 3,
  ) {}

  info(message: string): void { void this.write("INFO", message); }
  warn(message: string): void { void this.write("WARN", message); }
  error(message: string): void { void this.write("ERROR", message); }

  async flush(): Promise<void> {
    await this.writes;
  }

  private writes: Promise<void> = Promise.resolve();

  private write(level: string, message: string): Promise<void> {
    const next = this.writes.then(async () => {
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const line = `${new Date().toISOString()} ${level} ${sanitize(message)}\n`;
      const size = await stat(this.path).then((value) => value.size).catch(() => 0);
      if (size + Buffer.byteLength(line) > this.maxBytes) await this.rotate();
      await appendFile(this.path, line, { mode: 0o600 });
    });
    this.writes = next.catch(() => undefined);
    return next;
  }

  private async rotate(): Promise<void> {
    await unlink(`${this.path}.${this.maxFiles}`).catch(ignoreMissing);
    for (let index = this.maxFiles - 1; index >= 1; index--) {
      await rename(`${this.path}.${index}`, `${this.path}.${index + 1}`).catch(ignoreMissing);
    }
    await rename(this.path, `${this.path}.1`).catch(ignoreMissing);
  }
}

function sanitize(message: string): string {
  return message.replace(SENSITIVE, (value) => `${value.split(/[=:]/, 1)[0]}=[REDACTED]`).slice(0, 2_000);
}

function ignoreMissing(error: unknown): void {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
