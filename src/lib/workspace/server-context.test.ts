import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SUPABASE_AUTH_STORAGE_KEY } from "@/lib/supabase/config";
import { resolveInitialWorkspaceContext } from "@/lib/workspace/server-context";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  bootstrapUserWorkspace: vi.fn(),
  listUserWorkspaces: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
  headers: mocks.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("@/lib/workspace/bootstrap", () => ({
  bootstrapUserWorkspace: mocks.bootstrapUserWorkspace,
  listUserWorkspaces: mocks.listUserWorkspaces,
}));

const workspace = { id: "workspace-1", slug: "caja", name: "Caja" };

function useSessionCookie(accessToken: string) {
  const session = encodeURIComponent(
    JSON.stringify({ access_token: accessToken, refresh_token: "refresh" }),
  );
  mocks.cookies.mockResolvedValue({
    toString: () => `encaja-locale=es; ${SUPABASE_AUTH_STORAGE_KEY}=${session}`,
    get: () => undefined,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.headers.mockResolvedValue(new Headers({ "x-encaja-pathname": "/app/caja" }));
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  mocks.createSupabaseServerClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  });
  mocks.listUserWorkspaces.mockResolvedValue([workspace]);
  useSessionCookie("access");
});

describe("resolveInitialWorkspaceContext", () => {
  it("redirige a /login ante un rechazo definitivo", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("expired", 403, "bad_jwt"),
    });

    await expect(resolveInitialWorkspaceContext()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });

  it("redirige a /login si no hay usuario y no hay error", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(resolveInitialWorkspaceContext()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it.each([
    ["red", new AuthRetryableFetchError("network", 503)],
    ["5xx", new AuthApiError("server", 500, "unexpected_failure")],
    ["refresh_token_already_used", new AuthApiError("reused", 400, "refresh_token_already_used")],
  ])("lanza un error y no redirige ante un fallo transitorio por %s", async (_label, error) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error });

    await expect(resolveInitialWorkspaceContext()).rejects.toThrow("No se pudo validar la sesión");

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("usa el token de una cookie renovada para validar y para consultar", async () => {
    useSessionCookie("new-access");
    const user = { id: "user-1", user_metadata: {} };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });

    const context = await resolveInitialWorkspaceContext();

    expect(mocks.createSupabaseServerClient).toHaveBeenCalledWith("new-access");
    expect(mocks.getUser).toHaveBeenCalledWith("new-access");
    expect(context.user).toBe(user);
    expect(context.workspace).toBe(workspace);
  });
});
