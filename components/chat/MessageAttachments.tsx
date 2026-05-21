import type { MessageAttachment } from "@/lib/contracts";

type MessageAttachmentsProps = {
  attachments: MessageAttachment[];
};

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const imageAttachments = attachments.filter(
    (attachment) => attachment.kind === "image"
  );
  const audioAttachments = attachments.filter(
    (attachment) => attachment.kind === "audio"
  );
  const videoAttachments = attachments.filter(
    (attachment) => attachment.kind === "video"
  );
  const otherAttachments = attachments.filter(
    (attachment) =>
      attachment.kind !== "image" &&
      attachment.kind !== "audio" &&
      attachment.kind !== "video"
  );

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-2">
      {imageAttachments.length > 0 && (
        <div
          className={`grid gap-2 ${
            imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {imageAttachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-border bg-white"
            >
              <img
                src={attachment.url}
                alt="上传图片"
                className="max-h-80 w-full object-contain"
              />
            </a>
          ))}
        </div>
      )}

      {audioAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="rounded-lg border border-border bg-white p-2"
        >
          <audio controls src={attachment.url} className="h-9 w-full" />
          <div className="mt-1 text-[10px] text-muted">
            语音 · {formatSize(attachment.size)}
            {attachment.durationMs ? ` · ${formatDuration(attachment.durationMs)}` : ""}
          </div>
        </div>
      ))}

      {videoAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="overflow-hidden rounded-lg border border-border bg-white"
        >
          <video controls src={attachment.url} className="max-h-80 w-full" />
        </div>
      ))}

      {otherAttachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted transition-colors hover:text-foreground"
        >
          {attachment.mimeType} · {formatSize(attachment.size)}
        </a>
      ))}
    </div>
  );
}

function formatSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
