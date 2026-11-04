import { describe, expect, it } from "vitest";

import {
  isBudgetCategoryAtRisk,
  resolveBudgetCategoryRisk,
  resolveBudgetLineStatus,
  resolveMonthElapsedRatio,
} from "@/features/budget/line-status";

describe("resolveBudgetLineStatus", () => {
  it("shows an income above its budget as a positive overrun", () => {
    expect(resolveBudgetLineStatus("income", 10000, 10800)).toEqual({
      percent: 108,
      clampedPercent: 100,
      isOver: true,
      isOnTarget: false,
      tone: "overPositive",
    });
  });

  it("keeps an income below its budget within range", () => {
    expect(resolveBudgetLineStatus("income", 10000, 9000)).toEqual({
      percent: 90,
      clampedPercent: 90,
      isOver: false,
      isOnTarget: false,
      tone: "within",
    });
  });

  it("shows an expense above its budget as a negative overrun", () => {
    expect(resolveBudgetLineStatus("expense", 10000, 10800)).toEqual({
      percent: 108,
      clampedPercent: 100,
      isOver: true,
      isOnTarget: false,
      tone: "overNegative",
    });
  });

  it("treats a saving like an income: within below, on target at 100% and a positive overrun above", () => {
    expect(resolveBudgetLineStatus("saving", 10000, 8000)).toMatchObject({ percent: 80, tone: "within" });
    expect(resolveBudgetLineStatus("saving", 10000, 10000)).toMatchObject({ isOnTarget: true, tone: "within" });
    expect(resolveBudgetLineStatus("saving", 10000, 12000)).toEqual({
      percent: 120,
      clampedPercent: 100,
      isOver: true,
      isOnTarget: false,
      tone: "overPositive",
    });
  });

  it("treats an exact match as within budget", () => {
    expect(resolveBudgetLineStatus("expense", 10000, 10000)).toMatchObject({
      percent: 100,
      isOver: false,
      tone: "within",
    });
  });

  it("returns 100 when there is actual amount without a budget", () => {
    expect(resolveBudgetLineStatus("expense", 0, 2500)).toEqual({
      percent: 100,
      clampedPercent: 100,
      isOver: false,
      isOnTarget: false,
      tone: "within",
    });
  });

  it("returns 0 when there is neither budget nor actual amount", () => {
    expect(resolveBudgetLineStatus("income", 0, 0)).toEqual({
      percent: 0,
      clampedPercent: 0,
      isOver: false,
      isOnTarget: false,
      tone: "within",
    });
  });

  it("rounds the percent and clamps it at 100", () => {
    expect(resolveBudgetLineStatus("expense", 3000, 1000).percent).toBe(33);
    expect(resolveBudgetLineStatus("expense", 1000, 2500)).toMatchObject({
      percent: 250,
      clampedPercent: 100,
    });
  });

  it.each(["income", "expense", "saving"] as const)("marks a %s matching its budget as on target", (type) => {
    expect(resolveBudgetLineStatus(type, 10000, 10000).isOnTarget).toBe(true);
    expect(resolveBudgetLineStatus(type, 10000, 10000.004).isOnTarget).toBe(true);
    expect(resolveBudgetLineStatus(type, 10000, 9999.996).isOnTarget).toBe(true);
  });

  it("does not mark a line on target without budget or with a real difference", () => {
    expect(resolveBudgetLineStatus("expense", 0, 0).isOnTarget).toBe(false);
    expect(resolveBudgetLineStatus("expense", 10000, 10000.01).isOnTarget).toBe(false);
    expect(resolveBudgetLineStatus("income", 10000, 9999.99).isOnTarget).toBe(false);
  });
});

describe("isBudgetCategoryAtRisk", () => {
  const variableExpense = { type: "expense", expenseBehavior: "variable" } as const;

  it("never flags a fixed expense, even exact or exceeded", () => {
    expect(
      isBudgetCategoryAtRisk({
        type: "expense",
        expenseBehavior: "fixed",
        budgeted: 10000,
        actual: 10000,
        monthElapsedRatio: 0.1,
      }),
    ).toBe(false);
    expect(
      isBudgetCategoryAtRisk({
        type: "expense",
        expenseBehavior: "fixed",
        budgeted: 10000,
        actual: 15000,
        monthElapsedRatio: 1,
      }),
    ).toBe(false);
  });

  it("does not flag a variable expense that follows the month pace", () => {
    expect(
      isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 10000, actual: 8000, monthElapsedRatio: 28 / 30 }),
    ).toBe(false);
  });

  it("flags a variable expense ahead of the month pace", () => {
    expect(
      isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 10000, actual: 8000, monthElapsedRatio: 10 / 30 }),
    ).toBe(true);
  });

  it("flags a variable expense over its budget in a past month", () => {
    expect(isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 10000, actual: 10500, monthElapsedRatio: 1 })).toBe(
      true,
    );
    expect(isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 10000, actual: 9500, monthElapsedRatio: 1 })).toBe(
      false,
    );
  });

  it("treats an expense without behavior as variable", () => {
    expect(
      isBudgetCategoryAtRisk({
        type: "expense",
        expenseBehavior: null,
        budgeted: 10000,
        actual: 8000,
        monthElapsedRatio: 10 / 30,
      }),
    ).toBe(true);
  });

  it.each(["saving", "income"] as const)("never flags a %s", (type) => {
    expect(
      isBudgetCategoryAtRisk({ type, expenseBehavior: null, budgeted: 10000, actual: 12000, monthElapsedRatio: 0.5 }),
    ).toBe(false);
  });

  it("does not flag a category without budget", () => {
    expect(isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 0, actual: 50, monthElapsedRatio: 0.5 })).toBe(
      false,
    );
  });

  it("does not flag a variable expense exactly at the pace margin", () => {
    expect(isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 10000, actual: 6000, monthElapsedRatio: 0.5 })).toBe(
      false,
    );
    expect(isBudgetCategoryAtRisk({ ...variableExpense, budgeted: 10000, actual: 6001, monthElapsedRatio: 0.5 })).toBe(
      true,
    );
  });
});

describe("resolveBudgetCategoryRisk", () => {
  const variableExpense = { type: "expense", expenseBehavior: "variable" } as const;

  it("returns exceeded when the actual is over the budget by more than the tolerance", () => {
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 10000, actual: 10500, monthElapsedRatio: 1 })).toBe(
      "exceeded",
    );
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 100, actual: 110, monthElapsedRatio: 10 / 30 })).toBe(
      "exceeded",
    );
    expect(
      resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 100, actual: 100.004, monthElapsedRatio: 1 }),
    ).not.toBe("exceeded");
  });

  it("returns atRisk when the used share is ahead of the month pace without exceeding", () => {
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 10000, actual: 8000, monthElapsedRatio: 10 / 30 })).toBe(
      "atRisk",
    );
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 10000, actual: 6001, monthElapsedRatio: 0.5 })).toBe(
      "atRisk",
    );
    expect(
      resolveBudgetCategoryRisk({ type: "expense", expenseBehavior: null, budgeted: 100, actual: 60, monthElapsedRatio: 10 / 30 }),
    ).toBe("atRisk");
  });

  it("returns none at the pace margin, for fixed expenses, other types and categories without budget", () => {
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 10000, actual: 6000, monthElapsedRatio: 0.5 })).toBe(
      "none",
    );
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 10000, actual: 8000, monthElapsedRatio: 28 / 30 })).toBe(
      "none",
    );
    expect(
      resolveBudgetCategoryRisk({ type: "expense", expenseBehavior: "fixed", budgeted: 100, actual: 150, monthElapsedRatio: 1 }),
    ).toBe("none");
    expect(resolveBudgetCategoryRisk({ type: "income", expenseBehavior: null, budgeted: 100, actual: 150, monthElapsedRatio: 0.5 })).toBe(
      "none",
    );
    expect(resolveBudgetCategoryRisk({ type: "saving", expenseBehavior: null, budgeted: 100, actual: 150, monthElapsedRatio: 0.5 })).toBe(
      "none",
    );
    expect(resolveBudgetCategoryRisk({ ...variableExpense, budgeted: 0, actual: 50, monthElapsedRatio: 0.5 })).toBe("none");
  });

  it("agrees with isBudgetCategoryAtRisk on every case", () => {
    const cases = [
      { ...variableExpense, budgeted: 100, actual: 10, monthElapsedRatio: 0 },
      { ...variableExpense, budgeted: 100, actual: 11, monthElapsedRatio: 0 },
      { ...variableExpense, budgeted: 100, actual: 100.006, monthElapsedRatio: 1 },
      { ...variableExpense, budgeted: 100, actual: 99, monthElapsedRatio: 1 },
      { type: "expense", expenseBehavior: "fixed", budgeted: 100, actual: 200, monthElapsedRatio: 0.2 },
      { ...variableExpense, budgeted: 0, actual: 0, monthElapsedRatio: 0.2 },
    ] as const;

    for (const options of cases) {
      expect(isBudgetCategoryAtRisk(options)).toBe(resolveBudgetCategoryRisk(options) !== "none");
    }
  });
});

describe("resolveMonthElapsedRatio", () => {
  const referenceDate = new Date(2026, 3, 10, 12);

  it("returns 1 for a past month", () => {
    expect(resolveMonthElapsedRatio(2026, 3, referenceDate)).toBe(1);
  });

  it("returns the elapsed fraction for the current month", () => {
    expect(resolveMonthElapsedRatio(2026, 4, referenceDate)).toBe(10 / 30);
  });

  it("returns 0 for a future month", () => {
    expect(resolveMonthElapsedRatio(2026, 5, referenceDate)).toBe(0);
  });
});
