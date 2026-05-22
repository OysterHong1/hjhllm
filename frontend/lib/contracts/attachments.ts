import type { AttachmentKind } from "./chat";

export const ATTACHMENT_MAX_BYTES: Record<AttachmentKind, number> = {
  image: 10 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

export function formatAttachmentSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
