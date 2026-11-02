import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type Session,
} from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";
import { getAccessTokenFromSessionCookie } from "@/lib/supabase/session-cookie";
import { proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server-verifier", () => ({
  getSupabaseVerifierClient: () => ({ auth: { getUser: mocks.getUser } }),
  createSupabaseRefreshClient: () => ({ auth: { refreshSession: mocks.refreshSession } }),
}));

const renewedSession = {
  access_token: "new-access",
  refresh_token: "new-refresh",
  expires_at: 1_900_000_000,
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "user-1", user_metadata: { full_name: "Ana; Díaz=1" } },
} as unknown as Session;

const protectedPath = "/app/x";
const publicPath = "/precios";

function buildRequest(pathname: string) {
  const session = encodeURIComponent(
    JSON.stringify({ access_token: "old-access", refresh_token: "old-refresh" }),
  );

  return new NextRequest(`https://encaja.test${pathname}`, {
    headers: { cookie: `encaja-locale=en; ${SUPABASE_AUTH_STORAGE_KEY}=${session}; otra=1` },
  });
}

function rejectAccessToken() {
  mocks.getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthApiError("expired", 403, "bad_jwt"),
  });
}

function acceptRefresh() {
  mocks.refreshSession.mockResolvedValue({
    data: { session: renewedSession, user: renewedSession.user },
    error: null,
  });
}

function failRefresh(error: unknown) {
  mocks.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error });
}

function authSetCookie(response: NextResponse) {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SUPABASE_AUTH_STORAGE_KEY}=`));
}

function expectPassThroughWithoutCookies(response: NextResponse) {
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(response.headers.get("x-middleware-set-cookie")).toBeNull();
}

function expectRedirect(response: NextResponse, pathname: string) {
  expect(response.headers.get("x-middleware-next")).toBeNull();
  expect(new URL(response.headers.get("location") ?? "").pathname).toBe(pathname);
}

function expectAuthCookieCleared(response: NextResponse) {
  expect(authSetCookie(response)).toMatch(/Max-Age=0/i);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("proxy con sesion renovada", () => {
  beforeEach(() => {
    rejectAccessToken();
    acceptRefresh();
  });

  it.each([protectedPath, publicPath])(
    "deja pasar %s y escribe la sesion nueva en la respuesta",
    async (pathname) => {
      const response = await proxy(buildRequest(pathname));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
      expect(authSetCookie(response)).toContain(encodeURIComponent(JSON.stringify(renewedSession)));
      expect(response.headers.get("x-middleware-set-cookie")).toContain(
        encodeURIComponent("new-access"),
      );
    },
  );

  it("reenvia al render la sesion nueva sin perder otras cookies ni el pathname", async () => {
    const response = await proxy(buildRequest(protectedPath));

    const forwardedCookie = response.headers.get("x-middleware-request-cookie");

    expect(response.headers.get("x-middleware-override-headers")).toContain("cookie");
    expect(getAccessTokenFromSessionCookie(forwardedCookie)).toBe("new-access");
    expect(forwardedCookie).toContain("encaja-locale=en");
    expect(forwardedCookie).toContain("otra=1");
    expect(response.headers.get("x-middleware-request-x-encaja-pathname")).toBe(protectedPath);
  });

  it.each(["/", "/login", "/register"])(
    "redirige %s a /app llevando la sesion nueva",
    async (pathname) => {
      const response = await proxy(buildRequest(pathname));

      expectRedirect(response, "/app");
      expect(authSetCookie(response)).toContain(encodeURIComponent("new-access"));
    },
  );

  it("escribe la cookie con los mismos atributos que browser-client", async () => {
    const response = await proxy(buildRequest(protectedPath));

    const [nameAndValue, ...attributes] = (authSetCookie(response) ?? "").split("; ");
    const value = nameAndValue.slice(`${SUPABASE_AUTH_STORAGE_KEY}=`.length);
    const attributeNames = attributes.map((attribute) => attribute.split("=")[0].toLowerCase());

    expect(decodeURIComponent(value)).toBe(JSON.stringify(renewedSession));
    expect(attributes).toContain("Path=/");
    expect(attributes).toContain("Max-Age=31536000");
    expect(attributes.map((attribute) => attribute.toLowerCase())).toContain("samesite=lax");
    expect(attributeNames).not.toContain("httponly");
    expect(attributeNames).not.toContain("secure");
  });
});

describe("proxy con rechazo definitivo de ambos tokens", () => {
  beforeEach(() => {
    rejectAccessToken();
    failRefresh(new AuthApiError("not found", 400, "refresh_token_not_found"));
  });

  it.each([protectedPath, "/"])("redirige %s a /login y borra la cookie", async (pathname) => {
    const response = await proxy(buildRequest(pathname));

    expectRedirect(response, "/login");
    expectAuthCookieCleared(response);
  });

  it("sigue en /login y borra la cookie", async () => {
    const response = await proxy(buildRequest("/login"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expectAuthCookieCleared(response);
  });

  it("sigue en una ruta publica sin tocar la cookie", async () => {
    expectPassThroughWithoutCookies(await proxy(buildRequest(publicPath)));
  });

  it("trata session_not_found como rechazo definitivo y no como fallo transitorio", async () => {
    failRefresh(new AuthSessionMissingError());

    const response = await proxy(buildRequest(protectedPath));

    expectRedirect(response, "/login");
    expectAuthCookieCleared(response);
  });
});

describe("proxy con fallos transitorios", () => {
  const paths = [protectedPath, "/", "/login", publicPath];

  describe.each(paths)("en %s", (pathname) => {
    it.each([
      ["red", new AuthRetryableFetchError("network", 0)],
      ["5xx", new AuthApiError("server", 500, "unexpected_failure")],
      ["408", new AuthApiError("timeout", 408, "request_timeout")],
      ["429", new AuthApiError("rate limit", 429, "over_request_rate_limit")],
    ])("deja pasar sin tocar cookies si getUser falla por %s", async (_label, error) => {
      mocks.getUser.mockResolvedValue({ data: { user: null }, error });

      expectPassThroughWithoutCookies(await proxy(buildRequest(pathname)));
      expect(mocks.refreshSession).not.toHaveBeenCalled();
    });

    it("deja pasar sin tocar cookies si getUser lanza", async () => {
      mocks.getUser.mockRejectedValue(new TypeError("fetch failed"));

      expectPassThroughWithoutCookies(await proxy(buildRequest(pathname)));
    });

    it("deja pasar sin tocar cookies si refreshSession falla de forma transitoria", async () => {
      rejectAccessToken();
      failRefresh(new AuthRetryableFetchError("network", 503));

      expectPassThroughWithoutCookies(await proxy(buildRequest(pathname)));
    });

    it("deja pasar sin tocar cookies si refreshSession lanza", async () => {
      rejectAccessToken();
      mocks.refreshSession.mockRejectedValue(new TypeError("fetch failed"));

      expectPassThroughWithoutCookies(await proxy(buildRequest(pathname)));
    });

    it("no pisa la cookie del ganador con refresh_token_already_used", async () => {
      rejectAccessToken();
      failRefresh(new AuthApiError("reused", 400, "refresh_token_already_used"));

      expectPassThroughWithoutCookies(await proxy(buildRequest(pathname)));
    });
  });

  it("conserva el pathname y la cookie original en el pedido reenviado", async () => {
    mocks.getUser.mockRejectedValue(new TypeError("fetch failed"));

    const response = await proxy(buildRequest(protectedPath));

    expect(response.headers.get("x-middleware-request-x-encaja-pathname")).toBe(protectedPath);
    expect(getAccessTokenFromSessionCookie(response.headers.get("x-middleware-request-cookie"))).toBe(
      "old-access",
    );
  });
});

describe("proxy con sesion valida", () => {
  beforeEach(() => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it.each([protectedPath, publicPath])("deja pasar %s sin renovar", async (pathname) => {
    expectPassThroughWithoutCookies(await proxy(buildRequest(pathname)));
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it.each(["/", "/login"])("redirige %s a /app", async (pathname) => {
    const response = await proxy(buildRequest(pathname));

    expectRedirect(response, "/app");
    expect(authSetCookie(response)).toBeUndefined();
  });
});

describe("proxy sin cookie de sesion", () => {
  it("redirige las rutas protegidas a /login sin consultar a auth", async () => {
    const response = await proxy(new NextRequest(`https://encaja.test${protectedPath}`));

    expectRedirect(response, "/login");
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
