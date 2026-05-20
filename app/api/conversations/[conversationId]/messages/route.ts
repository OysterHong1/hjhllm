import {
  createUserMessage,
  listConversationMessages,
} from "@/lib/server/chat/repository";
import { fail, isRecord, ok, readJsonObject } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

type MessagesRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(request: Request, context: MessagesRouteContext) {
  const { conversationId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) return fail("bad_request", "userId is required");

  try {
    const messages = await listConversationMessages(conversationId, userId);
    if (!messages) return fail("not_found", "Conversation not found", 404);
    return ok({ messages });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list messages";
    return fail("internal_error", message, 500);
  }
}

export async function POST(request: Request, context: MessagesRouteContext) {
  const { conversationId } = await context.params;
  const body = await readJsonObject(request);
  if (!isRecord(body)) {
    return fail("bad_request", "Expected JSON request body");
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!userId) return fail("bad_request", "userId is required");
  if (!text) return fail("bad_request", "Message text is required");

  try {
    const message = await createUserMessage(conversationId, userId, text);
    if (!message) return fail("not_found", "Conversation not found", 404);
    return ok({ message }, { status: 201 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to create message";
    return fail("internal_error", errorMessage, 500);
  }
}
