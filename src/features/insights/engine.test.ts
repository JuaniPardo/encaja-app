import { describe, expect, it } from "vitest";

import { buildInsightsResult } from "@/features/insights/engine";
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
    creditCardCount: 1,
    incomeCurrentMonth: 1_000_000,
    creditCardExpenseCurrentMonth: 400_000,
    creditCardExpensePreviousMonth: 300_000,
    creditCardPaymentsCurrentMonth: 400_000,
    creditCardDebtTotal: 200_000,
    creditCardCurrentStatement: 400_000,
    creditCardNextMonthCommitment: 100_000,
    ...overrides,
  };
}

describe("buildInsightsResult", () => {
  it("prioritizes unpaid card insight when no payment exists", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 520_000,
        creditCardExpensePreviousMonth: 520_000,
        creditCardPaymentsCurrentMonth: 0,
        creditCardCurrentStatement: 520_000,
      }),
      t,
      currencyFormatter,
    });

    expect(result.primaryInsight?.kind).toBe("unpaid");
    expect(result.primaryInsight?.severity).toBe("alert");
  });

  it("returns partial payment insight when statement remains pending after payment", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 500_000,
        creditCardExpensePreviousMonth: 500_000,
        creditCardPaymentsCurrentMonth: 200_000,
        creditCardCurrentStatement: 500_000,
      }),
      t,
      currencyFormatter,
    });

    const rolledDebtInsight = result.allInsights.find((insight) => insight.kind === "rolled_debt");
    expect(rolledDebtInsight?.severity).toBe("warning");
  });

  it("detects rolled debt from payment vs previous month card spending", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpensePreviousMonth: 880_000,
        creditCardPaymentsCurrentMonth: 800_000,
      }),
      t,
      currencyFormatter,
    });

    const rolledDebtInsight = result.allInsights.find((insight) => insight.kind === "rolled_debt");
    expect(rolledDebtInsight).toBeDefined();
  });

  it("prioritizes next month commitment insight when future commitment is high", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        incomeCurrentMonth: 1_000_000,
        creditCardCurrentStatement: 180_000,
        creditCardDebtTotal: 220_000,
        creditCardNextMonthCommitment: 700_000,
      }),
      t,
      currencyFormatter,
    });

    expect(result.primaryInsight?.kind).toBe("next_month_commitment");
  });

  it("does not flag next month commitment when debt is current-month only", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardCurrentStatement: 650_000,
        creditCardNextMonthCommitment: 0,
      }),
      t,
      currencyFormatter,
    });

    const nextMonthCommitmentInsight = result.allInsights.find(
      (insight) => insight.kind === "next_month_commitment",
    );
    expect(nextMonthCommitmentInsight).toBeUndefined();
  });

  it("returns stable insight when card has no debt and no commitments", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 0,
        creditCardExpensePreviousMonth: 0,
        creditCardPaymentsCurrentMonth: 0,
        creditCardDebtTotal: 0,
        creditCardCurrentStatement: 0,
        creditCardNextMonthCommitment: 0,
      }),
      t,
      currencyFormatter,
    });

    expect(result.primaryInsight?.kind).toBe("stable");
    expect(result.primaryInsight?.severity).toBe("info");
  });

  it("returns full payment positive insight when statement is fully paid", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 450_000,
        creditCardExpensePreviousMonth: 430_000,
        creditCardPaymentsCurrentMonth: 450_000,
        creditCardCurrentStatement: 450_000,
      }),
      t,
      currencyFormatter,
    });

    const fullPaymentInsight = result.allInsights.find((insight) => insight.kind === "full_payment");
    expect(fullPaymentInsight?.severity).toBe("positive");
  });

  it("prioritizes debt over high usage when both are present", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        incomeCurrentMonth: 900_000,
        creditCardExpenseCurrentMonth: 950_000,
        creditCardDebtTotal: 1_050_000,
      }),
      t,
      currencyFormatter,
    });

    expect(result.primaryInsight?.kind).toBe("high_debt");
  });

  it("includes module metadata and keeps insights grouped by module", () => {
    const result = buildInsightsResult({
      context: buildBaseContext(),
      t,
      currencyFormatter,
    });

    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]?.module).toBe("credit_card");
    expect(result.modules[0]?.metadata.title).toBe("insightsV2.modules.creditCard.title");
    expect(result.modules[0]?.insights.length).toBeGreaterThan(0);
  });
});
