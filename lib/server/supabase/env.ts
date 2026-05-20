type SupabaseServerEnv = {
  url: string;
  serviceRoleKey: string;
};

export function getSupabaseServerEnv(): SupabaseServerEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  if (missing.length > 0 || !url || !serviceRoleKey) {
    throw new Error(`Missing Supabase env: ${missing.join(", ")}`);
  }

  return {
    url,
    serviceRoleKey,
  };
}
