import type {
  AdminConversation,
  ApiFailure,
  ApiResult,
  Conversation,
  Message,
} from "@/lib/contracts";

const ADMIN_PANEL_API_PREFIX = "/api/admin-panel";

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${ADMIN_PANEL_API_PREFIX}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function listAdminConversations(): Promise<AdminConversation[]> {
  const data = await adminRequest<{ conversations: AdminConversation[] }>(
    "/conversations"
  );
  return data.conversations;
}

export async function getAdminConversation(
  conversationId: string
): Promise<{ conversation: AdminConversation; messages: Message[] }> {
  return adminRequest<{ conversation: AdminConversation; messages: Message[] }>(
    `/conversations/${encodeURIComponent(conversationId)}`
  );
}

export async function createAdminMessage(
  conversationId: string,
  text: string
): Promise<Message> {
  const data = await adminRequest<{ message: Message }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    }
  );
  return data.message;
}

export async function archiveAdminConversation(
  conversationId: string
): Promise<Conversation> {
  const data = await adminRequest<{ conversation: Conversation }>(
    `/conversations/${encodeURIComponent(conversationId)}/archive`,
    {
      method: "POST",
    }
  );
  return data.conversation;
}

export type LocalConversationArchive = {
  fileName: string;
  mediaCount: number;
  failedMediaCount: number;
};

function getDownloadFileName(response: Response): string {
  const encodedName = response.headers.get("X-Archive-Filename");
  if (encodedName) return decodeURIComponent(encodedName);

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  return "conversation-archive.zip";
}

export async function archiveAdminConversationLocally(
  conversationId: string
): Promise<LocalConversationArchive> {
  const response = await fetch(
    `${ADMIN_PANEL_API_PREFIX}/conversations/${encodeURIComponent(
      conversationId
    )}/archive-local`,
    { method: "POST" }
  );

  if (!response.ok) {
    const result = (await response.json()) as ApiFailure;
    throw new Error(result.error.message);
  }

  const blob = await response.blob();
  const fileName = getDownloadFileName(response);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return {
    fileName,
    mediaCount: Number(response.headers.get("X-Archive-Media-Count") ?? 0),
    failedMediaCount: Number(
      response.headers.get("X-Archive-Failed-Media-Count") ?? 0
    ),
  };
}

export async function resetDemoData(): Promise<void> {
  await adminRequest<{ reset: true }>("/reset-demo-data", {
    method: "POST",
  });
}

export function getAdminErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const failure = error as Partial<ApiFailure>;
  return failure.error?.message ?? "请求失败";
}
