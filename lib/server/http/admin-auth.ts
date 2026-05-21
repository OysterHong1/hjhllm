import { fail } from "@/lib/server/http/responses";

export function requireAdmin(request: Request): Response | null {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken) {
    return fail("internal_error", "ADMIN_API_TOKEN is not configured", 500);
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token || token !== expectedToken) {
    return fail("unauthorized", "Invalid admin token", 401);
  }

  return null;
}
