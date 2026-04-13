import { describe, expect, it } from "vitest";

import { buildStartProgress } from "@/features/start/progress";

describe("buildStartProgress", () => {
  it("returns no_movements when there are no transactions", () => {
    const result = buildStartProgress({
      hasAnyTransactions: false,
      hasIncomeTransactions: false,
      expenseTransactionCount: 0,
    });

    expect(result.status).toBe("no_movements");
    expect(result.recommendedTransactionType).toBe("expense");
    expect(result.checklist).toMatchObject({
      firstIncome: false,
      threeExpenses: false,
      reviewBalance: false,
      completed: 0,
      total: 3,
    });
  });

  it("returns started and suggests income when user has expenses only", () => {
    const result = buildStartProgress({
      hasAnyTransactions: true,
      hasIncomeTransactions: false,
      expenseTransactionCount: 2,
    });

    expect(result.status).toBe("started");
    expect(result.recommendedTransactionType).toBe("income");
    expect(result.checklist).toMatchObject({
      firstIncome: false,
      threeExpenses: false,
      reviewBalance: false,
      completed: 0,
    });
  });

  it("returns started and suggests expense when user has no expenses", () => {
    const result = buildStartProgress({
      hasAnyTransactions: true,
      hasIncomeTransactions: true,
      expenseTransactionCount: 0,
    });

    expect(result.status).toBe("started");
    expect(result.recommendedTransactionType).toBe("expense");
    expect(result.checklist).toMatchObject({
      firstIncome: true,
      threeExpenses: false,
      reviewBalance: false,
      completed: 1,
    });
  });

  it("returns ready_for_balance when user has both income and expenses", () => {
    const result = buildStartProgress({
      hasAnyTransactions: true,
      hasIncomeTransactions: true,
      expenseTransactionCount: 1,
    });

    expect(result.status).toBe("ready_for_balance");
    expect(result.recommendedTransactionType).toBeNull();
    expect(result.checklist).toMatchObject({
      firstIncome: true,
      threeExpenses: false,
      reviewBalance: true,
      completed: 2,
    });
  });

  it("marks threeExpenses as complete when there are at least 3 expenses", () => {
    const result = buildStartProgress({
      hasAnyTransactions: true,
      hasIncomeTransactions: true,
      expenseTransactionCount: 3,
    });

    expect(result.checklist).toMatchObject({
      firstIncome: true,
      threeExpenses: true,
      reviewBalance: true,
      completed: 3,
    });
  });
});
