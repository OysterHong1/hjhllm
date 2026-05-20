import { createClient } from "@supabase/supabase-js";
import { getSupabaseServerEnv } from "./env";

export function createSupabaseServerClient() {
  const { url, serviceRoleKey } = getSupabaseServerEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
