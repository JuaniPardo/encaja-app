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
    creditCardDueDatePassed: true,
    incomeCurrentMonth: 1_000_000,
    creditCardExpenseCurrentMonth: 400_000,
    creditCardExpensePreviousMonth: 300_000,
    creditCardPaymentsCurrentMonth: 400_000,
    creditCardOpeningDebt: 350_000,
    creditCardDebtTotal: 200_000,
    creditCardCurrentStatement: 400_000,
    creditCardNextMonthInstallments: 100_000,
    ...overrides,
  };
}

describe("buildInsightsResult", () => {
  it("prioritizes unpaid card insight when due date passed and no payment exists", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 520_000,
        creditCardPaymentsCurrentMonth: 0,
        creditCardOpeningDebt: 520_000,
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
        creditCardPaymentsCurrentMonth: 200_000,
        creditCardOpeningDebt: 500_000,
        creditCardCurrentStatement: 500_000,
      }),
      t,
      currencyFormatter,
    });

    const partialInsight = result.allInsights.find((insight) => insight.kind === "partial_payment");
    expect(partialInsight?.severity).toBe("warning");
  });

  it("returns full payment positive insight when statement is fully paid", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 450_000,
        creditCardPaymentsCurrentMonth: 450_000,
        creditCardOpeningDebt: 430_000,
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
        creditCardDueDatePassed: false,
        incomeCurrentMonth: 900_000,
        creditCardExpenseCurrentMonth: 950_000,
        creditCardOpeningDebt: 0,
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
