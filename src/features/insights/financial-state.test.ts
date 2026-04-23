import { describe, expect, it } from "vitest";

import { resolveFinancialState } from "@/features/insights/financial-state";
import type { InsightsContext } from "@/features/insights/types";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const t = (key: string) => key;

function buildBaseContext(overrides: Partial<InsightsContext> = {}): InsightsContext {
  return {
    referenceDate: new Date("2026-04-21T12:00:00.000Z"),
    currentPeriod: { start: "2026-04-01", end: "2026-05-01" },
    previousPeriod: { start: "2026-03-01", end: "2026-04-01" },
    nextPeriod: { start: "2026-05-01", end: "2026-06-01" },
    availableCurrent: 900_000,
    creditCardCount: 1,
    incomeCurrentMonth: 1_100_000,
    expenseCurrentMonth: 700_000,
    savingCurrentMonth: 120_000,
    creditCardExpenseCurrentMonth: 250_000,
    creditCardExpensePreviousMonth: 240_000,
    creditCardPaymentsCurrentMonth: 250_000,
    creditCardDebtTotal: 80_000,
    creditCardCurrentStatement: 250_000,
    creditCardNextMonthCommitment: 80_000,
    projectedIncomeTotal: 1_150_000,
    projectedExpenseTotal: 760_000,
    projectedExpenseVariable: 360_000,
    projectedBalance: 390_000,
    elapsedDaysCurrentMonth: 21,
    daysInCurrentMonth: 30,
    relevantTransactionCountCurrentMonth: 14,
    expenseByCategoryCurrentMonth: [],
    ...overrides,
  };
}

describe("resolveFinancialState", () => {
  it("returns healthy when future pressure is low and projection remains positive", () => {
    const state = resolveFinancialState({
      context: buildBaseContext({
        availableCurrent: 1_200_000,
        creditCardExpenseCurrentMonth: 120_000,
        creditCardNextMonthCommitment: 50_000,
        projectedBalance: 420_000,
      }),
      t,
      currencyFormatter,
    });

    expect(state.level).toBe("healthy");
  });

  it("returns stable when there is manageable pressure but still enough margin", () => {
    const state = resolveFinancialState({
      context: buildBaseContext({
        availableCurrent: 850_000,
        creditCardExpenseCurrentMonth: 280_000,
        creditCardNextMonthCommitment: 170_000,
        projectedBalance: 120_000,
      }),
      t,
      currencyFormatter,
    });

    expect(state.level).toBe("stable");
  });

  it("returns attention when commitments start to compress next-month margin", () => {
    const state = resolveFinancialState({
      context: buildBaseContext({
        availableCurrent: 650_000,
        creditCardExpenseCurrentMonth: 360_000,
        creditCardNextMonthCommitment: 240_000,
        projectedBalance: 40_000,
      }),
      t,
      currencyFormatter,
    });

    expect(state.level).toBe("attention");
  });

  it("returns critical when future pressure exceeds available capacity", () => {
    const state = resolveFinancialState({
      context: buildBaseContext({
        availableCurrent: 300_000,
        creditCardExpenseCurrentMonth: 520_000,
        creditCardNextMonthCommitment: 460_000,
        projectedBalance: -150_000,
      }),
      t,
      currencyFormatter,
    });

    expect(state.level).toBe("critical");
  });
});
