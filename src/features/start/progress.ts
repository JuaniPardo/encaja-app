import type { TransactionType } from "@/types/database";

export type StartStatus = "no_movements" | "started" | "ready_for_balance";

export interface StartProgressSignals {
  hasAnyTransactions: boolean;
  hasIncomeTransactions: boolean;
  expenseTransactionCount: number;
}

export interface StartProgressChecklist {
  firstIncome: boolean;
  threeExpenses: boolean;
  reviewBalance: boolean;
  completed: number;
  total: number;
}

export interface StartProgress {
  status: StartStatus;
  checklist: StartProgressChecklist;
  recommendedTransactionType: Exclude<TransactionType, "saving"> | null;
}

const checklistTotalSteps = 3;

function toSafeCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function resolveRecommendedTransactionType(
  hasAnyTransactions: boolean,
  hasIncomeTransactions: boolean,
  hasExpenseTransactions: boolean,
): Exclude<TransactionType, "saving"> | null {
  if (!hasAnyTransactions) {
    return "expense";
  }

  if (!hasExpenseTransactions) {
    return "expense";
  }

  if (!hasIncomeTransactions) {
    return "income";
  }

  return null;
}

export function buildStartProgress(signals: StartProgressSignals): StartProgress {
  const expenseTransactionCount = toSafeCount(signals.expenseTransactionCount);
  const hasExpenseTransactions = expenseTransactionCount > 0;

  let status: StartStatus;
  if (!signals.hasAnyTransactions) {
    status = "no_movements";
  } else if (signals.hasIncomeTransactions && hasExpenseTransactions) {
    status = "ready_for_balance";
  } else {
    status = "started";
  }

  const checklist: StartProgressChecklist = {
    firstIncome: signals.hasIncomeTransactions,
    threeExpenses: expenseTransactionCount >= 3,
    reviewBalance: signals.hasIncomeTransactions && hasExpenseTransactions,
    completed: 0,
    total: checklistTotalSteps,
  };

  checklist.completed =
    Number(checklist.firstIncome) + Number(checklist.threeExpenses) + Number(checklist.reviewBalance);

  return {
    status,
    checklist,
    recommendedTransactionType: resolveRecommendedTransactionType(
      signals.hasAnyTransactions,
      signals.hasIncomeTransactions,
      hasExpenseTransactions,
    ),
  };
}
