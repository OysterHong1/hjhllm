import { proxyBackend } from "@/lib/server/backend/proxy";
import { fail } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

type AdminPanelProxyContext = {
  params: Promise<{
    path: string[];
  }>;
};

function isAdminPanelEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_UI === "true"
  );
}

async function proxyAdminPanelRequest(
  request: Request,
  context: AdminPanelProxyContext
): Promise<Response> {
  if (!isAdminPanelEnabled()) {
    return fail("not_found", "Not found", 404);
  }

  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) {
    return fail("internal_error", "ADMIN_API_TOKEN is not configured", 500);
  }

  const { path } = await context.params;
  return proxyBackend(request, {
    path: `/api/admin/${path.map(encodeURIComponent).join("/")}`,
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
}

export async function GET(request: Request, context: AdminPanelProxyContext) {
  return proxyAdminPanelRequest(request, context);
}

export async function POST(request: Request, context: AdminPanelProxyContext) {
  return proxyAdminPanelRequest(request, context);
}
