import type { TransactionType } from "@/types/database";

export type BudgetLineTone = "within" | "overNegative" | "overPositive";

export type BudgetLineStatus = {
  percent: number;
  clampedPercent: number;
  isOver: boolean;
  tone: BudgetLineTone;
};

const CRITICAL_CONSUMPTION_RATIO = 0.8;

export function resolveBudgetLineStatus(
  type: TransactionType,
  budgeted: number,
  actual: number,
): BudgetLineStatus {
  const percent = budgeted > 0 ? Math.round((actual / budgeted) * 100) : actual > 0 ? 100 : 0;
  const isOver = budgeted > 0 && actual > budgeted;
  const tone: BudgetLineTone = !isOver
    ? "within"
    : type === "income"
      ? "overPositive"
      : "overNegative";

  return {
    percent,
    clampedPercent: Math.min(percent, 100),
    isOver,
    tone,
  };
}

export function isBudgetCategoryCritical(
  type: TransactionType,
  budgeted: number,
  actual: number,
): boolean {
  if (type === "income") {
    return false;
  }

  return budgeted > 0 && actual / budgeted >= CRITICAL_CONSUMPTION_RATIO;
}
