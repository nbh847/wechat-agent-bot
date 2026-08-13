import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type HealthStatus = "starting" | "listening" | "stopping" | "token_expired";

export class HealthReporter {
  constructor(private readonly path: string) {}

  async write(status: HealthStatus, details: { restored?: boolean } = {}): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify({
      pid: process.pid,
      status,
      restored: details.restored,
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporaryPath, this.path);
  }
}
