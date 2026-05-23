export type MessageSender = "user" | "admin" | "assistant";

export type AttachmentKind = "image" | "audio" | "video";

export type User = {
  id: string;
  username: string;
  createdAt: string;
  lastSeenAt: string | null;
};

export type ConversationStatus = "open" | "archived";

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminConversation = Conversation & {
  user: User | null;
  needsReply: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: MessageSender;
  text: string;
  attachments: MessageAttachment[];
  createdAt: string;
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  kind: AttachmentKind;
  storagePath: string;
  url: string;
  mimeType: string;
  size: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  createdAt: string;
};

export type AiReplyConfig = {
  enabled: boolean;
  provider: "deepseek";
  baseUrl: string;
  model: string;
  apiKeyConfigured: boolean;
  systemPrompt: string;
  reasoningEffort: string;
  dailyTokenLimit: number;
  todayUsage: AiReplyUsage;
};

export type AiReplyConfigInput = {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  reasoningEffort?: string;
  dailyTokenLimit?: number;
};

export type AiReplyUsage = {
  usageDay: string;
  timezone: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  activeReservedTokens: number;
  remainingTokens: number | null;
  limitReached: boolean;
};

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media_type"
  | "database_unavailable"
  | "internal_error";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export type HealthCheck = {
  service: "hjhllm";
  database: "ok";
  checkedAt: string;
};
