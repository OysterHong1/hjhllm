import { resetDemoData } from "@/lib/server/chat/repository";
import { requireAdmin } from "@/lib/server/http/admin-auth";
import { fail, ok } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await resetDemoData();
    return ok({ reset: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset demo data";
    return fail("internal_error", message, 500);
  }
}
