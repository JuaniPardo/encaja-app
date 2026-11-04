import { resolvePeriodElapsedDays } from "@/features/dashboard/lib/dashboard-domain-rules";
import type { ExpenseBehavior, TransactionType } from "@/types/database";

export type BudgetLineTone = "within" | "overNegative" | "overPositive";

export type BudgetLineStatus = {
  percent: number;
  clampedPercent: number;
  isOver: boolean;
  isOnTarget: boolean;
  tone: BudgetLineTone;
};

const ON_TARGET_TOLERANCE = 0.005;
const OVER_BUDGET_TOLERANCE = 0.005;
const AT_RISK_PACE_MARGIN = 0.1;

export function resolveBudgetLineStatus(
  type: TransactionType,
  budgeted: number,
  actual: number,
): BudgetLineStatus {
  const percent = budgeted > 0 ? Math.round((actual / budgeted) * 100) : actual > 0 ? 100 : 0;
  const isOver = budgeted > 0 && actual > budgeted;
  const tone: BudgetLineTone = !isOver
    ? "within"
    : type === "income" || type === "saving"
      ? "overPositive"
      : "overNegative";

  return {
    percent,
    clampedPercent: Math.min(percent, 100),
    isOver,
    isOnTarget: budgeted > 0 && Math.abs(actual - budgeted) < ON_TARGET_TOLERANCE,
    tone,
  };
}

export function resolveMonthElapsedRatio(year: number, month: number, referenceDate: Date): number {
  const { daysInMonth, elapsedDays } = resolvePeriodElapsedDays({ year, month, referenceDate });
  return daysInMonth > 0 ? elapsedDays / daysInMonth : 0;
}

type IsBudgetCategoryAtRiskOptions = {
  type: TransactionType;
  expenseBehavior: ExpenseBehavior | null;
  budgeted: number;
  actual: number;
  monthElapsedRatio: number;
};

export function isBudgetCategoryAtRisk({
  type,
  expenseBehavior,
  budgeted,
  actual,
  monthElapsedRatio,
}: IsBudgetCategoryAtRiskOptions): boolean {
  if (type !== "expense" || expenseBehavior === "fixed" || budgeted <= 0) {
    return false;
  }

  if (actual > budgeted + OVER_BUDGET_TOLERANCE) {
    return true;
  }

  return actual / budgeted > monthElapsedRatio + AT_RISK_PACE_MARGIN;
}
