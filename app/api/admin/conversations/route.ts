import { listAdminConversations } from "@/lib/server/chat/repository";
import { requireAdmin } from "@/lib/server/http/admin-auth";
import { fail, ok } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const conversations = await listAdminConversations();
    return ok({ conversations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list conversations";
    return fail("internal_error", message, 500);
  }
}
