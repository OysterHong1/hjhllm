import { archiveAdminConversation } from "@/lib/server/chat/repository";
import { requireAdmin } from "@/lib/server/http/admin-auth";
import { fail, ok } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

type AdminArchiveRouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

export async function POST(
  request: Request,
  context: AdminArchiveRouteContext
) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const { conversationId } = await context.params;

  try {
    const conversation = await archiveAdminConversation(conversationId);
    if (!conversation) return fail("not_found", "Conversation not found", 404);
    return ok({ conversation });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to archive conversation";
    return fail("internal_error", message, 500);
  }
}
