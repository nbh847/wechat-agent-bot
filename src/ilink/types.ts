export interface Credentials {
  token: string;
  baseUrl: string;
  accountId: string;
  userId: string;
  savedAt: string;
}

export interface QrCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

export interface QrStatusResponse {
  status:
    | "wait"
    | "scaned"
    | "confirmed"
    | "expired"
    | "need_verifycode"
    | "verify_code_blocked"
    | "scaned_but_redirect"
    | "binded_redirect";
  bot_token?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
  baseurl?: string;
  redirect_host?: string;
}

export interface WireMessageItem {
  type?: number;
  text_item?: { text?: string };
}

export interface WireMessage {
  message_id?: number | string;
  client_id?: string;
  from_user_id?: string;
  message_type?: number;
  context_token?: string;
  item_list?: WireMessageItem[];
}

export interface UpdatesResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WireMessage[];
  get_updates_buf?: string;
}

export interface TextMessage {
  id: string;
  userId: string;
  text: string;
  contextToken: string;
  raw: WireMessage;
}

export interface ChannelState {
  credentials?: Credentials;
  cursor: string;
  contextTokens: Record<string, string>;
  processedMessageIds: string[];
  pendingReplies: Record<string, PendingReply>;
}

export interface PendingReply {
  messageId: string;
  userId: string;
  text: string;
}
