import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { isDefinitiveAuthRejection } from "@/lib/supabase/auth-errors";

describe("isDefinitiveAuthRejection", () => {
  it.each([
    ["400 refresh_token_not_found", new AuthApiError("not found", 400, "refresh_token_not_found")],
    ["403 bad_jwt", new AuthApiError("expired", 403, "bad_jwt")],
    ["AuthSessionMissingError", new AuthSessionMissingError()],
  ])("clasifica %s como rechazo definitivo", (_label, error) => {
    expect(isDefinitiveAuthRejection(error)).toBe(true);
  });

  it.each([
    ["refresh_token_already_used", new AuthApiError("reused", 400, "refresh_token_already_used")],
    ["429", new AuthApiError("rate limit", 429, "over_request_rate_limit")],
    ["408", new AuthApiError("timeout", 408, "request_timeout")],
    ["500", new AuthApiError("server", 500, "unexpected_failure")],
    ["AuthRetryableFetchError", new AuthRetryableFetchError("network", 503)],
    ["TypeError", new TypeError("fetch failed")],
    ["null", null],
  ])("no clasifica %s como rechazo definitivo", (_label, error) => {
    expect(isDefinitiveAuthRejection(error)).toBe(false);
  });
});
