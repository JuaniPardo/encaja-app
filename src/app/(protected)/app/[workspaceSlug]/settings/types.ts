import type { Database } from "@/types/database";

export type WorkspaceMemberSummary =
  Database["public"]["Functions"]["list_workspace_members"]["Returns"][number];
export type WorkspaceLinkSummary =
  Database["public"]["Functions"]["list_workspace_links"]["Returns"][number];
export type WorkspaceSettingsCurrencyRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "workspace_id" | "currency_code"
>;

export const DEFAULT_CURRENCY_CODE = "ARS";
export const WORKSPACE_CURRENCY_CODES = [
  "ARS",
  "USD",
  "EUR",
  "CLP",
  "UYU",
  "BRL",
  "MXN",
  "COP",
  "PEN",
] as const;

export function getMemberDisplayName(member: WorkspaceMemberSummary) {
  if (member.full_name && member.full_name.trim().length > 0) {
    return member.full_name.trim();
  }

  return member.email;
}

export function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}
