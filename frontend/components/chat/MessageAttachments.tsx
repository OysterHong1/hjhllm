import Image from "next/image";
import type { MessageAttachment } from "@/lib/contracts";
import { formatAttachmentSize } from "@/lib/contracts";
import { AudioBubble } from "./AudioBubble";

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
          className={`grid w-[min(68vw,420px)] max-w-full gap-2 ${
            imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {imageAttachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="relative block aspect-[4/3] min-h-32 overflow-hidden rounded-xl border border-border bg-white"
            >
              <Image
                src={attachment.url}
                alt="上传图片"
                fill
                unoptimized
                sizes="(max-width: 768px) 80vw, 520px"
                className="object-contain"
              />
            </a>
          ))}
        </div>
      )}

      {audioAttachments.map((attachment) => (
        <AudioBubble
          key={attachment.id}
          src={attachment.url}
          durationMs={attachment.durationMs}
        />
      ))}

      {videoAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="overflow-hidden rounded-lg border border-border bg-white"
        >
          <video controls src={attachment.url} className="max-h-80 w-full" />
          <div className="px-2 py-1 text-[10px] text-muted">
            视频 · {formatAttachmentSize(attachment.size)}
          </div>
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
          {attachment.mimeType} · {formatAttachmentSize(attachment.size)}
        </a>
      ))}
    </div>
  );
}
