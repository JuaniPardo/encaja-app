import { describe, expect, it } from "vitest";

import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";
import {
  getAccessTokenFromSessionCookie,
  getSessionTokensFromCookie,
} from "@/lib/supabase/session-cookie";

function buildCookieHeader(value: unknown) {
  return `encaja-locale=es; ${SUPABASE_AUTH_STORAGE_KEY}=${encodeURIComponent(JSON.stringify(value))}`;
}

describe("getSessionTokensFromCookie", () => {
  it("extrae ambos tokens de una cookie codificada", () => {
    const header = buildCookieHeader({ access_token: "access", refresh_token: "refresh" });

    expect(getSessionTokensFromCookie(header)).toEqual({
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("devuelve refreshToken null si la cookie no lo trae", () => {
    const header = buildCookieHeader({ access_token: "access" });

    expect(getSessionTokensFromCookie(header)).toEqual({
      accessToken: "access",
      refreshToken: null,
    });
  });

  it("devuelve null con JSON roto", () => {
    expect(getSessionTokensFromCookie(`${SUPABASE_AUTH_STORAGE_KEY}={roto`)).toBeNull();
  });

  it("devuelve null si la cookie no tiene access token", () => {
    expect(getSessionTokensFromCookie(buildCookieHeader({ refresh_token: "refresh" }))).toBeNull();
  });

  it("devuelve null sin cookie", () => {
    expect(getSessionTokensFromCookie("encaja-locale=es")).toBeNull();
    expect(getSessionTokensFromCookie(null)).toBeNull();
  });
});

describe("getAccessTokenFromSessionCookie", () => {
  it("devuelve el access token de una cookie valida", () => {
    const header = buildCookieHeader({ access_token: "access", refresh_token: "refresh" });

    expect(getAccessTokenFromSessionCookie(header)).toBe("access");
  });

  it("devuelve null sin access token, con JSON roto o sin cookie", () => {
    expect(getAccessTokenFromSessionCookie(buildCookieHeader({ refresh_token: "r" }))).toBeNull();
    expect(getAccessTokenFromSessionCookie(`${SUPABASE_AUTH_STORAGE_KEY}={roto`)).toBeNull();
    expect(getAccessTokenFromSessionCookie(undefined)).toBeNull();
  });
});
