import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@/lib/contracts";

export function ok<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return Response.json(body, init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  status = 400
): Response {
  const body: ApiFailure = {
    ok: false,
    error: {
      code,
      message,
    },
  };
  return Response.json(body, { status });
}

export async function readJsonObject(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
