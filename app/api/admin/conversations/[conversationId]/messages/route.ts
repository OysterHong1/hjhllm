import { createAdminMessage } from "@/lib/server/chat/repository";
import { requireAdmin } from "@/lib/server/http/admin-auth";
import { fail, isRecord, ok, readJsonObject } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

type AdminMessagesRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function POST(request: Request, context: AdminMessagesRouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { conversationId } = await context.params;
  const body = await readJsonObject(request);
  if (!isRecord(body)) {
    return fail("bad_request", "Expected JSON request body");
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return fail("bad_request", "Message text is required");

  try {
    const message = await createAdminMessage(conversationId, text);
    if (!message) return fail("not_found", "Conversation not found", 404);
    return ok({ message }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create message";
    return fail("internal_error", message, 500);
  }
}
