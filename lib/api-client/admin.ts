import type {
  AdminConversation,
  ApiFailure,
  ApiResult,
  Conversation,
  Message,
} from "@/lib/contracts";

const ADMIN_TOKEN_KEY = "hjhllm.adminToken";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function adminRequest<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export function getStoredAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
}

export function setStoredAdminToken(token: string): void {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearStoredAdminToken(): void {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function listAdminConversations(
  token: string
): Promise<AdminConversation[]> {
  const data = await adminRequest<{ conversations: AdminConversation[] }>(
    token,
    "/api/admin/conversations"
  );
  return data.conversations;
}

export async function getAdminConversation(
  token: string,
  conversationId: string
): Promise<{ conversation: AdminConversation; messages: Message[] }> {
  return adminRequest<{ conversation: AdminConversation; messages: Message[] }>(
    token,
    `/api/admin/conversations/${encodeURIComponent(conversationId)}`
  );
}

export async function createAdminMessage(
  token: string,
  conversationId: string,
  text: string
): Promise<Message> {
  const data = await adminRequest<{ message: Message }>(
    token,
    `/api/admin/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    }
  );
  return data.message;
}

export async function archiveAdminConversation(
  token: string,
  conversationId: string
): Promise<Conversation> {
  const data = await adminRequest<{ conversation: Conversation }>(
    token,
    `/api/admin/conversations/${encodeURIComponent(conversationId)}/archive`,
    {
      method: "POST",
    }
  );
  return data.conversation;
}

export async function resetDemoData(token: string): Promise<void> {
  await adminRequest<{ reset: true }>(token, "/api/admin/reset-demo-data", {
    method: "POST",
  });
}

export function getAdminErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const failure = error as Partial<ApiFailure>;
  return failure.error?.message ?? "请求失败";
}
