import { isAuthError } from "@supabase/supabase-js";

import { findAuthErrorTranslationKey } from "@/features/auth/error-messages";

export interface Translator {
  (key: string, fallback?: string, values?: Record<string, string | number>): string;
}

/** Error cuyo `message` ya es un texto traducido y pensado para mostrarse al usuario. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

type ErrorFields = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  cause?: unknown;
};

const ERROR_CODE_KEYS: Record<string, string> = {
  "42501": "common.errors.permissionDenied",
  PGRST301: "common.errors.sessionExpired",
  PGRST303: "common.errors.sessionExpired",
  "23505": "common.errors.duplicate",
  "23514": "common.errors.invalidValue",
  "23502": "common.errors.invalidValue",
  "22P02": "common.errors.invalidValue",
  "23503": "common.errors.relatedRecords",
  "57014": "common.errors.timeout",
};

const RAISE_EXCEPTION_CODE = "P0001";
const SESSION_MISSING_PREFIX = "No hay sesión activa";

// Las claves son el texto exacto de los `raise exception` de la última definición de cada RPC.
// Si una migración cambia ese texto, el mensaje cae en el fallback, que es un modo seguro.
export const BUSINESS_ERROR_KEYS: Record<string, string> = {
  "No encontramos ese email. La persona debe registrarse primero.":
    "common.errors.business.inviteEmailNotFound",
  "No podés invitarte a vos mismo.": "common.errors.business.inviteSelf",
  "El email es obligatorio.": "common.forms.workspace.requiredEmail",
  "Solo el owner puede invitar miembros.": "common.errors.business.ownerOnly",
  "Solo el owner puede remover miembros.": "common.errors.business.ownerOnly",
  "Solo el owner puede crear vínculos desde este workspace.": "common.errors.business.ownerOnly",
  "Solo el owner puede desactivar vínculos.": "common.errors.business.ownerOnly",
  "Solo el owner puede eliminar este workspace.": "common.errors.business.ownerOnly",
  "No podés remover tu propia membresía.": "common.errors.business.removeSelf",
  "No podés remover al owner del workspace.": "common.errors.business.removeOwner",
  "No encontramos ese miembro en este workspace.": "common.errors.business.memberNotFound",
  "No podés vincular un workspace consigo mismo.": "common.errors.business.linkSelf",
  "Necesitás acceso válido al workspace destino.": "common.errors.business.linkTargetAccess",
  "Ya existe un vínculo activo para ese workspace destino.":
    "workspaceSettings.notifications.activeLinkAlreadyExistsMessage",
  "No encontramos un vínculo activo para desactivar.": "common.errors.business.linkNotFound",
  "Necesitás al menos un workspace activo.": "workspace.needActiveWorkspace",
  "No sos miembro de este workspace o sos el owner y no podés abandonarlo.":
    "common.errors.business.leaveNotAllowed",
  "El nombre del workspace es obligatorio.": "common.forms.workspace.minNameLength",
  "No tenés acceso a este workspace.": "common.errors.permissionDenied",
  "No tenés acceso al workspace origen.": "common.errors.permissionDenied",
  "Current user is not a member of this workspace.": "common.errors.permissionDenied",
  "No authenticated user found.": "common.errors.sessionExpired",
  "Source and destination payment methods must be different.":
    "transactions.notifications.samePaymentMethodError",
  "Source payment method must be active.": "transactions.notifications.inactivePaymentMethodMessage",
  "Destination payment method must be active.":
    "transactions.notifications.inactivePaymentMethodMessage",
  "Payment method must be active.": "transactions.notifications.inactivePaymentMethodMessage",
  "Installment count must be at least 2.": "common.errors.business.installmentsCountRange",
  "Installment count cannot be greater than 120.": "common.errors.business.installmentsCountRange",
  "Installment purchases require a credit card payment method.":
    "common.errors.business.installmentsRequireCreditCard",
};

const NETWORK_ERROR_MESSAGES = ["failed to fetch", "load failed", "networkerror", "fetch failed"];

function asErrorFields(error: unknown): ErrorFields | null {
  return typeof error === "object" && error !== null ? (error as ErrorFields) : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isAbortError(fields: ErrorFields): boolean {
  const code = readString(fields.code);
  return (
    fields.name === "AbortError" ||
    code === "ABORT_ERR" ||
    (code === "" && readString(fields.message).startsWith("AbortError:"))
  );
}

function isNetworkError(fields: ErrorFields): boolean {
  if (fields.name === "AuthRetryableFetchError") {
    return true;
  }

  const code = readString(fields.code);
  const message = readString(fields.message);
  if (code === "" && (message.startsWith("TypeError:") || message.startsWith("FetchError:"))) {
    return true;
  }

  const normalizedMessage = message.trim().toLowerCase();
  return (
    fields.name === "TypeError" &&
    NETWORK_ERROR_MESSAGES.some((networkMessage) => normalizedMessage.startsWith(networkMessage))
  );
}

function resolveCause(error: unknown): unknown {
  const fields = asErrorFields(error);
  if (!fields || fields.cause === undefined || fields.cause === null) {
    return error;
  }

  if (readString(fields.code) !== "" || isAbortError(fields) || isNetworkError(fields)) {
    return error;
  }

  return fields.cause;
}

function logRawError(error: unknown) {
  const fields = asErrorFields(error);
  if (!fields) {
    console.error("[encaja] error", { message: String(error) });
    return;
  }

  console.error("[encaja] error", {
    name: fields.name,
    code: fields.code,
    message: fields.message,
    details: fields.details,
    hint: fields.hint,
  });
}

function findBusinessErrorKey(message: string): string | null {
  const normalizedMessage = message.trim();
  if (normalizedMessage.startsWith(SESSION_MISSING_PREFIX)) {
    return "common.errors.sessionExpired";
  }

  return BUSINESS_ERROR_KEYS[normalizedMessage] ?? null;
}

function findTranslationKey(error: unknown): string | null {
  const fields = asErrorFields(error);
  if (!fields) {
    return null;
  }

  if (isAbortError(fields)) {
    return "common.errors.timeout";
  }

  if (isNetworkError(fields)) {
    return "common.errors.network";
  }

  if (isAuthError(error)) {
    return findAuthErrorTranslationKey(error);
  }

  const code = readString(fields.code);
  const codeKey = ERROR_CODE_KEYS[code];
  if (codeKey) {
    return codeKey;
  }

  if (code === RAISE_EXCEPTION_CODE) {
    return findBusinessErrorKey(readString(fields.message));
  }

  return null;
}

/**
 * Devuelve un texto apto para el usuario. Nunca devuelve el `message` crudo de un error, salvo que
 * sea un `UserFacingError`. El error crudo queda registrado en la consola.
 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string,
  t: Translator,
): string {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  const resolvedError = resolveCause(error);
  if (resolvedError instanceof UserFacingError) {
    return resolvedError.message;
  }

  logRawError(resolvedError);

  const translationKey = findTranslationKey(resolvedError);
  if (!translationKey) {
    return fallbackMessage;
  }

  const translatedMessage = t(translationKey);
  return translatedMessage === translationKey ? fallbackMessage : translatedMessage;
}
