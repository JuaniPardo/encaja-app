import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";

interface SessionCookieShape {
  access_token?: string;
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

export function getAccessTokenFromSessionCookie(cookieHeader: string | null | undefined) {
  const raw = readCookie(cookieHeader, SUPABASE_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const decoded = decodeValue(raw);

  try {
    const parsed = JSON.parse(decoded) as SessionCookieShape;
    if (typeof parsed.access_token === "string" && parsed.access_token.length > 0) {
      return parsed.access_token;
    }
  } catch {
    return null;
  }

  return null;
}
