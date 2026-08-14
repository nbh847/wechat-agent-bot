import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type ConversationRole = "user" | "bot";

export interface ConversationMessage {
  role: ConversationRole;
  text: string;
  createdAt: string;
}

export interface ConversationContext {
  id: string;
  senderId: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

interface ConversationHistoryState {
  contexts: Record<string, ConversationContext>;
}

export interface ConversationHistoryRetention {
  ttlMs?: number;
  maxContexts?: number;
  maxMessagesPerContext?: number;
  now?: () => Date;
}

const EMPTY_STATE: ConversationHistoryState = { contexts: {} };

export class ConversationHistoryStore {
  private state?: ConversationHistoryState;
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly retention: ConversationHistoryRetention = {},
  ) {}

  async load(): Promise<ConversationHistoryState> {
    if (this.state) return structuredClone(this.state);
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as Partial<ConversationHistoryState>;
      this.state = { contexts: parsed.contexts ?? {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.state = structuredClone(EMPTY_STATE);
    }
    return structuredClone(this.state);
  }

  async append(
    contextId: string,
    senderId: string,
    role: ConversationRole,
    text: string,
  ): Promise<void> {
    if (!text) return;
    await this.update((state, now) => {
      const context = state.contexts[contextId] ?? {
        id: contextId,
        senderId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      context.messages.push({ role, text, createdAt: now });
      context.updatedAt = now;
      state.contexts[contextId] = context;
    });
  }

  async appendTurn(
    contextId: string,
    senderId: string,
    userText: string,
    botText: string,
  ): Promise<void> {
    await this.update((state, now) => {
      const context = state.contexts[contextId] ?? {
        id: contextId,
        senderId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      if (userText) context.messages.push({ role: "user", text: userText, createdAt: now });
      if (botText) context.messages.push({ role: "bot", text: botText, createdAt: now });
      context.updatedAt = now;
      state.contexts[contextId] = context;
    });
  }

  async prune(): Promise<void> {
    await this.update(() => undefined);
  }

  private async update(
    mutate: (state: ConversationHistoryState, now: string) => void,
  ): Promise<void> {
    const write = this.writes.then(async () => {
      const next = await this.load();
      const now = (this.retention.now ?? (() => new Date()))();
      mutate(next, now.toISOString());
      pruneConversationHistory(next, now.getTime(), this.retention);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporaryPath = `${this.path}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
      await rename(temporaryPath, this.path);
      this.state = next;
    });
    this.writes = write.catch(() => undefined);
    await write;
  }
}

function pruneConversationHistory(
  state: ConversationHistoryState,
  now: number,
  retention: ConversationHistoryRetention,
): void {
  const ttlMs = retention.ttlMs ?? 30 * 24 * 60 * 60_000;
  const maxContexts = retention.maxContexts ?? 30;
  const maxMessages = retention.maxMessagesPerContext ?? 200;
  const contexts = Object.values(state.contexts)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const [index, context] of contexts.entries()) {
    const timestamp = Date.parse(context.updatedAt);
    if (index >= maxContexts || !Number.isFinite(timestamp) || now - timestamp > ttlMs) {
      delete state.contexts[context.id];
      continue;
    }
    context.messages = context.messages.slice(-maxMessages);
  }
}
