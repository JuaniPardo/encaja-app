import {
  AuthApiError,
  AuthRetryableFetchError,
  PostgrestError,
} from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { BudgetLoadError } from "@/features/budget/load-state";
import { supportedLocales, type Locale } from "@/features/i18n/config";
import { getTranslation, listTranslationKeys } from "@/features/i18n/dictionaries";
import {
  BUSINESS_ERROR_KEYS,
  getUserFacingErrorMessage,
  UserFacingError,
  type Translator,
} from "@/lib/errors/user-facing-error";

const FALLBACK = "Fallback traducido";

function translatorFor(locale: Locale): Translator {
  return (key, fallback, values) => getTranslation(locale, key, fallback, values);
}

const tEs = translatorFor("es");
const tEn = translatorFor("en");

function postgrestError(code: string, message: string) {
  return new PostgrestError({ code, message, details: "", hint: "" });
}

let consoleErrorSpy: MockInstance<Parameters<typeof console.error>, void>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe("getUserFacingErrorMessage", () => {
  it("translates RLS violations without leaking the policy text", () => {
    const rawMessage = 'new row violates row-level security policy for table "categories"';
    const error = postgrestError("42501", rawMessage);

    const spanish = getUserFacingErrorMessage(error, FALLBACK, tEs);
    const english = getUserFacingErrorMessage(error, FALLBACK, tEn);

    expect(spanish).toBe(getTranslation("es", "common.errors.permissionDenied"));
    expect(english).toBe(getTranslation("en", "common.errors.permissionDenied"));
    expect(spanish).not.toContain("row-level");
    expect(english).not.toContain("row-level");
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[encaja] error",
      expect.objectContaining({ code: "42501", message: rawMessage }),
    );
  });

  it("logs each raw error once", () => {
    getUserFacingErrorMessage(postgrestError("42501", "denied"), FALLBACK, tEs);

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy).toHaveBeenCalledWith("[encaja] error", {
      name: "PostgrestError",
      code: "42501",
      message: "denied",
      details: "",
      hint: "",
    });
  });

  it.each([
    ["23505", 'duplicate key value violates unique constraint "categories_workspace_id_name_key"', "duplicate"],
    ["23514", 'new row violates check constraint "transactions_amount_check"', "invalidValue"],
    ["23502", 'null value in column "name" violates not-null constraint', "invalidValue"],
    ["22P02", 'invalid input syntax for type uuid: "abc"', "invalidValue"],
    ["23503", 'update or delete on table "categories" violates foreign key constraint', "relatedRecords"],
    ["57014", "canceling statement due to statement timeout", "timeout"],
    ["PGRST301", "JWT expired", "sessionExpired"],
    ["PGRST303", "JWT expired", "sessionExpired"],
  ])("maps code %s to common.errors.%s", (code, rawMessage, key) => {
    const error = postgrestError(code, rawMessage);

    for (const locale of supportedLocales) {
      const message = getUserFacingErrorMessage(error, FALLBACK, translatorFor(locale));
      expect(message).toBe(getTranslation(locale, `common.errors.${key}`));
      expect(message).not.toContain("constraint");
    }
  });

  it.each([
    ["PostgREST fetch failure", { code: "", message: "TypeError: Failed to fetch", details: "", hint: "" }],
    ["PostgREST FetchError", { code: "", message: "FetchError: socket hang up", details: "", hint: "" }],
    ["Safari fetch failure", new TypeError("Load failed")],
    ["Chrome fetch failure", new TypeError("Failed to fetch")],
    ["Firefox fetch failure", new TypeError("NetworkError when attempting to fetch resource.")],
    ["Node fetch failure", new TypeError("fetch failed", { cause: new Error("ECONNREFUSED") })],
    ["auth retryable fetch", new AuthRetryableFetchError("Failed to fetch", 0)],
  ])("maps %s to common.errors.network", (_label, error) => {
    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(
      getTranslation("es", "common.errors.network"),
    );
  });

  it("does not treat an unrelated TypeError as a network failure", () => {
    expect(
      getUserFacingErrorMessage(new TypeError("x is not a function"), FALLBACK, tEs),
    ).toBe(FALLBACK);
  });

  it.each([
    ["DOMException-like abort", Object.assign(new Error("The user aborted a request."), { name: "AbortError" })],
    ["PostgREST abort", { code: "", message: "AbortError: The user aborted a request.", details: "", hint: "" }],
  ])("maps %s to common.errors.timeout", (_label, error) => {
    expect(getUserFacingErrorMessage(error, FALLBACK, tEn)).toBe(
      getTranslation("en", "common.errors.timeout"),
    );
  });

  it("translates known P0001 business messages in both locales", () => {
    const error = postgrestError(
      "P0001",
      "No encontramos ese email. La persona debe registrarse primero.",
    );

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(
      "No encontramos ese email. La persona tiene que registrarse primero.",
    );
    expect(getUserFacingErrorMessage(error, FALLBACK, tEn)).toBe(
      "We couldn't find that email. The person needs to sign up first.",
    );
  });

  it("matches P0001 business messages after trimming", () => {
    const error = postgrestError("P0001", "  Solo el owner puede eliminar este workspace.  ");

    expect(getUserFacingErrorMessage(error, FALLBACK, tEn)).toBe(
      getTranslation("en", "common.errors.business.ownerOnly"),
    );
  });

  it("maps missing-session P0001 messages to sessionExpired", () => {
    const error = postgrestError("P0001", "No hay sesión activa para invitar miembros.");

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(
      getTranslation("es", "common.errors.sessionExpired"),
    );
  });

  it("returns the fallback for unknown P0001 messages", () => {
    const error = postgrestError("P0001", "Transfer category transfer_out is not configured.");

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(FALLBACK);
  });

  it("returns business texts only for P0001", () => {
    const error = postgrestError("XX000", "No podés invitarte a vos mismo.");

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(FALLBACK);
  });

  it("returns the message of a UserFacingError without logging it", () => {
    expect(getUserFacingErrorMessage(new UserFacingError("x"), FALLBACK, tEs)).toBe("x");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("resolves a BudgetLoadError through its cause", () => {
    const cause = postgrestError("23505", 'duplicate key value violates unique constraint "x"');
    const error = new BudgetLoadError("budget.notifications.loadBudgetError", cause);

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(
      getTranslation("es", "common.errors.duplicate"),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[encaja] error",
      expect.objectContaining({ code: "23505" }),
    );
  });

  it("translates auth errors with the auth translator keys", () => {
    const error = new AuthApiError("Email rate limit exceeded", 429, "over_email_send_rate_limit");

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(
      getTranslation("es", "auth.errors.emailRateLimit"),
    );
    expect(getUserFacingErrorMessage(error, FALLBACK, tEn)).toBe(
      getTranslation("en", "auth.errors.emailRateLimit"),
    );
  });

  it("returns the fallback for unknown auth errors instead of the raw text", () => {
    const error = new AuthApiError("Something odd happened", 500, "unexpected_failure");

    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(FALLBACK);
  });

  it.each([
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["a plain Error", new Error("internal")],
    ["an object without code", { message: "internal detail" }],
  ])("returns the fallback for %s", (_label, error) => {
    expect(getUserFacingErrorMessage(error, FALLBACK, tEs)).toBe(FALLBACK);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
  });

  it("returns the fallback when the translation key is missing", () => {
    const identity: Translator = (key) => key;

    expect(getUserFacingErrorMessage(postgrestError("42501", "denied"), FALLBACK, identity)).toBe(
      FALLBACK,
    );
  });
});

describe("error dictionary keys", () => {
  const commonErrorKeys = listTranslationKeys("es").filter((key) =>
    key.startsWith("common.errors."),
  );

  it("defines the common error keys", () => {
    expect(commonErrorKeys).toEqual(
      expect.arrayContaining([
        "common.errors.generic",
        "common.errors.permissionDenied",
        "common.errors.sessionExpired",
        "common.errors.duplicate",
        "common.errors.invalidValue",
        "common.errors.relatedRecords",
        "common.errors.network",
        "common.errors.timeout",
      ]),
    );
  });

  it.each(supportedLocales)("translates every business and common error key in %s", (locale) => {
    const keys = new Set([...Object.values(BUSINESS_ERROR_KEYS), ...commonErrorKeys]);
    const missing = [...keys].filter((key) => getTranslation(locale, key) === key);
    const definedInLocale = new Set(listTranslationKeys(locale));

    expect(missing).toEqual([]);
    expect([...keys].filter((key) => !definedInLocale.has(key))).toEqual([]);
  });
});
