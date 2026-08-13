import type { ILinkApi } from "./api.js";
import { DEFAULT_API_BASE_URL } from "./api.js";
import { isTimeoutError, LoginError } from "./errors.js";
import type { Logger } from "./logger.js";
import type { StateStore } from "./state-store.js";
import type { Credentials } from "./types.js";

export interface LoginCallbacks {
  onQrCode(url: string): Promise<void> | void;
  onScanned?(): void;
  onVerifyCode?(isRetry: boolean): Promise<string>;
}

export class LoginManager {
  constructor(
    private readonly api: ILinkApi,
    private readonly store: StateStore,
    private readonly logger: Logger,
  ) {}

  async getCredentials(
    callbacks: LoginCallbacks,
    signal?: AbortSignal,
  ): Promise<{ credentials: Credentials; restored: boolean }> {
    const state = await this.store.load();
    if (state.credentials) return { credentials: state.credentials, restored: true };

    let verifyCode: string | undefined;
    let verifyRetry = false;
    for (;;) {
      if (signal?.aborted) throw signal.reason;
      const qr = await this.api.getQrCode([], signal);
      await callbacks.onQrCode(qr.qrcode_img_content);
      let pollBaseUrl = DEFAULT_API_BASE_URL;

      for (;;) {
        let status;
        try {
          status = await this.api.pollQrStatus(
            pollBaseUrl,
            qr.qrcode,
            verifyCode,
            signal,
          );
        } catch (error) {
          if (signal?.aborted) throw signal.reason;
          if (isTimeoutError(error)) continue;
          throw error;
        }

        switch (status.status) {
          case "wait":
            continue;
          case "scaned":
            verifyCode = undefined;
            verifyRetry = false;
            callbacks.onScanned?.();
            continue;
          case "scaned_but_redirect":
            if (!status.redirect_host) throw new LoginError("扫码重定向响应缺少主机");
            pollBaseUrl = `https://${status.redirect_host}`;
            continue;
          case "need_verifycode":
            if (!callbacks.onVerifyCode) {
              throw new LoginError("微信要求配对码，但当前没有输入处理器");
            }
            verifyCode = await callbacks.onVerifyCode(verifyRetry);
            verifyRetry = true;
            continue;
          case "verify_code_blocked":
            this.logger.warn("配对码验证被阻止，正在刷新二维码");
            verifyCode = undefined;
            verifyRetry = false;
            break;
          case "expired":
            this.logger.info("登录二维码已过期，正在自动刷新");
            verifyCode = undefined;
            verifyRetry = false;
            break;
          case "binded_redirect":
            throw new LoginError("服务端显示账号已绑定，但本地没有可恢复凭证");
          case "confirmed": {
            if (!status.bot_token || !status.ilink_bot_id || !status.ilink_user_id) {
              throw new LoginError("登录成功响应缺少凭证字段");
            }
            const credentials: Credentials = {
              token: status.bot_token,
              baseUrl: status.baseurl ?? pollBaseUrl,
              accountId: status.ilink_bot_id,
              userId: status.ilink_user_id,
              savedAt: new Date().toISOString(),
            };
            await this.store.update((next) => {
              next.credentials = credentials;
              next.cursor = "";
              next.contextTokens = {};
            });
            return { credentials, restored: false };
          }
        }
        break;
      }
    }
  }
}
