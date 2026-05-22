import type { ApiErrorCode, ApiFailure } from "@/lib/contracts";

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
