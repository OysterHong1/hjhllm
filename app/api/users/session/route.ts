import {
  createUserSession,
  getUserSession,
} from "@/lib/server/chat/repository";
import { fail, isRecord, ok, readJsonObject } from "@/lib/server/http/responses";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  if (!isRecord(body)) {
    return fail("bad_request", "Expected JSON request body");
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim() : "";

  try {
    if (userId) {
      const user = await getUserSession(userId);
      if (!user) return fail("not_found", "User session not found", 404);
      return ok({ user });
    }

    if (!username) {
      return fail("bad_request", "Username is required");
    }

    const user = await createUserSession(username);
    return ok({ user }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create user session";
    return fail("internal_error", message, 500);
  }
}
