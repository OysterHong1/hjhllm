import type { Message } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { MessageAttachments } from "./MessageAttachments";

type ChatMessageProps = {
  message: Message;
  username?: string;
  roleLabel?: string;
  showSenderLabel?: boolean;
};

export function ChatMessage({
  message,
  username = "U",
  roleLabel,
  showSenderLabel = false,
}: ChatMessageProps) {
  const isUser = message.sender === "user";
  const senderLabel =
    roleLabel ?? (isUser ? username || "用户" : "HJH LLM");

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <AdminAvatar />}
      <div
        className={`flex max-w-[82%] flex-col ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {showSenderLabel && (
          <div className="mb-1 text-[11px] text-muted">{senderLabel}</div>
        )}
        <div
          className={`rounded-[22px] px-4 py-3 text-sm leading-relaxed shadow-sm ${
            isUser
              ? "bg-[#dbeafe] text-[#172033]"
              : "border border-[#e6e2da] bg-white text-foreground"
          }`}
        >
          <div className="space-y-2">
            <MessageAttachments attachments={message.attachments} />
            {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}
          </div>
        </div>
        <div className="mt-1 text-[10px] text-muted">
          {formatTime(message.createdAt)}
        </div>
      </div>
      {isUser && <UserAvatar username={username} />}
    </div>
  );
}

export function UserAvatar({ username }: { username: string }) {
  const initial = username.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1f2937] text-sm font-semibold text-white shadow-sm">
      {initial}
    </div>
  );
}

export function AdminAvatar() {
  return (
    <img
      src="/brand/admin-avatar.jpg"
      alt=""
      className="h-9 w-9 flex-shrink-0 rounded-full object-cover shadow-sm"
    />
  );
}
