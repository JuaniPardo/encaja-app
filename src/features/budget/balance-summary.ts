import { roundMoney } from "@/features/dashboard/lib/dashboard-math";

export type BudgetBalanceStatus = "balanced" | "remaining" | "overassigned";

export type BudgetBalanceSummary = {
  status: BudgetBalanceStatus;
  messageKey: "budget.summary.balancedMessage" | "budget.summary.remainingMessage" | "budget.summary.overMessage";
  amount: number;
};

const BALANCE_TOLERANCE = 0.005;

export function resolveBudgetBalanceSummary(balance: number): BudgetBalanceSummary {
  const roundedBalance = roundMoney(balance);

  if (Math.abs(roundedBalance) < BALANCE_TOLERANCE) {
    return { status: "balanced", messageKey: "budget.summary.balancedMessage", amount: 0 };
  }

  if (roundedBalance > 0) {
    return { status: "remaining", messageKey: "budget.summary.remainingMessage", amount: roundedBalance };
  }

  return { status: "overassigned", messageKey: "budget.summary.overMessage", amount: Math.abs(roundedBalance) };
}
