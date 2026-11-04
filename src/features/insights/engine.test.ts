import { describe, expect, it } from "vitest";

import { buildSafeCurrencyFormatter } from "@/features/dashboard/lib/dashboard-math";
import { resolveIntlLocale, supportedLocales, type Locale } from "@/features/i18n/config";
import { getTranslation } from "@/features/i18n/dictionaries";
import { buildInsightsResult } from "@/features/insights/engine";
import type { TranslationFn } from "@/features/insights/intl";
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
    availableCurrent: 850_000,
    creditCardCount: 1,
    incomeCurrentMonth: 1_000_000,
    expenseCurrentMonth: 520_000,
    savingCurrentMonth: 120_000,
    creditCardExpenseCurrentMonth: 400_000,
    creditCardExpensePreviousMonth: 300_000,
    creditCardPaymentsCurrentMonth: 400_000,
    creditCardPreviousMonthStatement: 300_000,
    creditCardRolledDebtCurrent: -100_000,
    creditCardDebtTotal: 200_000,
    creditCardCurrentStatement: 400_000,
    creditCardNextMonthCommitment: 100_000,
    projectedIncomeTotal: 1_100_000,
    projectedExpenseTotal: 820_000,
    projectedExpenseVariable: 420_000,
    projectedBalance: 280_000,
    elapsedDaysCurrentMonth: 21,
    daysInCurrentMonth: 30,
    relevantTransactionCountCurrentMonth: 14,
    expenseByCategoryCurrentMonth: [
      {
        categoryId: "cat-home",
        categoryName: "Hogar",
        amount: 260_000,
        behavior: "fixed",
      },
      {
        categoryId: "cat-food",
        categoryName: "Comida",
        amount: 260_000,
        behavior: "variable",
      },
    ],
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
      intlLocale: "es-AR",
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
      intlLocale: "es-AR",
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
      intlLocale: "es-AR",
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
      intlLocale: "es-AR",
    });

    expect(result.primaryInsight?.kind).toBe("next_month_commitment");
  });

  it("does not flag next month commitment when debt is current-month only", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardDebtTotal: 650_000,
        creditCardCurrentStatement: 0,
        creditCardNextMonthCommitment: 0,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    const nextMonthCommitmentInsight = result.allInsights.find(
      (insight) => insight.kind === "next_month_commitment",
    );
    expect(nextMonthCommitmentInsight).toBeUndefined();
  });

  it("shows next month commitment insight even when income reference is unavailable", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        incomeCurrentMonth: 0,
        projectedIncomeTotal: 0,
        creditCardCurrentStatement: 0,
        creditCardNextMonthCommitment: 1_300_000,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.primaryInsight?.kind).toBe("next_month_commitment");
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
      intlLocale: "es-AR",
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
      intlLocale: "es-AR",
    });

    const fullPaymentInsight = result.allInsights.find((insight) => insight.kind === "full_payment");
    expect(fullPaymentInsight?.severity).toBe("positive");
  });

  it("prioritizes debt over high usage when both are present", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        incomeCurrentMonth: 900_000,
        projectedIncomeTotal: 900_000,
        creditCardExpenseCurrentMonth: 950_000,
        creditCardDebtTotal: 1_050_000,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.primaryInsight?.kind).toBe("high_debt");
  });

  it("adds excess spending insight and prioritizes it when no stronger card alert exists", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardCount: 0,
        creditCardExpenseCurrentMonth: 0,
        creditCardExpensePreviousMonth: 0,
        creditCardPaymentsCurrentMonth: 0,
        creditCardDebtTotal: 0,
        creditCardCurrentStatement: 0,
        creditCardNextMonthCommitment: 0,
        projectedIncomeTotal: 850_000,
        projectedExpenseTotal: 980_000,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.primaryInsight?.kind).toBe("excess_spending");
    expect(result.primaryInsight?.severity).toBe("alert");
  });

  it("adds category imbalance insight when one category dominates current expense", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        expenseCurrentMonth: 600_000,
        expenseByCategoryCurrentMonth: [
          {
            categoryId: "cat-rent",
            categoryName: "Alquiler",
            amount: 500_000,
            behavior: "fixed",
          },
          {
            categoryId: "cat-food",
            categoryName: "Comida",
            amount: 100_000,
            behavior: "variable",
          },
        ],
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    const imbalanceInsight = result.allInsights.find((insight) => insight.kind === "category_imbalance");
    expect(imbalanceInsight).toBeDefined();
    expect(imbalanceInsight?.severity).toBe("alert");
  });

  it("computes critical financial state when future pressure exceeds current capacity", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        availableCurrent: 300_000,
        creditCardExpenseCurrentMonth: 550_000,
        creditCardNextMonthCommitment: 420_000,
        projectedBalance: -120_000,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.financialState.level).toBe("critical");
  });

  it("includes module metadata and keeps insights grouped by module", () => {
    const result = buildInsightsResult({
      context: buildBaseContext(),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.modules).toHaveLength(5);
    expect(result.modules[0]?.module).toBe("credit_card");
    expect(result.modules[0]?.metadata.title).toBe("insightsV2.modules.creditCard.title");
    expect(result.modules[1]?.module).toBe("spending");
    expect(result.modules[2]?.module).toBe("behavior");
    expect(result.modules[3]?.module).toBe("cashflow");
    expect(result.modules[4]?.module).toBe("activity");
  });
});

const CURRENCY_NEXT_TO_PERCENT = /(\$|Bs|US\$|ARS|BOB)\s?-?\d[\d.,]*\s?%/;

function buildT(locale: Locale): TranslationFn {
  return (key, fallback, values) => getTranslation(locale, key, fallback, values);
}

function buildFormatter(locale: Locale, currencyCode: string) {
  return buildSafeCurrencyFormatter(resolveIntlLocale(locale), currencyCode, false, currencyFormatter);
}

function buildRealResult(locale: Locale, currencyCode: string, context: InsightsContext) {
  return buildInsightsResult({
    context,
    t: buildT(locale),
    currencyFormatter: buildFormatter(locale, currencyCode),
    intlLocale: resolveIntlLocale(locale),
  });
}

function expectRenderedText(text: string) {
  expect(text).not.toContain("{{");
  expect(text.startsWith("insightsV2.")).toBe(false);
  expect(text).not.toMatch(CURRENCY_NEXT_TO_PERCENT);
}

const noCardSignals: Partial<InsightsContext> = {
  creditCardExpenseCurrentMonth: 0,
  creditCardExpensePreviousMonth: 0,
  creditCardPaymentsCurrentMonth: 0,
  creditCardDebtTotal: 0,
  creditCardCurrentStatement: 0,
  creditCardNextMonthCommitment: 0,
};

const dominantCategoryExpense: Partial<InsightsContext> = {
  expenseCurrentMonth: 1_000_000,
  expenseByCategoryCurrentMonth: [
    { categoryId: "cat-rent", categoryName: "Alquiler", amount: 620_000, behavior: "fixed" },
    { categoryId: "cat-food", categoryName: "Comida", amount: 380_000, behavior: "variable" },
  ],
};

const renderingScenarios: Array<{ name: string; overrides: Partial<InsightsContext>; expectedKind: string | null }> = [
  {
    name: "unpaid",
    overrides: { creditCardExpensePreviousMonth: 520_000, creditCardPaymentsCurrentMonth: 0 },
    expectedKind: "unpaid",
  },
  {
    name: "rolled debt",
    overrides: { creditCardExpensePreviousMonth: 500_000, creditCardPaymentsCurrentMonth: 200_000 },
    expectedKind: "rolled_debt",
  },
  {
    name: "full payment",
    overrides: { creditCardExpensePreviousMonth: 430_000, creditCardPaymentsCurrentMonth: 450_000 },
    expectedKind: "full_payment",
  },
  { name: "high usage alert", overrides: { creditCardExpenseCurrentMonth: 1_200_000 }, expectedKind: "high_usage" },
  { name: "high usage warning", overrides: { creditCardExpenseCurrentMonth: 850_000 }, expectedKind: "high_usage" },
  { name: "high debt", overrides: { creditCardDebtTotal: 1_050_000 }, expectedKind: "high_debt" },
  {
    name: "next commitment",
    overrides: { creditCardNextMonthCommitment: 700_000 },
    expectedKind: "next_month_commitment",
  },
  {
    name: "acceleration",
    overrides: { creditCardExpenseCurrentMonth: 600_000 },
    expectedKind: "spending_acceleration",
  },
  {
    name: "excess spending",
    overrides: { projectedIncomeTotal: 850_000, projectedExpenseTotal: 980_000 },
    expectedKind: "excess_spending",
  },
  { name: "category imbalance", overrides: dominantCategoryExpense, expectedKind: "category_imbalance" },
  { name: "low saving warning", overrides: { savingCurrentMonth: 0 }, expectedKind: "low_saving" },
  { name: "low saving info", overrides: { savingCurrentMonth: 50_000 }, expectedKind: "low_saving" },
  { name: "low activity", overrides: { relevantTransactionCountCurrentMonth: 0 }, expectedKind: "low_activity" },
  { name: "without cards", overrides: { creditCardCount: 0, ...noCardSignals }, expectedKind: null },
];

const renderingMatrix = supportedLocales.flatMap((locale) =>
  ["ARS", "BOB"].flatMap((currencyCode) =>
    renderingScenarios.map((scenario) => ({ locale, currencyCode, ...scenario })),
  ),
);

describe("buildInsightsResult with the real dictionary", () => {
  it.each(renderingMatrix)(
    "renders final text for $name in $locale with $currencyCode",
    ({ locale, currencyCode, overrides, expectedKind }) => {
      const result = buildRealResult(locale, currencyCode, buildBaseContext(overrides));

      if (expectedKind) {
        expect(result.allInsights.map((insight) => insight.kind)).toContain(expectedKind);
      }

      for (const insight of result.allInsights) {
        expectRenderedText(insight.title);
        expectRenderedText(insight.message);
      }

      for (const moduleResult of result.modules) {
        expectRenderedText(moduleResult.metadata.title);
        expectRenderedText(moduleResult.metadata.description);
      }

      expectRenderedText(result.financialState.title);
      expectRenderedText(result.financialState.message);
    },
  );

  it.each([
    ["es", "ARS"],
    ["es", "BOB"],
    ["en", "ARS"],
    ["en", "BOB"],
  ] as const)("formats a 62 percent category share as a percentage in %s with %s", (locale, currencyCode) => {
    const result = buildRealResult(locale, currencyCode, buildBaseContext(dominantCategoryExpense));

    const imbalance = result.allInsights.find((insight) => insight.kind === "category_imbalance");
    expect(imbalance?.message).toContain("62%");
    expect(imbalance?.message).not.toContain("$");
    expect(imbalance?.message).not.toContain("Bs");
  });

  it.each(supportedLocales)("does not claim that card debt reduces the available money in %s", (locale) => {
    const unpaid = buildRealResult(
      locale,
      "ARS",
      buildBaseContext({ creditCardExpensePreviousMonth: 520_000, creditCardPaymentsCurrentMonth: 0 }),
    ).allInsights.find((insight) => insight.kind === "unpaid");
    const rolledDebt = buildRealResult(
      locale,
      "ARS",
      buildBaseContext({ creditCardExpensePreviousMonth: 500_000, creditCardPaymentsCurrentMonth: 200_000 }),
    ).allInsights.find((insight) => insight.kind === "rolled_debt");

    expect(unpaid).toBeDefined();
    expect(rolledDebt).toBeDefined();
    for (const message of [unpaid?.message ?? "", rolledDebt?.message ?? ""]) {
      expect(message).not.toContain("reduce el dinero disponible");
      expect(message).not.toContain("reduces the money available");
    }
    expect(rolledDebt?.message).toContain(buildFormatter(locale, "ARS").format(200_000));
  });

  it("omits every credit card insight and module without active cards", () => {
    const result = buildRealResult("es", "ARS", buildBaseContext({ creditCardCount: 0, ...noCardSignals }));

    expect(result.allInsights.filter((insight) => insight.module === "credit_card")).toEqual([]);
    expect(result.primaryInsight?.module).not.toBe("credit_card");
    expect(result.modules.map((moduleResult) => moduleResult.module)).not.toContain("credit_card");
    expect(result.modules).toHaveLength(4);
  });

  it("omits card insights without active cards even when card amounts are present", () => {
    const result = buildRealResult(
      "es",
      "ARS",
      buildBaseContext({ creditCardCount: 0, creditCardExpensePreviousMonth: 520_000, creditCardPaymentsCurrentMonth: 0 }),
    );

    expect(result.allInsights.filter((insight) => insight.module === "credit_card")).toEqual([]);
    expect(result.primaryInsight?.module).not.toBe("credit_card");
  });

  it("keeps the card module and its stable insight with one active card", () => {
    const result = buildRealResult("es", "ARS", buildBaseContext({ creditCardCount: 1, ...noCardSignals }));

    expect(result.modules).toHaveLength(5);
    expect(result.modules[0]?.module).toBe("credit_card");
    expect(result.modules[0]?.insights.map((insight) => insight.kind)).toEqual(["stable"]);
  });

  it("emits a single card usage alert when card spending reaches 120% of income", () => {
    const result = buildRealResult(
      "es",
      "ARS",
      buildBaseContext({ creditCardExpenseCurrentMonth: 1_200_000, creditCardCurrentStatement: 1_200_000 }),
    );

    const usageInsights = result.allInsights.filter(
      (insight) => insight.kind === "high_usage" || insight.kind === "high_statement",
    );
    expect(usageInsights).toHaveLength(1);
    expect(usageInsights[0]?.kind).toBe("high_usage");
    expect(usageInsights[0]?.severity).toBe("alert");
  });
});
