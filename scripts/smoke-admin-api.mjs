import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;

    const rawValue = valueParts.join("=").trim();
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const baseUrl = (
  process.argv[2] ||
  process.env.SMOKE_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const adminToken = process.env.ADMIN_API_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!adminToken) {
  throw new Error("ADMIN_API_TOKEN is required for admin API smoke tests");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const headers = {
    ...init.headers,
  };
  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  return {
    response,
    body,
  };
}

async function api(path, init = {}) {
  const { response, body } = await request(path, init);
  assert(body?.ok, `${init.method ?? "GET"} ${path} failed: ${textOf(body)}`);
  return {
    status: response.status,
    data: body.data,
  };
}

function adminHeaders() {
  return {
    Authorization: `Bearer ${adminToken}`,
  };
}

function textOf(body) {
  return body?.error?.message ?? JSON.stringify(body);
}

async function cleanupSmokeData(userId, storagePaths) {
  if (!supabaseUrl || !serviceRoleKey) {
    console.log("Skipped direct Supabase cleanup: service env is missing");
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (storagePaths.length > 0) {
    const { error } = await supabase.storage
      .from("message-attachments")
      .remove(storagePaths);
    if (error) throw new Error(`Storage cleanup failed: ${error.message}`);
  }

  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw new Error(`User cleanup failed: ${error.message}`);
}

const runId = Date.now().toString(36);
const username = `smoke-admin-${runId}`;
const userText = `smoke user message ${runId}`;
const attachmentText = `smoke attachment message ${runId}`;
const audioText = `smoke audio message ${runId}`;
const adminText = `smoke admin reply ${runId}`;

console.log(`Admin smoke target: ${baseUrl}`);

const unauthorized = await request("/api/admin/conversations");
assert(
  unauthorized.response.status === 401 && unauthorized.body?.ok === false,
  "Admin conversations endpoint should reject missing token"
);
console.log("✓ admin API rejects missing token");

const {
  data: { user },
} = await api("/api/users/session", {
  method: "POST",
  body: JSON.stringify({ username }),
});
assert(user?.id, "User session did not return a user id");
console.log("✓ created temporary user session");

const {
  data: { conversation },
} = await api("/api/conversations", {
  method: "POST",
  body: JSON.stringify({ userId: user.id }),
});
assert(conversation?.id, "Conversation API did not return an id");
console.log("✓ created temporary conversation");

await api(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`, {
  method: "POST",
  body: JSON.stringify({ userId: user.id, text: userText }),
});
console.log("✓ created user message");

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const attachmentForm = new FormData();
attachmentForm.set("userId", user.id);
attachmentForm.set("conversationId", conversation.id);
attachmentForm.set("text", attachmentText);
attachmentForm.append(
  "files",
  new Blob([pngBytes], { type: "image/png" }),
  `smoke-${runId}-1.png`
);
attachmentForm.append(
  "files",
  new Blob([pngBytes], { type: "image/png" }),
  `smoke-${runId}-2.png`
);

const {
  data: { message: attachmentMessage },
} = await api("/api/attachments", {
  method: "POST",
  body: attachmentForm,
});
assert(
  attachmentMessage.attachments?.length === 2 &&
    attachmentMessage.attachments.every((attachment) => attachment.kind === "image"),
  "Attachment upload did not return two image metadata entries"
);
assert(
  attachmentMessage.attachments.every((attachment) =>
    attachment.url.startsWith("http")
  ),
  "Attachment upload did not return a signed URL"
);
console.log("✓ uploaded multi-image attachment message");

const audioForm = new FormData();
audioForm.set("userId", user.id);
audioForm.set("conversationId", conversation.id);
audioForm.set("text", audioText);
audioForm.set("durationMs", "1200");
audioForm.append(
  "files",
  new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], {
    type: "audio/webm",
  }),
  `smoke-${runId}.webm`
);

const {
  data: { message: audioMessage },
} = await api("/api/attachments", {
  method: "POST",
  body: audioForm,
});
assert(
  audioMessage.attachments?.length === 1 &&
    audioMessage.attachments[0].kind === "audio" &&
    audioMessage.attachments[0].durationMs === 1200,
  "Audio upload did not return audio metadata"
);
assert(
  audioMessage.attachments[0].url.startsWith("http"),
  "Audio upload did not return a signed URL"
);
console.log("✓ uploaded audio attachment message");

const {
  data: { conversations },
} = await api("/api/admin/conversations", {
  headers: adminHeaders(),
});
const adminConversation = conversations.find(
  (item) => item.id === conversation.id
);
assert(adminConversation, "Admin conversation list did not include smoke chat");
assert(adminConversation.needsReply, "Smoke chat should be marked needsReply");
console.log("✓ admin list includes pending conversation");

const {
  data: { messages: beforeReplyMessages },
} = await api(`/api/admin/conversations/${encodeURIComponent(conversation.id)}`, {
  headers: adminHeaders(),
});
assert(
  beforeReplyMessages.some((message) => message.text === userText),
  "Admin detail did not include user message"
);
assert(
  beforeReplyMessages.some(
    (message) =>
      message.text === attachmentText &&
      message.attachments.length === 2 &&
      message.attachments.every(
        (attachment) =>
          attachment.mimeType === "image/png" && attachment.url.startsWith("http")
      )
  ),
  "Admin detail did not include uploaded image attachments"
);
assert(
  beforeReplyMessages.some(
    (message) =>
      message.text === audioText &&
      message.attachments.length === 1 &&
      message.attachments[0].kind === "audio" &&
      message.attachments[0].url.startsWith("http")
  ),
  "Admin detail did not include uploaded audio attachment"
);
console.log("✓ admin detail includes user and attachment messages");

await api(
  `/api/admin/conversations/${encodeURIComponent(conversation.id)}/messages`,
  {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ text: adminText }),
  }
);
console.log("✓ admin reply created");

const {
  data: { messages: userMessages },
} = await api(
  `/api/conversations/${encodeURIComponent(
    conversation.id
  )}/messages?userId=${encodeURIComponent(user.id)}`
);
const storagePaths = userMessages.flatMap((message) =>
  message.attachments.map((attachment) => attachment.storagePath)
);
assert(
  userMessages.some(
    (message) => message.sender === "admin" && message.text === adminText
  ),
  "User messages endpoint did not include admin reply"
);
assert(
  userMessages.some(
    (message) =>
      message.text === attachmentText &&
      message.attachments.length === 2 &&
      message.attachments.every(
        (attachment) => attachment.storagePath && attachment.url.startsWith("http")
      )
  ),
  "User messages endpoint did not include uploaded attachments"
);
assert(
  userMessages.some(
    (message) =>
      message.text === audioText &&
      message.attachments.length === 1 &&
      message.attachments[0].kind === "audio" &&
      message.attachments[0].durationMs === 1200 &&
      message.attachments[0].url.startsWith("http")
  ),
  "User messages endpoint did not include uploaded audio"
);
console.log("✓ user API can read admin reply");

await api(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/archive`, {
  method: "POST",
  headers: adminHeaders(),
});
console.log("✓ archived temporary conversation");

await cleanupSmokeData(user.id, storagePaths);
console.log("✓ cleaned temporary smoke data");

console.log("Admin API smoke test passed");
