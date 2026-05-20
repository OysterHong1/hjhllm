import type { HealthCheck } from "@/lib/contracts";
import { createSupabaseServerClient } from "./client";

export async function checkSupabaseHealth(): Promise<HealthCheck> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("users").select("id", { count: "exact", head: true });

  if (error) {
    throw new Error(error.message);
  }

  return {
    service: "hjhllm",
    supabase: "ok",
    checkedAt: new Date().toISOString(),
  };
}
