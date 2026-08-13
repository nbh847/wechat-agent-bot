import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ChannelState } from "./types.js";

const EMPTY_STATE: ChannelState = {
  cursor: "",
  contextTokens: {},
  processedMessageIds: [],
  pendingReplies: {},
};

export class StateStore {
  private state?: ChannelState;

  constructor(
    private readonly path: string,
    private readonly maxProcessedIds = 1_000,
  ) {}

  async load(): Promise<ChannelState> {
    if (this.state) return structuredClone(this.state);
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as ChannelState;
      this.state = normalizeState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.state = structuredClone(EMPTY_STATE);
    }
    return structuredClone(this.state);
  }

  async update(mutator: (state: ChannelState) => void): Promise<ChannelState> {
    const next = await this.load();
    mutator(next);
    next.processedMessageIds = next.processedMessageIds.slice(-this.maxProcessedIds);
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporaryPath, this.path);
    this.state = next;
    return structuredClone(next);
  }
}

function normalizeState(value: Partial<ChannelState>): ChannelState {
  return {
    credentials: value.credentials,
    cursor: value.cursor ?? "",
    contextTokens: value.contextTokens ?? {},
    processedMessageIds: value.processedMessageIds ?? [],
    pendingReplies: value.pendingReplies ?? {},
  };
}
