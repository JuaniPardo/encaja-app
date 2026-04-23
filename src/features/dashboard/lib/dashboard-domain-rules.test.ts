import { describe, expect, it } from "vitest";

import { buildFinancialSummary, buildGovernedDateBeforeFilter, buildGovernedDateRangeFilter } from "./dashboard-domain-rules";

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
});
