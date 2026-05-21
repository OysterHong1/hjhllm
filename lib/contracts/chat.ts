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

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media_type"
  | "supabase_unavailable"
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
  supabase: "ok";
  checkedAt: string;
};
