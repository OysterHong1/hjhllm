import type {
  Conversation,
  Message,
  MessageAttachment,
  User,
} from "@/lib/contracts";
import { createId } from "@/lib/ids";
import { createSupabaseServerClient } from "@/lib/server/supabase/client";

type UserRow = {
  id: string;
  username: string;
  created_at: string;
  last_seen_at: string | null;
};

type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  status: "open" | "archived";
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  message_id: string;
  kind: "image" | "audio" | "video";
  storage_path: string;
  url: string;
  mime_type: string;
  size: number;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  thumbnail_url: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender: "user" | "admin" | "assistant";
  text: string;
  created_at: string;
  attachments?: AttachmentRow[];
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAttachment(row: AttachmentRow): MessageAttachment {
  return {
    id: row.id,
    messageId: row.message_id,
    kind: row.kind,
    storagePath: row.storage_path,
    url: row.url,
    mimeType: row.mime_type,
    size: row.size,
    durationMs: row.duration_ms,
    width: row.width,
    height: row.height,
    thumbnailUrl: row.thumbnail_url,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender,
    text: row.text,
    attachments: row.attachments?.map(toAttachment) ?? [],
    createdAt: row.created_at,
  };
}

function makeConversationTitle(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > 20 ? cleaned.substring(0, 20) + "..." : cleaned;
}

export async function createUserSession(username: string): Promise<User> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const id = createId();
  const { data, error } = await supabase
    .from("users")
    .insert({
      id,
      username,
      created_at: now,
      last_seen_at: now,
    })
    .select("id, username, created_at, last_seen_at")
    .single<UserRow>();

  if (error) throw new Error(error.message);
  return toUser(data);
}

export async function getUserSession(userId: string): Promise<User | null> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("users")
    .update({ last_seen_at: now })
    .eq("id", userId)
    .select("id, username, created_at, last_seen_at")
    .maybeSingle<UserRow>();

  if (error) throw new Error(error.message);
  return data ? toUser(data) : null;
}

export async function listUserConversations(
  userId: string
): Promise<Conversation[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, status, created_at, updated_at")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .returns<ConversationRow[]>();

  if (error) throw new Error(error.message);
  return data.map(toConversation);
}

export async function createConversation(
  userId: string,
  title = "新的会话"
): Promise<Conversation> {
  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      id: createId(),
      user_id: userId,
      title,
      status: "open",
      created_at: now,
      updated_at: now,
    })
    .select("id, user_id, title, status, created_at, updated_at")
    .single<ConversationRow>();

  if (error) throw new Error(error.message);
  return toConversation(data);
}

async function verifyConversationOwner(
  conversationId: string,
  userId: string
): Promise<ConversationRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, status, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle<ConversationRow>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listConversationMessages(
  conversationId: string,
  userId: string
): Promise<Message[] | null> {
  const conversation = await verifyConversationOwner(conversationId, userId);
  if (!conversation) return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, sender, text, created_at, attachments(id, message_id, kind, storage_path, url, mime_type, size, duration_ms, width, height, thumbnail_url, created_at)"
    )
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  if (error) throw new Error(error.message);
  return data.map(toMessage);
}

export async function createUserMessage(
  conversationId: string,
  userId: string,
  text: string
): Promise<Message | null> {
  const conversation = await verifyConversationOwner(conversationId, userId);
  if (!conversation) return null;

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id: createId(),
      conversation_id: conversationId,
      sender: "user",
      text,
      created_at: now,
    })
    .select("id, conversation_id, sender, text, created_at")
    .single<MessageRow>();

  if (error) throw new Error(error.message);

  const updates: { updated_at: string; title?: string } = {
    updated_at: now,
  };
  if (conversation.title === "新的会话") {
    updates.title = makeConversationTitle(text);
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", conversationId);

  if (updateError) throw new Error(updateError.message);

  return toMessage(data);
}
