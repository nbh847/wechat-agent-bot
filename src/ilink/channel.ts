import type { ILinkApi } from "./api.js";
import { ILinkApiError, isTimeoutError } from "./errors.js";
import type { Logger } from "./logger.js";
import type { LoginCallbacks, LoginManager } from "./login.js";
import type { StateStore } from "./state-store.js";
import type { Credentials, TextMessage, WireMessage } from "./types.js";

export interface ChannelCallbacks extends LoginCallbacks {
  onReady?(restored: boolean): void;
  onText(message: TextMessage): Promise<string | undefined>;
  onTokenExpired?(): void;
}

export class ILinkTextChannel {
  private controller?: AbortController;
  private credentials?: Credentials;

  constructor(
    private readonly api: ILinkApi,
    private readonly login: LoginManager,
    private readonly store: StateStore,
    private readonly logger: Logger,
    private readonly backoff = { initialMs: 1_000, maxMs: 30_000 },
  ) {}

  async start(callbacks: ChannelCallbacks): Promise<void> {
    if (this.controller) throw new Error("iLink 通道已经启动");
    this.controller = new AbortController();
    const signal = this.controller.signal;

    try {
      const login = await this.login.getCredentials(callbacks, signal);
      this.credentials = login.credentials;
      callbacks.onReady?.(login.restored);
      let retryDelay = this.backoff.initialMs;

      while (!signal.aborted) {
        const state = await this.store.load();
        try {
          await this.flushPendingReplies(signal);
          const updates = await this.api.getUpdates(
            login.credentials.baseUrl,
            login.credentials.token,
            state.cursor,
            signal,
          );
          retryDelay = this.backoff.initialMs;
          await this.processMessages(updates.msgs ?? [], callbacks, signal);
          if (updates.get_updates_buf) {
            await this.store.update((next) => {
              next.cursor = updates.get_updates_buf ?? next.cursor;
            });
          }
        } catch (error) {
          if (signal.aborted) break;
          if (isTimeoutError(error)) continue;
          if (error instanceof ILinkApiError && error.isTokenExpired) {
            this.logger.warn("iLink 登录凭证已失效，需要重新扫码");
            await this.store.update((next) => {
              next.credentials = undefined;
              next.cursor = "";
              next.contextTokens = {};
              next.pendingReplies = {};
            });
            callbacks.onTokenExpired?.();
            break;
          }
          this.logger.warn(`iLink 轮询失败，${retryDelay}ms 后重试`);
          await abortableDelay(retryDelay, signal);
          retryDelay = Math.min(retryDelay * 2, this.backoff.maxMs);
        }
      }
    } finally {
      this.controller = undefined;
    }
  }

  stop(): void {
    this.controller?.abort(new Error("iLink 通道已停止"));
  }

  async reply(userId: string, text: string, signal?: AbortSignal): Promise<void> {
    if (!this.credentials) throw new Error("iLink 通道尚未登录");
    const state = await this.store.load();
    const contextToken = state.contextTokens[userId];
    if (!contextToken) throw new Error("当前用户没有可用会话上下文");
    await this.api.sendText(
      this.credentials.baseUrl,
      this.credentials.token,
      userId,
      contextToken,
      text,
      signal,
    );
  }

  async queueReply(
    replyId: string,
    userId: string,
    text: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.store.update((next) => {
      next.pendingReplies[replyId] = { messageId: replyId, userId, text };
    });
    await this.flushPendingReplies(signal ?? new AbortController().signal);
  }

  private async processMessages(
    messages: WireMessage[],
    callbacks: ChannelCallbacks,
    signal: AbortSignal,
  ): Promise<void> {
    for (const raw of messages) {
      const message = parseTextMessage(raw);
      if (!message) continue;
      const state = await this.store.load();
      if (state.processedMessageIds.includes(message.id)) continue;

      // Persist before invoking downstream code so duplicate delivery cannot
      // execute the same remote instruction twice.
      await this.store.update((next) => {
        next.contextTokens[message.userId] = message.contextToken;
        next.processedMessageIds.push(message.id);
      });
      const response = await callbacks.onText(message);
      if (response) {
        await this.store.update((next) => {
          next.pendingReplies[message.id] = {
            messageId: message.id,
            userId: message.userId,
            text: response,
          };
        });
        await this.flushPendingReplies(signal);
      }
    }
  }

  private async flushPendingReplies(signal: AbortSignal): Promise<void> {
    const state = await this.store.load();
    for (const reply of Object.values(state.pendingReplies)) {
      await this.reply(reply.userId, reply.text, signal);
      await this.store.update((next) => {
        delete next.pendingReplies[reply.messageId];
      });
    }
  }
}

function parseTextMessage(raw: WireMessage): TextMessage | undefined {
  if (raw.message_type !== 1 || !raw.from_user_id || !raw.context_token) return;
  const text = raw.item_list?.find((item) => item.type === 1)?.text_item?.text;
  const wireId = raw.client_id ?? raw.message_id;
  if (!text || wireId === undefined) return;
  return {
    id: String(wireId),
    userId: raw.from_user_id,
    text,
    contextToken: raw.context_token,
    raw,
  };
}

function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
