import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";

const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();
const cookies = new Map<string, string>();

function stubDocumentCookies() {
  vi.stubGlobal("document", {
    get cookie() {
      return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(entry: string) {
      const [pair, ...attributes] = entry.split("; ");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);

      if (attributes.includes("max-age=0")) {
        cookies.delete(name);
      } else {
        cookies.set(name, pair.slice(separator + 1));
      }
    },
  });
}

function storeSession(expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  const session = {
    access_token: "access",
    refresh_token: "refresh",
    expires_at: expiresAt,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-1" },
  };

  cookies.set(SUPABASE_AUTH_STORAGE_KEY, encodeURIComponent(JSON.stringify(session)));
}

function authResponse(status: number, errorCode: string) {
  return new Response(JSON.stringify({ code: status, error_code: errorCode, msg: "failed" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function callsTo(path: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(path));
}

async function loadBrowserClient() {
  const { getSupabaseBrowserClient, signOutBrowserSession } = await import(
    "@/lib/supabase/browser-client"
  );
  const signedOut = vi.fn();
  getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      signedOut();
    }
  });

  return { client: getSupabaseBrowserClient(), signOutBrowserSession, signedOut };
}

describe("signOutBrowserSession", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockReset();
    cookies.clear();
    cookies.set("encaja-locale", "es");
    storeSession();
    stubDocumentCookies();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://encaja.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    ["500", () => authResponse(500, "unexpected_failure")],
    ["429", () => authResponse(429, "over_request_rate_limit")],
    ["503", () => authResponse(503, "service_unavailable")],
  ])("borra la sesión local si /logout responde %s", async (_label, failure) => {
    fetchMock.mockImplementation(async () => failure());
    const { client, signOutBrowserSession, signedOut } = await loadBrowserClient();

    await signOutBrowserSession();

    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(false);
    expect(cookies.get("encaja-locale")).toBe("es");
    expect(signedOut).toHaveBeenCalled();
    expect(callsTo("/logout")).toHaveLength(1);
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it("borra la sesión local si /logout falla por red", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { signOutBrowserSession, signedOut } = await loadBrowserClient();

    await signOutBrowserSession();

    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(false);
    expect(signedOut).toHaveBeenCalled();
    expect(callsTo("/logout")).toHaveLength(1);
  });

  it("borra la sesión local si falla el refresh previo a /logout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    storeSession(Math.floor(Date.now() / 1000) - 60);
    fetchMock.mockImplementation(async () => authResponse(503, "service_unavailable"));
    const { signOutBrowserSession, signedOut } = await loadBrowserClient();

    let isFinished = false;
    const pendingSignOut = signOutBrowserSession().finally(() => {
      isFinished = true;
    });
    while (!isFinished) {
      await vi.advanceTimersByTimeAsync(1_000);
    }
    await pendingSignOut;

    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(false);
    expect(signedOut).toHaveBeenCalled();
    expect(callsTo("/token").length).toBeGreaterThan(0);
    expect(callsTo("/logout")).toHaveLength(0);
  });

  it("borra la sesión local si signOut lanza una excepción", async () => {
    const { client, signOutBrowserSession } = await loadBrowserClient();
    const signOut = vi.spyOn(client.auth, "signOut");
    signOut.mockRejectedValue(new Error("lock timeout"));

    await expect(signOutBrowserSession()).resolves.toBeUndefined();

    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(false);
  });

  it("vuelve a borrar si otra renovación reescribe la cookie durante la limpieza", async () => {
    const { client, signOutBrowserSession } = await loadBrowserClient();
    const error = new AuthApiError("failed", 500, "unexpected_failure");
    const signOut = vi.spyOn(client.auth, "signOut");
    signOut.mockResolvedValueOnce({ error });
    signOut.mockImplementationOnce(async () => {
      storeSession();
      return { error };
    });

    await signOutBrowserSession();

    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(false);
  });

  it("intenta cerrar la sesión en el servidor y no repite /logout si responde bien", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));
    const { signOutBrowserSession, signedOut } = await loadBrowserClient();

    await signOutBrowserSession();

    expect(callsTo("/logout")).toHaveLength(1);
    expect(callsTo("/logout")[0][0]).toContain("scope=global");
    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(false);
    expect(signedOut).toHaveBeenCalledOnce();
  });

  it("no toca la cookie si /logout falla y se usa auth-js directo", async () => {
    fetchMock.mockImplementation(async () => authResponse(503, "service_unavailable"));
    const { client } = await loadBrowserClient();

    const { error } = await client.auth.signOut();

    expect(error).toBeInstanceOf(AuthRetryableFetchError);
    expect(cookies.has(SUPABASE_AUTH_STORAGE_KEY)).toBe(true);
  });
});
