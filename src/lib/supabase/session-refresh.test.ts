import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type Session,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveSessionTokens } from "@/lib/supabase/session-refresh";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  singletonRefreshSession: vi.fn(),
  refreshSession: vi.fn(),
  createSupabaseRefreshClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server-verifier", () => ({
  getSupabaseVerifierClient: () => ({
    auth: { getUser: mocks.getUser, refreshSession: mocks.singletonRefreshSession },
  }),
  createSupabaseRefreshClient: mocks.createSupabaseRefreshClient,
}));

const tokens = { accessToken: "old-access", refreshToken: "old-refresh" };
const renewedSession = { access_token: "new-access", refresh_token: "new-refresh" } as Session;

const userAccepted = { data: { user: { id: "user-1" } }, error: null };
const userRejected = { data: { user: null }, error: new AuthApiError("expired", 403, "bad_jwt") };
const refreshAccepted = { data: { session: renewedSession, user: null }, error: null };

function refreshFailure(error: unknown) {
  return { data: { session: null, user: null }, error };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createSupabaseRefreshClient.mockImplementation(() => ({
    auth: { refreshSession: mocks.refreshSession },
  }));
});

describe("resolveSessionTokens", () => {
  it("devuelve valid y no renueva si getUser acepta el token", async () => {
    mocks.getUser.mockResolvedValue(userAccepted);

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({ status: "valid" });

    expect(mocks.getUser).toHaveBeenCalledWith("old-access");
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("devuelve renewed sin volver a llamar a getUser", async () => {
    mocks.getUser.mockResolvedValue(userRejected);
    mocks.refreshSession.mockResolvedValue(refreshAccepted);

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({
      status: "renewed",
      session: renewedSession,
    });

    expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: "old-refresh" });
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("devuelve rejected sin refresh token", async () => {
    mocks.getUser.mockResolvedValue(userRejected);

    await expect(
      resolveSessionTokens({ accessToken: "old-access", refreshToken: null }),
    ).resolves.toEqual({ status: "rejected" });

    expect(mocks.createSupabaseRefreshClient).not.toHaveBeenCalled();
  });

  it("devuelve rejected si la renovacion se rechaza de forma definitiva", async () => {
    mocks.getUser.mockResolvedValue(userRejected);
    mocks.refreshSession.mockResolvedValue(
      refreshFailure(new AuthApiError("not found", 400, "refresh_token_not_found")),
    );

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({ status: "rejected" });
  });

  it("intenta renovar si getUser informa session_not_found", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthSessionMissingError(),
    });
    mocks.refreshSession.mockResolvedValue(refreshAccepted);

    await expect(resolveSessionTokens(tokens)).resolves.toMatchObject({ status: "renewed" });
  });

  it("intenta renovar si getUser responde sin usuario y sin error", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.refreshSession.mockResolvedValue(refreshAccepted);

    await expect(resolveSessionTokens(tokens)).resolves.toMatchObject({ status: "renewed" });
  });

  it.each([
    ["AuthRetryableFetchError", new AuthRetryableFetchError("network", 503)],
    ["500", new AuthApiError("server", 500, "unexpected_failure")],
    ["429", new AuthApiError("rate limit", 429, "over_request_rate_limit")],
  ])("devuelve unverified y no renueva si getUser falla con %s", async (_label, error) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error });

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({ status: "unverified" });

    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("devuelve unverified y no renueva si getUser lanza una excepcion", async () => {
    mocks.getUser.mockRejectedValue(new TypeError("fetch failed"));

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({ status: "unverified" });

    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it.each([
    ["refresh_token_already_used", new AuthApiError("reused", 400, "refresh_token_already_used")],
    ["AuthRetryableFetchError", new AuthRetryableFetchError("network", 503)],
    ["500", new AuthApiError("server", 500, "unexpected_failure")],
    ["sin sesion y sin error", null],
  ])("devuelve unverified si la renovacion termina con %s", async (_label, error) => {
    mocks.getUser.mockResolvedValue(userRejected);
    mocks.refreshSession.mockResolvedValue(refreshFailure(error));

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({ status: "unverified" });
  });

  it("devuelve unverified si refreshSession lanza una excepcion", async () => {
    mocks.getUser.mockResolvedValue(userRejected);
    mocks.refreshSession.mockRejectedValue(new TypeError("fetch failed"));

    await expect(resolveSessionTokens(tokens)).resolves.toEqual({ status: "unverified" });
  });

  it("usa un cliente nuevo en cada renovacion y nunca el singleton", async () => {
    mocks.getUser.mockResolvedValue(userRejected);
    mocks.refreshSession.mockResolvedValue(refreshAccepted);

    await resolveSessionTokens(tokens);
    await resolveSessionTokens(tokens);

    expect(mocks.createSupabaseRefreshClient).toHaveBeenCalledTimes(2);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
    expect(mocks.singletonRefreshSession).not.toHaveBeenCalled();
  });
});

describe("createSupabaseRefreshClient", () => {
  it("no memoiza el cliente ni devuelve el singleton del verificador", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://encaja.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    const { createSupabaseRefreshClient, getSupabaseVerifierClient } = await vi.importActual<
      typeof import("@/lib/supabase/server-verifier")
    >("@/lib/supabase/server-verifier");

    const firstClient = createSupabaseRefreshClient();
    const secondClient = createSupabaseRefreshClient();

    expect(firstClient).not.toBe(secondClient);
    expect(firstClient).not.toBe(getSupabaseVerifierClient());
    vi.unstubAllEnvs();
  });
});
