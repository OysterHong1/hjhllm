import type {
  ApiFailure,
  ApiResult,
  Conversation,
  Message,
  User,
} from "@/lib/contracts";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
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

export async function createUserSession(username: string): Promise<User> {
  const data = await request<{ user: User }>("/api/users/session", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  return data.user;
}

export async function restoreUserSession(userId: string): Promise<User> {
  const data = await request<{ user: User }>("/api/users/session", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  return data.user;
}

export async function restoreCurrentUserSession(): Promise<User> {
  const data = await request<{ user: User }>("/api/users/session", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data.user;
}

export async function logoutUserSession(): Promise<void> {
  await request<{ deleted: boolean }>("/api/users/session", {
    method: "DELETE",
  });
}

export async function listConversations(
  userId: string
): Promise<Conversation[]> {
  const data = await request<{ conversations: Conversation[] }>(
    `/api/conversations?userId=${encodeURIComponent(userId)}`
  );
  return data.conversations;
}

export async function createConversation(
  userId: string
): Promise<Conversation> {
  const data = await request<{ conversation: Conversation }>(
    "/api/conversations",
    {
      method: "POST",
      body: JSON.stringify({ userId }),
    }
  );
  return data.conversation;
}

export async function listMessages(
  conversationId: string,
  userId: string
): Promise<Message[]> {
  const data = await request<{ messages: Message[] }>(
    `/api/conversations/${encodeURIComponent(
      conversationId
    )}/messages?userId=${encodeURIComponent(userId)}`
  );
  return data.messages;
}

export async function createMessage(
  conversationId: string,
  userId: string,
  text: string
): Promise<Message> {
  const data = await request<{ message: Message }>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ userId, text }),
    }
  );
  return data.message;
}

export async function createAttachmentMessage(input: {
  conversationId: string;
  userId: string;
  files: File[];
  text?: string;
  durationMs?: number;
}): Promise<Message> {
  const formData = new FormData();
  formData.set("conversationId", input.conversationId);
  formData.set("userId", input.userId);
  for (const file of input.files) {
    formData.append("files", file);
  }
  if (input.text) formData.set("text", input.text);
  if (typeof input.durationMs === "number") {
    formData.set("durationMs", String(input.durationMs));
  }

  const response = await fetch("/api/attachments", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });

  const result = (await response.json()) as ApiResult<{ message: Message }>;
  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.data.message;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const failure = error as Partial<ApiFailure>;
  return failure.error?.message ?? "请求失败";
}
