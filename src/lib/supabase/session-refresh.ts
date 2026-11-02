import type { Session } from "@supabase/supabase-js";

import { isDefinitiveAuthRejection } from "@/lib/supabase/auth-errors";
import {
  createSupabaseRefreshClient,
  getSupabaseVerifierClient,
} from "@/lib/supabase/server-verifier";
import type { SessionTokens } from "@/lib/supabase/session-cookie";

export type SessionResolution =
  | { status: "valid" }
  | { status: "renewed"; session: Session }
  | { status: "rejected" }
  | { status: "unverified" };

async function renewSession(refreshToken: string): Promise<SessionResolution> {
  const refreshClient = createSupabaseRefreshClient();

  try {
    const { data, error } = await refreshClient.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (data.session) {
      return { status: "renewed", session: data.session };
    }

    return { status: isDefinitiveAuthRejection(error) ? "rejected" : "unverified" };
  } catch {
    return { status: "unverified" };
  }
}

export async function resolveSessionTokens(tokens: SessionTokens): Promise<SessionResolution> {
  const verifier = getSupabaseVerifierClient();

  try {
    const { data, error } = await verifier.auth.getUser(tokens.accessToken);

    if (!error && data.user) {
      return { status: "valid" };
    }

    if (error && !isDefinitiveAuthRejection(error)) {
      return { status: "unverified" };
    }
  } catch {
    return { status: "unverified" };
  }

  if (!tokens.refreshToken) {
    return { status: "rejected" };
  }

  return renewSession(tokens.refreshToken);
}
