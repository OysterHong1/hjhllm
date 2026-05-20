import { checkSupabaseHealth } from "@/lib/server/supabase/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await checkSupabaseHealth();
    return Response.json({ ok: true, data: health });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reach Supabase";

    return Response.json(
      {
        ok: false,
        error: {
          code: "supabase_unavailable",
          message,
        },
      },
      { status: 503 }
    );
  }
}
