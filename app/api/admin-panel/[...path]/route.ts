import {
  archiveAdminConversation,
  createAdminMessage,
  getAdminConversation,
  listAdminConversations,
  resetDemoData,
} from "@/lib/server/chat/repository";
import { createConversationArchiveZip } from "@/lib/server/archive/local-conversation-archive";
import {
  fail,
  isRecord,
  ok,
  readJsonObject,
} from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function getTargetOrigin(request: Request): string {
  return (
    process.env.ADMIN_API_BASE_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin
  );
}

async function remoteAdminRequest<T>(
  request: Request,
  path: string[]
): Promise<T> {
  const adminToken = process.env.ADMIN_API_TOKEN;
  if (!adminToken) {
    throw new Error("ADMIN_API_TOKEN is not configured");
  }

  const targetUrl = new URL(
    `/api/admin/${path.map(encodeURIComponent).join("/")}`,
    getTargetOrigin(request)
  );
  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    cache: "no-store",
  });

  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.error?.message ?? "Remote admin request failed");
  }

  return result.data as T;
}

async function getConversationDetailForArchive(
  request: Request,
  conversationId: string
) {
  if (!process.env.ADMIN_API_BASE_URL) {
    return getAdminConversation(conversationId);
  }

  return remoteAdminRequest<Awaited<ReturnType<typeof getAdminConversation>>>(
    request,
    ["conversations", conversationId]
  );
}

async function createArchiveDownloadResponse(
  request: Request,
  conversationId: string
): Promise<Response> {
  try {
    const detail = await getConversationDetailForArchive(request, conversationId);
    if (!detail) return fail("not_found", "Conversation not found", 404);

    const archive = await createConversationArchiveZip(detail);
    return new Response(new Uint8Array(archive.data), {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          archive.fileName
        )}`,
        "Content-Length": String(archive.data.length),
        "Content-Type": "application/zip",
        "X-Archive-Failed-Media-Count": String(archive.failedMediaCount),
        "X-Archive-Filename": encodeURIComponent(archive.fileName),
        "X-Archive-Media-Count": String(archive.mediaCount),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to archive locally";
    return fail("internal_error", message, 500);
  }
}

async function handleLocalAdminRequest(
  request: Request,
  path: string[]
): Promise<Response> {
  try {
    if (
      request.method === "GET" &&
      path.length === 1 &&
      path[0] === "conversations"
    ) {
      const conversations = await listAdminConversations();
      return ok({ conversations });
    }

    if (
      request.method === "GET" &&
      path.length === 2 &&
      path[0] === "conversations"
    ) {
      const detail = await getAdminConversation(path[1]);
      if (!detail) return fail("not_found", "Conversation not found", 404);
      return ok(detail);
    }

    if (
      request.method === "POST" &&
      path.length === 3 &&
      path[0] === "conversations" &&
      path[2] === "messages"
    ) {
      const body = await readJsonObject(request);
      if (!isRecord(body)) {
        return fail("bad_request", "Expected JSON request body");
      }

      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return fail("bad_request", "Message text is required");

      const message = await createAdminMessage(path[1], text);
      if (!message) return fail("not_found", "Conversation not found", 404);
      return ok({ message }, { status: 201 });
    }

    if (
      request.method === "POST" &&
      path.length === 3 &&
      path[0] === "conversations" &&
      path[2] === "archive-local"
    ) {
      return createArchiveDownloadResponse(request, path[1]);
    }

    if (
      request.method === "POST" &&
      path.length === 3 &&
      path[0] === "conversations" &&
      path[2] === "archive"
    ) {
      const conversation = await archiveAdminConversation(path[1]);
      if (!conversation) {
        return fail("not_found", "Conversation not found", 404);
      }
      return ok({ conversation });
    }

    if (
      request.method === "POST" &&
      path.length === 1 &&
      path[0] === "reset-demo-data"
    ) {
      await resetDemoData();
      return ok({ reset: true });
    }

    return fail("not_found", "Not found", 404);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to handle admin request";
    return fail("internal_error", message, 500);
  }
}

async function proxyAdminRequest(
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
  if (
    request.method === "POST" &&
    path.length === 3 &&
    path[0] === "conversations" &&
    path[2] === "archive-local"
  ) {
    return createArchiveDownloadResponse(request, path[1]);
  }

  if (!process.env.ADMIN_API_BASE_URL) {
    return handleLocalAdminRequest(request, path);
  }

  const targetUrl = new URL(
    `/api/admin/${path.map(encodeURIComponent).join("/")}`,
    getTargetOrigin(request)
  );
  targetUrl.search = new URL(request.url).search;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body,
    cache: "no-store",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type":
        response.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(request: Request, context: AdminPanelProxyContext) {
  return proxyAdminRequest(request, context);
}

export async function POST(request: Request, context: AdminPanelProxyContext) {
  return proxyAdminRequest(request, context);
}
