import { describe, expect, it } from "vitest";

import {
  buildExpenseBudgetByCategory,
  countVariableExpenseTransactions,
  resolveCardComparisonCutoffDay,
  resolveImputationDay,
  sumCardExpenseUpToDay,
} from "@/features/insights/context-math";
import type { TransactionType } from "@/types/database";

type Row = {
  amount: number;
  type: TransactionType;
  payment_method_id: string | null;
  category_id: string;
  effective_date: string | null;
  transaction_date: string;
};

function cardExpense(date: string, amount: number, overrides: Partial<Row> = {}): Row {
  return {
    amount,
    type: "expense",
    payment_method_id: "card-1",
    category_id: "cat-food",
    effective_date: null,
    transaction_date: date,
    ...overrides,
  };
}

const creditCardIds = new Set(["card-1"]);
const excludedCategoryIds = new Set(["cat-adjustment"]);
const march = { start: "2026-03-01", end: "2026-04-01" };

describe("resolveImputationDay", () => {
  it("uses the effective date when present", () => {
    expect(resolveImputationDay({ effective_date: "2026-04-20", transaction_date: "2026-03-28" })).toBe(20);
  });

  it("falls back to the transaction date", () => {
    expect(resolveImputationDay({ effective_date: null, transaction_date: "2026-03-07" })).toBe(7);
  });
});

describe("resolveCardComparisonCutoffDay", () => {
  it("uses today in the middle of the month", () => {
    expect(resolveCardComparisonCutoffDay(new Date(2026, 3, 15, 12), 30, 31)).toBe(15);
  });

  it("caps the day at the length of a shorter previous month", () => {
    expect(resolveCardComparisonCutoffDay(new Date(2026, 2, 31, 12), 31, 28)).toBe(28);
  });

  it("takes the whole previous month on the last day of the month", () => {
    expect(resolveCardComparisonCutoffDay(new Date(2026, 1, 28, 12), 28, 31)).toBe(31);
  });
});

describe("sumCardExpenseUpToDay", () => {
  it("sums active card expenses imputed in the period up to the cutoff day", () => {
    const rows: Row[] = [
      cardExpense("2026-03-02", 400),
      cardExpense("2026-03-10", 600),
      cardExpense("2026-03-11", 900),
      cardExpense("2026-03-05", 50, { payment_method_id: "card-2" }),
      cardExpense("2026-03-05", 70, { payment_method_id: "debit-1" }),
      cardExpense("2026-03-05", 80, { payment_method_id: null }),
      cardExpense("2026-03-05", 90, { category_id: "cat-adjustment" }),
      cardExpense("2026-03-05", 100, { type: "income" }),
      cardExpense("2026-02-27", 5_000),
      cardExpense("2026-04-02", 300),
      cardExpense("2026-02-25", 200, { effective_date: "2026-03-03" }),
      cardExpense("2026-03-04", 250, { effective_date: "2026-04-04" }),
    ];

    expect(sumCardExpenseUpToDay({ rows, period: march, cutoffDay: 10, creditCardIds, excludedCategoryIds })).toBe(1_200);
  });

  it("ignores old card debt that is not a row of the period", () => {
    const rows: Row[] = [cardExpense("2026-01-15", 5_000), cardExpense("2026-03-05", 1_000), cardExpense("2026-03-20", 400)];

    expect(sumCardExpenseUpToDay({ rows, period: march, cutoffDay: 12, creditCardIds, excludedCategoryIds })).toBe(1_000);
  });
});

describe("buildExpenseBudgetByCategory", () => {
  const categories = [
    { id: "cat-food", name: "Comida", type: "expense", expense_behavior: "variable" },
    { id: "cat-rent", name: "Alquiler", type: "expense", expense_behavior: "fixed" },
    { id: "cat-fun", name: "Ocio", type: "expense", expense_behavior: null },
    { id: "cat-salary", name: "Sueldo", type: "income", expense_behavior: null },
    { id: "cat-saving", name: "Ahorro", type: "saving", expense_behavior: null },
  ] as const;

  it("sums root and subcategory budgets, skips zero budgets and non expense categories, and takes the actual from the map", () => {
    const result = buildExpenseBudgetByCategory({
      categories: [...categories],
      budgetItems: [
        { category_id: "cat-food", amount: 300 },
        { category_id: "cat-food", amount: 200 },
        { category_id: "cat-rent", amount: 1_000 },
        { category_id: "cat-fun", amount: 0 },
        { category_id: "cat-salary", amount: 5_000 },
        { category_id: "cat-saving", amount: 500 },
      ],
      expenseByCategory: new Map([
        ["cat-food", 320],
        ["cat-fun", 80],
      ]),
    });

    expect(result).toEqual([
      { categoryId: "cat-food", categoryName: "Comida", expenseBehavior: "variable", budgeted: 500, actual: 320 },
      { categoryId: "cat-rent", categoryName: "Alquiler", expenseBehavior: "fixed", budgeted: 1_000, actual: 0 },
    ]);
  });
});

describe("countVariableExpenseTransactions", () => {
  it("counts only variable category movements", () => {
    expect(
      countVariableExpenseTransactions([
        { categoryId: "a", categoryName: "a", amount: 1, behavior: "variable", transactionCount: 3 },
        { categoryId: "b", categoryName: "b", amount: 1, behavior: "fixed", transactionCount: 4 },
        { categoryId: "c", categoryName: "c", amount: 1, behavior: null, transactionCount: 5 },
        { categoryId: "d", categoryName: "d", amount: 1, behavior: "variable", transactionCount: 2 },
      ]),
    ).toBe(5);
  });
});
