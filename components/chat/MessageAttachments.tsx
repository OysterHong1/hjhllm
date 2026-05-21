import type { MessageAttachment } from "@/lib/contracts";

type MessageAttachmentsProps = {
  attachments: MessageAttachment[];
};

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  const imageAttachments = attachments.filter(
    (attachment) => attachment.kind === "image"
  );
  const otherAttachments = attachments.filter(
    (attachment) => attachment.kind !== "image"
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

      {otherAttachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-border bg-white px-3 py-2 text-xs text-muted transition-colors hover:text-foreground"
        >
          {attachment.mimeType} · {Math.ceil(attachment.size / 1024)} KB
        </a>
      ))}
    </div>
  );
}
