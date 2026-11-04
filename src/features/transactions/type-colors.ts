import type { TransactionType } from "@/types/database";

export type TransactionMantineColor = "teal" | "pink" | "indigo" | "yellow";

// Canonical semantic mapping for financial types across Encaja UI.
export const transactionTypeMantineColor: Record<TransactionType, TransactionMantineColor> = {
  income: "teal",
  expense: "pink",
  saving: "indigo",
  transfer: "yellow",
};

export function transactionTypeColorShade(type: TransactionType, shade: number) {
  return `${transactionTypeMantineColor[type]}.${shade}`;
}

export function transactionTypeColorCssVar(type: TransactionType, shade: number) {
  return `var(--mantine-color-${transactionTypeMantineColor[type]}-${shade})`;
}

// Scheme-aware pastel background for each Mantine color: shade 0 in light, `-light` in dark.
export const mantineColorTintCssVar = {
  teal: "var(--encaja-tint-teal)",
  pink: "var(--encaja-tint-pink)",
  indigo: "var(--encaja-tint-indigo)",
  yellow: "var(--encaja-tint-yellow)",
  cyan: "var(--encaja-tint-cyan)",
} as const;

export function transactionTypeTintCssVar(type: TransactionType) {
  return mantineColorTintCssVar[transactionTypeMantineColor[type]];
}
