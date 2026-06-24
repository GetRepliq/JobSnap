import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let supabaseClient;

export function createClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  supabaseClient = createSupabaseClient(url, anonKey);
  return supabaseClient;
}
