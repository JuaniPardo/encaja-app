import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  findAuthErrorTranslationKey,
  getLocalizedAuthErrorMessage,
} from "@/features/auth/error-messages";
import { getTranslation } from "@/features/i18n/dictionaries";

const tEs = (key: string, fallback?: string, values?: Record<string, string | number>) =>
  getTranslation("es", key, fallback, values);
const tEn = (key: string, fallback?: string, values?: Record<string, string | number>) =>
  getTranslation("en", key, fallback, values);

describe("getLocalizedAuthErrorMessage", () => {
  it("translates by error code", () => {
    const error = new AuthApiError("Email rate limit exceeded", 429, "over_email_send_rate_limit");

    expect(getLocalizedAuthErrorMessage(error, tEs)).toBe(getTranslation("es", "auth.errors.emailRateLimit"));
    expect(getLocalizedAuthErrorMessage(error, tEn)).toBe(getTranslation("en", "auth.errors.emailRateLimit"));
  });

  it("translates by message when there is no known code", () => {
    const error = new AuthApiError("Invalid login credentials", 400, undefined);

    expect(getLocalizedAuthErrorMessage(error, tEs)).toBe(
      getTranslation("es", "auth.errors.invalidCredentials"),
    );
  });

  it("returns the raw message when it does not know the error", () => {
    const error = new AuthApiError("Something odd happened", 500, "unexpected_failure");

    expect(getLocalizedAuthErrorMessage(error, tEs)).toBe("Something odd happened");
  });
});

describe("findAuthErrorTranslationKey", () => {
  it("returns null for unknown auth errors", () => {
    expect(findAuthErrorTranslationKey(new AuthApiError("Nope", 500, "unexpected_failure"))).toBeNull();
  });
});
