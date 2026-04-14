import type { TransactionType } from "@/types/database";

export type TransactionMantineColor = "teal" | "pink" | "indigo";

// Canonical semantic mapping for financial types across Encaja UI.
export const transactionTypeMantineColor: Record<TransactionType, TransactionMantineColor> = {
  income: "teal",
  expense: "pink",
  saving: "indigo",
};

export function transactionTypeColorShade(type: TransactionType, shade: number) {
  return `${transactionTypeMantineColor[type]}.${shade}`;
}

export function transactionTypeColorCssVar(type: TransactionType, shade: number) {
  return `var(--mantine-color-${transactionTypeMantineColor[type]}-${shade})`;
}
