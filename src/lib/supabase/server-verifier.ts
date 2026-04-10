import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

let verifierClient: SupabaseClient<Database> | undefined;

export function getSupabaseVerifierClient() {
  if (verifierClient) {
    return verifierClient;
  }

  const { url, key } = getSupabaseConfig();

  verifierClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return verifierClient;
}
