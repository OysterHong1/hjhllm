import {
  createConversation,
  listUserConversations,
} from "@/lib/server/chat/repository";
import { fail, isRecord, ok, readJsonObject } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) return fail("bad_request", "userId is required");

  try {
    const conversations = await listUserConversations(userId);
    return ok({ conversations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list conversations";
    return fail("internal_error", message, 500);
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!isRecord(body)) {
    return fail("bad_request", "Expected JSON request body");
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  if (!userId) return fail("bad_request", "userId is required");

  try {
    const conversation = await createConversation(userId, title || undefined);
    return ok({ conversation }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create conversation";
    return fail("internal_error", message, 500);
  }
}
