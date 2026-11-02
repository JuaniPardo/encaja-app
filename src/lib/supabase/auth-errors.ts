import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

// Lista cerrada: lo que no se clasifique acá como rechazo se trata como transitorio.
export function isDefinitiveAuthRejection(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) {
    return true;
  }

  if (!isAuthApiError(error)) {
    return false;
  }

  if (error.code === "refresh_token_already_used") {
    return false;
  }

  return error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}
