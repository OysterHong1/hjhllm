import { proxyBackend } from "@/lib/server/backend/proxy";

export const dynamic = "force-dynamic";

type BackendProxyContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyApiRequest(
  request: Request,
  context: BackendProxyContext
): Promise<Response> {
  const { path } = await context.params;
  return proxyBackend(request, {
    path: `/api/${path.map(encodeURIComponent).join("/")}`,
  });
}

export async function GET(request: Request, context: BackendProxyContext) {
  return proxyApiRequest(request, context);
}

export async function POST(request: Request, context: BackendProxyContext) {
  return proxyApiRequest(request, context);
}

export async function PUT(request: Request, context: BackendProxyContext) {
  return proxyApiRequest(request, context);
}

export async function PATCH(request: Request, context: BackendProxyContext) {
  return proxyApiRequest(request, context);
}

export async function DELETE(request: Request, context: BackendProxyContext) {
  return proxyApiRequest(request, context);
}
