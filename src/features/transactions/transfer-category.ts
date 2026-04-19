import type { PaymentMethodType } from "@/types/database";

export type TransferSystemCategoryKey =
  | "transfer"
  | "credit_card_payment"
  | "cash_withdrawal"
  | "cash_deposit";

export function resolveTransferSystemCategoryKey(
  fromType: PaymentMethodType,
  toType: PaymentMethodType,
): TransferSystemCategoryKey {
  if (fromType === "credit_card") {
    throw new Error("Invalid transfer: credit card cannot be source.");
  }

  if (fromType === "debit_card" && toType === "cash") {
    return "cash_withdrawal";
  }

  if (fromType === "cash" && toType === "debit_card") {
    return "cash_deposit";
  }

  if ((fromType === "cash" || fromType === "debit_card") && toType === "credit_card") {
    return "credit_card_payment";
  }

  return "transfer";
}
