import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

if (!adminToken) {
  throw new Error("ADMIN_API_TOKEN is required for admin API smoke tests");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
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

const runId = Date.now().toString(36);
const username = `smoke-admin-${runId}`;
const userText = `smoke user message ${runId}`;
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
console.log("✓ admin detail includes user message");

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
assert(
  userMessages.some(
    (message) => message.sender === "admin" && message.text === adminText
  ),
  "User messages endpoint did not include admin reply"
);
console.log("✓ user API can read admin reply");

await api(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/archive`, {
  method: "POST",
  headers: adminHeaders(),
});
console.log("✓ archived temporary conversation");

console.log("Admin API smoke test passed");
