"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import {
  getSupabaseConfig,
  SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS,
  SUPABASE_AUTH_STORAGE_KEY,
} from "@/lib/supabase/config";

interface BrowserStorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function getCookieValue(key: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const chunks = document.cookie.split(";");
  for (const chunk of chunks) {
    const [name, ...valueParts] = chunk.trim().split("=");
    if (name === key) {
      const value = valueParts.join("=");
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

const cookieStorage: BrowserStorageAdapter = {
  getItem(key) {
    return getCookieValue(key);
  },
  setItem(key, value) {
    if (typeof document === "undefined") {
      return;
    }

    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  },
  removeItem(key) {
    if (typeof document === "undefined") {
      return;
    }

    document.cookie = `${key}=; path=/; max-age=0; samesite=lax`;
  },
};

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, key } = getSupabaseConfig();

  browserClient = createClient<Database>(url, key, {
    auth: {
      storageKey: SUPABASE_AUTH_STORAGE_KEY,
      storage: cookieStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

async function trySignOut(scope: "global" | "local") {
  try {
    const { error } = await getSupabaseBrowserClient().auth.signOut({ scope });
    return !error;
  } catch {
    return false;
  }
}

// auth-js conserva la sesión si falla /logout o el refresh previo. Es solo para cuando la persona
// pide salir: ante un fallo de getUser, borrar la cookie cerraría la sesión por un error transitorio.
export async function signOutBrowserSession() {
  if (await trySignOut("global")) {
    return;
  }

  cookieStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);

  // Sin sesión guardada, auth-js omite /logout y solo limpia su estado y emite SIGNED_OUT.
  if (!(await trySignOut("local"))) {
    cookieStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
  }
}
