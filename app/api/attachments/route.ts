import type { AttachmentKind } from "@/lib/contracts";
import { createUserAttachmentMessage } from "@/lib/server/chat/repository";
import { fail, ok } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES: Record<AttachmentKind, number> = {
  image: 10 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  video: 50 * 1024 * 1024,
};

function getAttachmentKind(mimeType: string): AttachmentKind | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("bad_request", "Expected multipart/form-data request body");
  }

  const userId = formData.get("userId");
  const conversationId = formData.get("conversationId");
  const text = formData.get("text");
  const file = formData.get("file");

  if (typeof userId !== "string" || !userId.trim()) {
    return fail("bad_request", "userId is required");
  }
  if (typeof conversationId !== "string" || !conversationId.trim()) {
    return fail("bad_request", "conversationId is required");
  }
  if (!(file instanceof File)) {
    return fail("bad_request", "file is required");
  }

  const kind = getAttachmentKind(file.type);
  if (!kind) {
    return fail("unsupported_media_type", "Unsupported attachment type", 415);
  }

  const maxSize = MAX_UPLOAD_BYTES[kind];
  if (file.size > maxSize) {
    return fail("payload_too_large", "Attachment is too large", 413);
  }
  if (file.size === 0) {
    return fail("bad_request", "Attachment cannot be empty");
  }

  try {
    const message = await createUserAttachmentMessage({
      conversationId: conversationId.trim(),
      userId: userId.trim(),
      text: typeof text === "string" ? text.trim() : "",
      file,
      fileName: file.name || "attachment",
      mimeType: file.type,
      size: file.size,
      kind,
    });

    if (!message) return fail("not_found", "Conversation not found", 404);
    return ok({ message }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to upload attachment";
    return fail("internal_error", message, 500);
  }
}
