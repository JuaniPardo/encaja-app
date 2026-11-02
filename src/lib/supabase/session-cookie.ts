import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";

interface SessionCookieShape {
  access_token?: string;
  refresh_token?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string | null;
}

function readCookie(cookieHeader: string | null | undefined, key: string) {
  if (!cookieHeader) {
    return null;
  }

  const chunks = cookieHeader.split(";");
  for (const chunk of chunks) {
    const [name, ...valueParts] = chunk.trim().split("=");
    if (name === key) {
      return valueParts.join("=");
    }
  }

  return null;
}

function decodeValue(rawValue: string) {
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function getSessionTokensFromCookie(
  cookieHeader: string | null | undefined,
): SessionTokens | null {
  const raw = readCookie(cookieHeader, SUPABASE_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const decoded = decodeValue(raw);

  try {
    const parsed = JSON.parse(decoded) as SessionCookieShape;
    if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
      const refreshToken =
        typeof parsed.refresh_token === "string" && parsed.refresh_token.length > 0
          ? parsed.refresh_token
          : null;

      return { accessToken: parsed.access_token, refreshToken };
    }
  } catch {
    return null;
  }

  return null;
}

export function getAccessTokenFromSessionCookie(cookieHeader: string | null | undefined) {
  return getSessionTokensFromCookie(cookieHeader)?.accessToken ?? null;
}
