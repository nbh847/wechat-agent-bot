import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { ChannelState } from "./types.js";

const EMPTY_STATE: ChannelState = {
  cursor: "",
  contextTokens: {},
  contextTokenUpdatedAt: {},
  processedMessageIds: [],
  pendingReplies: {},
};

export class StateStore {
  private state?: ChannelState;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly maxProcessedIds = 1_000,
    private readonly retention = {
      contextTokenTtlMs: 30 * 24 * 60 * 60_000,
      maxContextTokens: 100,
      pendingReplyTtlMs: 7 * 24 * 60 * 60_000,
      maxPendingReplies: 1_000,
      now: () => new Date(),
    },
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
    let updated: ChannelState | undefined;
    const write = this.writes.then(async () => {
      const next = await this.load();
      mutator(next);
      next.processedMessageIds = next.processedMessageIds.slice(-this.maxProcessedIds);
      pruneChannelState(next, this.retention);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.path}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, {
        mode: 0o600,
      });
      await rename(temporaryPath, this.path);
      this.state = next;
      updated = structuredClone(next);
    });
    this.writes = write.catch(() => undefined);
    await write;
    return updated!;
  }
}

function normalizeState(value: Partial<ChannelState>): ChannelState {
  const normalized: ChannelState = {
    credentials: value.credentials,
    cursor: value.cursor ?? "",
    contextTokens: value.contextTokens ?? {},
    contextTokenUpdatedAt: value.contextTokenUpdatedAt ?? {},
    processedMessageIds: value.processedMessageIds ?? [],
    pendingReplies: value.pendingReplies ?? {},
  };
  const migratedAt = new Date().toISOString();
  for (const userId of Object.keys(normalized.contextTokens)) {
    normalized.contextTokenUpdatedAt[userId] ??= migratedAt;
  }
  for (const reply of Object.values(normalized.pendingReplies)) {
    reply.createdAt ??= migratedAt;
  }
  return normalized;
}

function pruneChannelState(
  state: ChannelState,
  retention: {
    contextTokenTtlMs: number;
    maxContextTokens: number;
    pendingReplyTtlMs: number;
    maxPendingReplies: number;
    now: () => Date;
  },
): void {
  const now = retention.now().getTime();
  const contextEntries = Object.keys(state.contextTokens)
    .sort((left, right) => (state.contextTokenUpdatedAt[right] ?? "")
      .localeCompare(state.contextTokenUpdatedAt[left] ?? ""));
  for (const [index, userId] of contextEntries.entries()) {
    const timestamp = Date.parse(state.contextTokenUpdatedAt[userId] ?? "");
    if (index >= retention.maxContextTokens || (
      Number.isFinite(timestamp) && now - timestamp > retention.contextTokenTtlMs
    )) {
      delete state.contextTokens[userId];
      delete state.contextTokenUpdatedAt[userId];
    }
  }

  const replies = Object.values(state.pendingReplies)
    .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
  for (const [index, reply] of replies.entries()) {
    const timestamp = Date.parse(reply.createdAt ?? "");
    if (index >= retention.maxPendingReplies || (
      Number.isFinite(timestamp) && now - timestamp > retention.pendingReplyTtlMs
    )) {
      delete state.pendingReplies[reply.messageId];
    }
  }
}
