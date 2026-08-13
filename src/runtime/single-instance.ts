import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";

export interface InstanceLock {
  release(): Promise<void>;
}

export async function acquireInstanceLock(path: string): Promise<InstanceLock> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(path, "wx", 0o600);
      await handle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      await handle.close();
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          const owner = await readLockPid(path);
          if (owner === process.pid) await unlink(path).catch(ignoreMissing);
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = await readLockPid(path);
      if (pid && isProcessAlive(pid)) {
        throw new Error(`服务已经运行（PID ${pid}）`);
      }
      await unlink(path).catch(ignoreMissing);
    }
  }
  throw new Error("无法取得服务单实例锁");
}

async function readLockPid(path: string): Promise<number | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as { pid?: unknown };
    return typeof value.pid === "number" && Number.isInteger(value.pid) ? value.pid : undefined;
  } catch {
    return undefined;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function ignoreMissing(error: unknown): void {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
