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

export type MessageStreamEvent =
  | { type: "message"; message: Message }
  | { type: "delta"; text: string }
  | { type: "done"; message: Message | null }
  | { type: "error"; message: string };

function parseSseEvent(raw: string): MessageStreamEvent | null {
  const lines = raw.split(/\r?\n/);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());
  if (!eventLine || dataLines.length === 0) return null;

  const event = eventLine.slice("event:".length).trim();
  const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
  if (event === "message") {
    return { type: "message", message: data.message as Message };
  }
  if (event === "delta") {
    return { type: "delta", text: String(data.text ?? "") };
  }
  if (event === "done") {
    return { type: "done", message: (data.message as Message | null) ?? null };
  }
  if (event === "error") {
    return { type: "error", message: String(data.message ?? "请求失败") };
  }
  return null;
}

export async function createMessageStream(
  conversationId: string,
  userId: string,
  text: string,
  onEvent: (event: MessageStreamEvent) => void
): Promise<void> {
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages/stream`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, text }),
    }
  );

  if (!response.ok || !response.body) {
    const result = (await response.json()) as ApiResult<unknown>;
    if (!result.ok) throw new Error(result.error.message);
    throw new Error("请求失败");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseSseEvent(part);
      if (!event) continue;
      onEvent(event);
      if (event.type === "error") throw new Error(event.message);
    }

    if (done) break;
  }

  const finalEvent = parseSseEvent(buffer.trim());
  if (finalEvent) {
    onEvent(finalEvent);
    if (finalEvent.type === "error") throw new Error(finalEvent.message);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const failure = error as Partial<ApiFailure>;
  return failure.error?.message ?? "请求失败";
}
