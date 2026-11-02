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

// No reutiliza el singleton: `_callRefreshToken` comparte `refreshingDeferred` por cliente,
// así que dos usuarios concurrentes podrían recibir la misma sesión.
export function createSupabaseRefreshClient() {
  const { url, key } = getSupabaseConfig();

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
