import type {
  AdminConversation,
  AttachmentKind,
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

type CreateAttachmentFileInput = {
  file: Blob;
  fileName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  durationMs?: number | null;
};

type CreateAttachmentMessageInput = {
  conversationId: string;
  userId: string;
  text: string;
  files: CreateAttachmentFileInput[];
};

const ATTACHMENT_BUCKET = "message-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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

async function signMessageAttachmentUrls(messages: Message[]): Promise<Message[]> {
  const attachments = messages.flatMap((message) => message.attachments);
  if (attachments.length === 0) return messages;

  const supabase = createSupabaseServerClient();
  const signedUrls = new Map<string, string>();

  await Promise.all(
    attachments.map(async (attachment) => {
      const { data, error } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS);

      if (!error && data?.signedUrl) {
        signedUrls.set(attachment.storagePath, data.signedUrl);
      }
    })
  );

  return messages.map((message) => ({
    ...message,
    attachments: message.attachments.map((attachment) => ({
      ...attachment,
      url: signedUrls.get(attachment.storagePath) ?? attachment.url,
    })),
  }));
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
  return signMessageAttachmentUrls(data.map(toMessage));
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

  return signMessageAttachmentUrls([toMessage(data)]).then(
    (messages) => messages[0]
  );
}

function makeStoragePath(input: {
  userId: string;
  conversationId: string;
  fileName: string;
}): string {
  const extension = input.fileName.split(".").pop()?.toLowerCase();
  const safeExtension = extension?.match(/^[a-z0-9]{1,12}$/)
    ? `.${extension}`
    : "";

  return [
    input.userId,
    input.conversationId,
    `${createId()}${safeExtension}`,
  ].join("/");
}

export async function createUserAttachmentMessage(
  input: CreateAttachmentMessageInput
): Promise<Message | null> {
  const conversation = await verifyConversationOwner(
    input.conversationId,
    input.userId
  );
  if (!conversation) return null;

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const messageId = createId();
  const uploadedFiles: Array<CreateAttachmentFileInput & {
    attachmentId: string;
    storagePath: string;
    signedUrl: string;
  }> = [];

  for (const file of input.files) {
    const storagePath = makeStoragePath({
      userId: input.userId,
      conversationId: input.conversationId,
      fileName: file.fileName,
    });

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, file.file, {
        contentType: file.mimeType,
        upsert: false,
      });

    if (uploadError) {
      await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(uploadedFiles.map((uploaded) => uploaded.storagePath));
      throw new Error(uploadError.message);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedError) {
      await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([
          ...uploadedFiles.map((uploaded) => uploaded.storagePath),
          storagePath,
        ]);
      throw new Error(signedError.message);
    }

    uploadedFiles.push({
      ...file,
      attachmentId: createId(),
      storagePath,
      signedUrl: signedData.signedUrl,
    });
  }

  const { data: messageData, error: messageError } = await supabase
    .from("messages")
    .insert({
      id: messageId,
      conversation_id: input.conversationId,
      sender: "user",
      text: input.text,
      created_at: now,
    })
    .select("id, conversation_id, sender, text, created_at")
    .single<MessageRow>();

  if (messageError) {
    await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove(uploadedFiles.map((file) => file.storagePath));
    throw new Error(messageError.message);
  }

  const { data: attachmentData, error: attachmentError } = await supabase
    .from("attachments")
    .insert(
      uploadedFiles.map((file) => ({
        id: file.attachmentId,
        message_id: messageId,
        kind: file.kind,
        storage_path: file.storagePath,
        url: file.signedUrl,
        mime_type: file.mimeType,
        size: file.size,
        duration_ms: file.durationMs ?? null,
        created_at: now,
      }))
    )
    .select(
      "id, message_id, kind, storage_path, url, mime_type, size, duration_ms, width, height, thumbnail_url, created_at"
    )
    .returns<AttachmentRow[]>();

  if (attachmentError) {
    await Promise.all([
      supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(uploadedFiles.map((file) => file.storagePath)),
      supabase.from("messages").delete().eq("id", messageId),
    ]);
    throw new Error(attachmentError.message);
  }

  const updates: { updated_at: string; title?: string } = {
    updated_at: now,
  };
  if (conversation.title === "新的会话") {
    updates.title = makeConversationTitle(
      input.text || input.files[0]?.fileName || "图片消息"
    );
  }

  const { error: updateError } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", input.conversationId);

  if (updateError) throw new Error(updateError.message);

  return toMessage({
    ...messageData,
    attachments: attachmentData,
  });
}

async function getUsersById(userIds: string[]): Promise<Map<string, User>> {
  const uniqueIds = [...new Set(userIds)];
  const users = new Map<string, User>();
  if (uniqueIds.length === 0) return users;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, username, created_at, last_seen_at")
    .in("id", uniqueIds)
    .returns<UserRow[]>();

  if (error) throw new Error(error.message);
  for (const row of data) users.set(row.id, toUser(row));
  return users;
}

async function getLastSenderByConversationId(
  conversationIds: string[]
): Promise<Map<string, MessageRow["sender"]>> {
  const uniqueIds = [...new Set(conversationIds)];
  const lastSenders = new Map<string, MessageRow["sender"]>();
  if (uniqueIds.length === 0) return lastSenders;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id, sender, created_at")
    .in("conversation_id", uniqueIds)
    .order("created_at", { ascending: false })
    .returns<Pick<MessageRow, "conversation_id" | "sender" | "created_at">[]>();

  if (error) throw new Error(error.message);
  for (const row of data) {
    if (!lastSenders.has(row.conversation_id)) {
      lastSenders.set(row.conversation_id, row.sender);
    }
  }
  return lastSenders;
}

function toAdminConversation(
  row: ConversationRow,
  users: Map<string, User>,
  lastSenders: Map<string, MessageRow["sender"]>
): AdminConversation {
  return {
    ...toConversation(row),
    user: users.get(row.user_id) ?? null,
    needsReply: lastSenders.get(row.id) === "user",
  };
}

export async function listAdminConversations(): Promise<AdminConversation[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, status, created_at, updated_at")
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .returns<ConversationRow[]>();

  if (error) throw new Error(error.message);

  const [users, lastSenders] = await Promise.all([
    getUsersById(data.map((row) => row.user_id)),
    getLastSenderByConversationId(data.map((row) => row.id)),
  ]);

  return data
    .map((row) => toAdminConversation(row, users, lastSenders))
    .sort((a, b) => {
      if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
}

export async function getAdminConversation(
  conversationId: string
): Promise<{
  conversation: AdminConversation;
  messages: Message[];
} | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, title, status, created_at, updated_at")
    .eq("id", conversationId)
    .maybeSingle<ConversationRow>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [users, lastSenders, messages] = await Promise.all([
    getUsersById([data.user_id]),
    getLastSenderByConversationId([data.id]),
    listAdminMessages(data.id),
  ]);

  return {
    conversation: toAdminConversation(data, users, lastSenders),
    messages,
  };
}

async function listAdminMessages(conversationId: string): Promise<Message[]> {
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
  return signMessageAttachmentUrls(data.map(toMessage));
}

export async function createAdminMessage(
  conversationId: string,
  text: string
): Promise<Message | null> {
  const conversation = await getAdminConversation(conversationId);
  if (!conversation) return null;

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id: createId(),
      conversation_id: conversationId,
      sender: "admin",
      text,
      created_at: now,
    })
    .select("id, conversation_id, sender, text, created_at")
    .single<MessageRow>();

  if (error) throw new Error(error.message);

  const { error: updateError } = await supabase
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversationId);

  if (updateError) throw new Error(updateError.message);
  return signMessageAttachmentUrls([toMessage(data)]).then(
    (messages) => messages[0]
  );
}

export async function archiveAdminConversation(
  conversationId: string
): Promise<Conversation | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .select("id, user_id, title, status, created_at, updated_at")
    .maybeSingle<ConversationRow>();

  if (error) throw new Error(error.message);
  return data ? toConversation(data) : null;
}

export async function resetDemoData(): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("users").delete().neq("id", "");
  if (error) throw new Error(error.message);
}
