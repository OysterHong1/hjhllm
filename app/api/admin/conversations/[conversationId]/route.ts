import { getAdminConversation } from "@/lib/server/chat/repository";
import { requireAdmin } from "@/lib/server/http/admin-auth";
import { fail, ok } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

type AdminConversationRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function GET(
  request: Request,
  context: AdminConversationRouteContext
) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { conversationId } = await context.params;

  try {
    const detail = await getAdminConversation(conversationId);
    if (!detail) return fail("not_found", "Conversation not found", 404);
    return ok(detail);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to get conversation";
    return fail("internal_error", message, 500);
  }
}
