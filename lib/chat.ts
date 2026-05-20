import { getStore, setStore, type Message, type Conversation } from "./store";
import { createId } from "./ids";
import { nowISO } from "./time";

export function createUser(username: string) {
  const id = createId();
  const user = { id, username, createdAt: nowISO() };
  const store = getStore();
  store.users.push(user);
  store.currentUserId = id;
  setStore(store);
  return user;
}

export function createConversation(userId: string): Conversation {
  const conv: Conversation = {
    id: createId(),
    userId,
    title: "新的会话",
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  const store = getStore();
  store.conversations.push(conv);
  setStore(store);
  return conv;
}

export function createMessage(
  conversationId: string,
  sender: "user" | "admin",
  content: string
): Message {
  const msg: Message = {
    id: createId(),
    conversationId,
    sender,
    content,
    createdAt: nowISO(),
  };
  const store = getStore();
  store.messages.push(msg);
  setStore(store);
  return msg;
}

export function getUserConversations(userId: string): Conversation[] {
  const store = getStore();
  return store.conversations
    .filter((c) => c.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export function getConversationMessages(
  conversationId: string
): Message[] {
  const store = getStore();
  return store.messages
    .filter((m) => m.conversationId === conversationId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export function conversationNeedsReply(conversationId: string): boolean {
  const messages = getConversationMessages(conversationId);
  if (messages.length === 0) return false;
  return messages[messages.length - 1].sender === "user";
}

export function makeConversationTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, " ");
  return cleaned.length > 20 ? cleaned.substring(0, 20) + "..." : cleaned;
}
