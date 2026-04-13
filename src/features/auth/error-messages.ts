import type { AuthError } from "@supabase/supabase-js";

interface Translator {
  (key: string, fallback?: string, values?: Record<string, string | number>): string;
}

const authErrorCodeTranslationKey: Record<string, string> = {
  email_not_confirmed: "auth.errors.emailNotConfirmed",
  invalid_credentials: "auth.errors.invalidCredentials",
  over_email_send_rate_limit: "auth.errors.emailRateLimit",
  signup_disabled: "auth.errors.signupDisabled",
  user_already_exists: "auth.errors.userAlreadyExists",
  weak_password: "auth.errors.weakPassword",
};

function findCodeTranslationKey(error: AuthError): string | null {
  const errorWithCode = error as AuthError & { code?: string | null };
  const code = errorWithCode.code?.trim().toLowerCase();
  if (!code) {
    return null;
  }

  return authErrorCodeTranslationKey[code] ?? null;
}

function findMessageTranslationKey(errorMessage: string): string | null {
  const normalizedMessage = errorMessage.trim().toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "auth.errors.invalidCredentials";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "auth.errors.emailNotConfirmed";
  }

  if (
    normalizedMessage.includes("user already registered") ||
    normalizedMessage.includes("already been registered")
  ) {
    return "auth.errors.userAlreadyExists";
  }

  if (normalizedMessage.includes("password should be at least")) {
    return "auth.errors.weakPassword";
  }

  if (
    normalizedMessage.includes("security purposes") ||
    normalizedMessage.includes("rate limit")
  ) {
    return "auth.errors.emailRateLimit";
  }

  if (normalizedMessage.includes("signups not allowed")) {
    return "auth.errors.signupDisabled";
  }

  return null;
}

export function getLocalizedAuthErrorMessage(error: AuthError, t: Translator): string {
  const translationKey = findCodeTranslationKey(error) ?? findMessageTranslationKey(error.message);
  if (!translationKey) {
    return error.message;
  }

  const translatedMessage = t(translationKey);
  if (translatedMessage === translationKey) {
    return error.message;
  }

  return translatedMessage;
}
