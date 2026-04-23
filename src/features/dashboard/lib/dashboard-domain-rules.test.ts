import { describe, expect, it } from "vitest";

import {
  buildFinancialSummary,
  buildGovernedDateBeforeFilter,
  buildGovernedDateRangeFilter,
  buildProjectionBehaviorSummary,
  resolveCategoryBehavior,
} from "./dashboard-domain-rules";

describe("dashboard-domain-rules", () => {
  it("builds governed date filters with effective date fallback", () => {
    expect(buildGovernedDateRangeFilter("2026-04-01", "2026-05-01")).toBe(
      "and(effective_date.gte.2026-04-01,effective_date.lt.2026-05-01),and(effective_date.is.null,transaction_date.gte.2026-04-01,transaction_date.lt.2026-05-01)",
    );

    expect(buildGovernedDateBeforeFilter("2026-05-01")).toBe(
      "effective_date.lt.2026-05-01,and(effective_date.is.null,transaction_date.lt.2026-05-01)",
    );
  });

  it("keeps internal transfers neutral in available total and applies card payments as availability reduction", () => {
    const summary = buildFinancialSummary({
      locale: "es",
      transactionRows: [
        {
          category_id: "cat-expense",
          amount: 450,
          transaction_date: "2026-04-10",
          effective_date: null,
          type: "expense",
          payment_method_id: "pm-credit",
          direction: null,
        },
        {
          category_id: "cat-income",
          amount: 1000,
          transaction_date: "2026-04-03",
          effective_date: null,
          type: "income",
          payment_method_id: "pm-debit",
          direction: null,
        },
      ],
      allTransactionsImpact: new Map([
        ["pm-debit", -300],
        ["pm-cash", 100],
        ["pm-credit", 200],
      ]),
      nextMonthCommitmentByMethodId: new Map([["pm-credit", 120]]),
      previousMonthStatementByMethodId: new Map([["pm-credit", 500]]),
      currentMonthPaymentsByMethodId: new Map([["pm-credit", 200]]),
      paymentMethodRows: [
        {
          id: "pm-debit",
          name: "Debito",
          type: "debit_card",
          is_active: true,
          include_in_balance: true,
          current_balance: 0,
        },
        {
          id: "pm-cash",
          name: "Efectivo",
          type: "cash",
          is_active: true,
          include_in_balance: true,
          current_balance: 0,
        },
        {
          id: "pm-credit",
          name: "Credito",
          type: "credit_card",
          is_active: true,
          include_in_balance: true,
          current_balance: 0,
        },
      ],
    });

    expect(summary.availabilityTotalBalance).toBe(-200);
    expect(summary.creditCardRows[0]?.rolledDebt).toBe(300);
    expect(summary.creditCardPreviousMonthStatementTotal).toBe(500);
    expect(summary.creditCardMonthPaymentsTotal).toBe(200);
    expect(summary.creditCardMonthConsumptionTotal).toBe(450);
    expect(summary.creditCardNextMonthInstallmentsTotal).toBe(120);
  });

  it("supports negative rolled debt when the card is overpaid", () => {
    const summary = buildFinancialSummary({
      locale: "es",
      transactionRows: [],
      allTransactionsImpact: new Map(),
      nextMonthCommitmentByMethodId: new Map(),
      previousMonthStatementByMethodId: new Map([["pm-credit", 100]]),
      currentMonthPaymentsByMethodId: new Map([["pm-credit", 150]]),
      paymentMethodRows: [
        {
          id: "pm-credit",
          name: "Credito",
          type: "credit_card",
          is_active: true,
          include_in_balance: true,
          current_balance: 0,
        },
      ],
    });

    expect(summary.creditCardRows[0]?.rolledDebt).toBe(-50);
    expect(summary.creditCardRolledDebtTotal).toBe(-50);
  });

  it("resolves behavior for income and expense categories", () => {
    const systemCategoryKeyById = new Map([
      ["sys-income-salary", "income_salary"],
      ["sys-income-extra", "income_extra"],
    ]);

    expect(
      resolveCategoryBehavior({
        category: {
          id: "cat-income-salary",
          type: "income",
          source: "system",
          system_category_id: "sys-income-salary",
          expense_behavior: null,
        },
        systemCategoryKeyById,
      }),
    ).toBe("fixed");

    expect(
      resolveCategoryBehavior({
        category: {
          id: "cat-income-extra",
          type: "income",
          source: "system",
          system_category_id: "sys-income-extra",
          expense_behavior: null,
        },
        systemCategoryKeyById,
      }),
    ).toBe("variable");

    expect(
      resolveCategoryBehavior({
        category: {
          id: "cat-income-custom",
          type: "income",
          source: "custom",
          system_category_id: null,
          expense_behavior: null,
        },
        systemCategoryKeyById,
      }),
    ).toBe("variable");

    expect(
      resolveCategoryBehavior({
        category: {
          id: "cat-expense-fixed",
          type: "expense",
          source: "custom",
          system_category_id: null,
          expense_behavior: "fixed",
        },
        systemCategoryKeyById,
      }),
    ).toBe("fixed");
  });

  it("projects only variable components and preserves fixed components", () => {
    const summary = buildProjectionBehaviorSummary({
      categories: [
        {
          id: "cat-income-salary",
          type: "income",
          source: "system",
          system_category_id: "sys-income-salary",
          expense_behavior: null,
        },
        {
          id: "cat-income-extra",
          type: "income",
          source: "system",
          system_category_id: "sys-income-extra",
          expense_behavior: null,
        },
        {
          id: "cat-income-custom",
          type: "income",
          source: "custom",
          system_category_id: null,
          expense_behavior: null,
        },
        {
          id: "cat-expense-rent",
          type: "expense",
          source: "system",
          system_category_id: "sys-expense-rent",
          expense_behavior: "fixed",
        },
        {
          id: "cat-expense-groceries",
          type: "expense",
          source: "system",
          system_category_id: "sys-expense-groceries",
          expense_behavior: "variable",
        },
      ],
      transactionRows: [
        {
          category_id: "cat-income-salary",
          amount: 3000,
          type: "income",
        },
        {
          category_id: "cat-income-extra",
          amount: 200,
          type: "income",
        },
        {
          category_id: "cat-income-custom",
          amount: 100,
          type: "income",
        },
        {
          category_id: "cat-expense-rent",
          amount: 900,
          type: "expense",
        },
        {
          category_id: "cat-expense-groceries",
          amount: 300,
          type: "expense",
        },
      ],
      budgetItems: [
        { category_id: "cat-income-salary", amount: 3000 },
        { category_id: "cat-income-extra", amount: 500 },
        { category_id: "cat-expense-rent", amount: 900 },
        { category_id: "cat-expense-groceries", amount: 600 },
      ],
      systemCategoryKeyById: new Map([
        ["sys-income-salary", "income_salary"],
        ["sys-income-extra", "income_extra"],
      ]),
      selectedYear: 2026,
      selectedMonth: 4,
      referenceDate: new Date(2026, 3, 10, 12, 0, 0, 0),
    });

    expect(summary.daysInMonth).toBe(30);
    expect(summary.elapsedDays).toBe(10);
    expect(summary.remainingDays).toBe(20);

    expect(summary.income.fixedReal).toBe(3000);
    expect(summary.income.variableReal).toBe(300);
    expect(summary.income.variableProjected).toBe(900);
    expect(summary.income.projectedTotal).toBe(3900);
    expect(summary.income.variableDailyPace).toBe(30);

    expect(summary.expense.fixedReal).toBe(900);
    expect(summary.expense.variableReal).toBe(300);
    expect(summary.expense.variableProjected).toBe(900);
    expect(summary.expense.projectedTotal).toBe(1800);
    expect(summary.expense.variableDailyPace).toBe(30);
    expect(summary.projectedBalance).toBe(2100);
  });

  it("does not inflate projection for a closed month", () => {
    const summary = buildProjectionBehaviorSummary({
      categories: [
        {
          id: "cat-income-extra",
          type: "income",
          source: "system",
          system_category_id: "sys-income-extra",
          expense_behavior: null,
        },
        {
          id: "cat-expense-groceries",
          type: "expense",
          source: "system",
          system_category_id: "sys-expense-groceries",
          expense_behavior: "variable",
        },
      ],
      transactionRows: [
        {
          category_id: "cat-income-extra",
          amount: 800,
          type: "income",
        },
        {
          category_id: "cat-expense-groceries",
          amount: 620,
          type: "expense",
        },
      ],
      budgetItems: [],
      systemCategoryKeyById: new Map([["sys-income-extra", "income_extra"]]),
      selectedYear: 2026,
      selectedMonth: 3,
      referenceDate: new Date(2026, 3, 15, 12, 0, 0, 0),
    });

    expect(summary.daysInMonth).toBe(31);
    expect(summary.elapsedDays).toBe(31);
    expect(summary.remainingDays).toBe(0);
    expect(summary.income.variableProjected).toBe(800);
    expect(summary.expense.variableProjected).toBe(620);
  });
});
