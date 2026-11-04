import { describe, expect, it } from "vitest";

import { isBudgetCategoryAtRisk } from "@/features/budget/line-status";
import { buildSafeCurrencyFormatter } from "@/features/dashboard/lib/dashboard-math";
import { resolveIntlLocale, supportedLocales, type Locale } from "@/features/i18n/config";
import { getTranslation } from "@/features/i18n/dictionaries";
import { buildInsightsResult } from "@/features/insights/engine";
import type { TranslationFn } from "@/features/insights/intl";
import { compareInsightsByPriority } from "@/features/insights/priority";
import type { Insight, InsightCategoryBudget, InsightsContext } from "@/features/insights/types";

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
    creditCardExpenseCurrentMonthToDate: 0,
    creditCardExpensePreviousMonthToDate: 0,
    creditCardPaymentsCurrentMonth: 400_000,
    creditCardPreviousMonthStatement: 300_000,
    creditCardRolledDebtCurrent: -100_000,
    creditCardDebtTotal: 200_000,
    creditCardCurrentStatement: 400_000,
    creditCardNextMonthCommitment: 100_000,
    projectedIncomeTotal: 1_100_000,
    projectedFixedIncome: 1_000_000,
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
        transactionCount: 2,
      },
      {
        categoryId: "cat-food",
        categoryName: "Comida",
        amount: 260_000,
        behavior: "variable",
        transactionCount: 6,
      },
    ],
    expenseBudgetByCategoryCurrentMonth: [],
    variableExpenseBudgetTotal: 0,
    ...overrides,
  };
}

describe("buildInsightsResult", () => {
  it("prioritizes unpaid card insight when no payment exists", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 520_000,
        creditCardPreviousMonthStatement: 520_000,
        creditCardPaymentsCurrentMonth: 0,
        creditCardCurrentStatement: 520_000,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.primaryInsight?.kind).toBe("unpaid");
    expect(result.primaryInsight?.severity).toBe("warning");
  });

  it.each([
    { day: 3, expectedSeverity: "info" },
    { day: 15, expectedSeverity: "info" },
    { day: 16, expectedSeverity: "warning" },
    { day: 25, expectedSeverity: "warning" },
  ] as const)("reports the unpaid card as $expectedSeverity on day $day, never as an alert", ({ day, expectedSeverity }) => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        referenceDate: new Date(2026, 3, day, 12),
        creditCardExpenseCurrentMonth: 520_000,
        creditCardPreviousMonthStatement: 520_000,
        creditCardPaymentsCurrentMonth: 0,
        creditCardCurrentStatement: 520_000,
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    const unpaid = result.allInsights.find((insight) => insight.kind === "unpaid");
    expect(unpaid?.severity).toBe(expectedSeverity);
    expect(unpaid?.priority).toBe(980);
  });

  it("does not raise an excess spending alert or a critical state on day 5 with budgeted fixed income not yet received", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        referenceDate: new Date(2026, 3, 5, 12),
        availableCurrent: 300_000,
        creditCardCount: 0,
        incomeCurrentMonth: 0,
        expenseCurrentMonth: 200,
        savingCurrentMonth: 0,
        creditCardExpenseCurrentMonth: 0,
        creditCardPaymentsCurrentMonth: 0,
        creditCardPreviousMonthStatement: 0,
        creditCardRolledDebtCurrent: 0,
        creditCardDebtTotal: 0,
        creditCardCurrentStatement: 0,
        creditCardNextMonthCommitment: 0,
        projectedIncomeTotal: 1_000,
        projectedFixedIncome: 1_000,
        projectedExpenseTotal: 200,
        projectedExpenseVariable: 200,
        projectedBalance: 800,
        elapsedDaysCurrentMonth: 5,
        daysInCurrentMonth: 30,
        expenseByCategoryCurrentMonth: [
          { categoryId: "cat-food", categoryName: "Comida", amount: 200, behavior: "variable", transactionCount: 1 },
        ],
      }),
      t,
      currencyFormatter,
      intlLocale: "es-AR",
    });

    expect(result.allInsights.some((insight) => insight.id === "spending_excess_alert")).toBe(false);
    expect(result.financialState.level).not.toBe("critical");
  });

  it("returns partial payment insight when statement remains pending after payment", () => {
    const result = buildInsightsResult({
      context: buildBaseContext({
        creditCardExpenseCurrentMonth: 500_000,
        creditCardPreviousMonthStatement: 500_000,
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
        creditCardPreviousMonthStatement: 880_000,
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
        creditCardPreviousMonthStatement: 0,
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
        creditCardPreviousMonthStatement: 430_000,
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
        creditCardPreviousMonthStatement: 0,
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
  creditCardPreviousMonthStatement: 0,
  creditCardPaymentsCurrentMonth: 0,
  creditCardDebtTotal: 0,
  creditCardCurrentStatement: 0,
  creditCardNextMonthCommitment: 0,
};

const dominantCategoryExpense: Partial<InsightsContext> = {
  expenseCurrentMonth: 1_000_000,
  expenseByCategoryCurrentMonth: [
    { categoryId: "cat-market", categoryName: "Supermercado", amount: 620_000, behavior: "variable", transactionCount: 4 },
    { categoryId: "cat-food", categoryName: "Comida", amount: 380_000, behavior: "variable", transactionCount: 3 },
  ],
};

const highlyDominantCategoryExpense: Partial<InsightsContext> = {
  expenseCurrentMonth: 1_000_000,
  expenseByCategoryCurrentMonth: [
    { categoryId: "cat-market", categoryName: "Supermercado", amount: 800_000, behavior: "variable", transactionCount: 4 },
    { categoryId: "cat-food", categoryName: "Comida", amount: 200_000, behavior: "variable", transactionCount: 3 },
  ],
};

const budgetScenario = (
  budgeted: number,
  actual: number,
  overrides: Partial<InsightsContext> = {},
): Partial<InsightsContext> => ({
  variableExpenseBudgetTotal: budgeted,
  expenseBudgetByCategoryCurrentMonth: [
    { categoryId: "cat-food", categoryName: "Comida", expenseBehavior: "variable", budgeted, actual },
  ],
  ...overrides,
});

const renderingScenarios: Array<{ name: string; overrides: Partial<InsightsContext>; expectedKind: string | null }> = [
  {
    name: "unpaid",
    overrides: { creditCardPreviousMonthStatement: 520_000, creditCardPaymentsCurrentMonth: 0 },
    expectedKind: "unpaid",
  },
  {
    name: "rolled debt",
    overrides: { creditCardPreviousMonthStatement: 500_000, creditCardPaymentsCurrentMonth: 200_000 },
    expectedKind: "rolled_debt",
  },
  {
    name: "full payment",
    overrides: { creditCardPreviousMonthStatement: 430_000, creditCardPaymentsCurrentMonth: 450_000 },
    expectedKind: "full_payment",
  },
  { name: "high usage alert", overrides: { creditCardExpenseCurrentMonth: 1_200_000 }, expectedKind: "high_usage" },
  { name: "high usage warning", overrides: { creditCardExpenseCurrentMonth: 900_000 }, expectedKind: "high_usage" },
  { name: "high debt", overrides: { creditCardDebtTotal: 1_050_000 }, expectedKind: "high_debt" },
  {
    name: "next commitment",
    overrides: { creditCardNextMonthCommitment: 700_000 },
    expectedKind: "next_month_commitment",
  },
  {
    name: "acceleration",
    overrides: { creditCardExpenseCurrentMonthToDate: 600_000, creditCardExpensePreviousMonthToDate: 300_000 },
    expectedKind: "spending_acceleration",
  },
  {
    name: "excess spending",
    overrides: { projectedIncomeTotal: 850_000, projectedExpenseTotal: 980_000 },
    expectedKind: "excess_spending",
  },
  { name: "category imbalance moderate", overrides: dominantCategoryExpense, expectedKind: "category_imbalance" },
  { name: "category imbalance high", overrides: highlyDominantCategoryExpense, expectedKind: "category_imbalance" },
  { name: "budget exceeded", overrides: budgetScenario(200_000, 260_000), expectedKind: "budget_exceeded" },
  {
    name: "budget exceeded with others",
    overrides: budgetScenario(200_000, 260_000, {
      expenseBudgetByCategoryCurrentMonth: [
        { categoryId: "cat-food", categoryName: "Comida", expenseBehavior: "variable", budgeted: 200_000, actual: 260_000 },
        { categoryId: "cat-fun", categoryName: "Ocio", expenseBehavior: "variable", budgeted: 50_000, actual: 60_000 },
        { categoryId: "cat-taxi", categoryName: "Taxi", expenseBehavior: null, budgeted: 10_000, actual: 20_000 },
      ],
    }),
    expectedKind: "budget_exceeded",
  },
  { name: "budget at risk", overrides: budgetScenario(300_000, 260_000), expectedKind: "budget_at_risk" },
  { name: "budget pace below", overrides: budgetScenario(600_000, 260_000), expectedKind: "budget_pace_below" },
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
      buildBaseContext({ creditCardPreviousMonthStatement: 520_000, creditCardPaymentsCurrentMonth: 0 }),
    ).allInsights.find((insight) => insight.kind === "unpaid");
    const rolledDebt = buildRealResult(
      locale,
      "ARS",
      buildBaseContext({ creditCardPreviousMonthStatement: 500_000, creditCardPaymentsCurrentMonth: 200_000 }),
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
      buildBaseContext({ creditCardCount: 0, creditCardPreviousMonthStatement: 520_000, creditCardPaymentsCurrentMonth: 0 }),
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

  it("emits a single card usage alert when card spending is above the expected income", () => {
    const result = buildRealResult(
      "es",
      "ARS",
      buildBaseContext({ creditCardExpenseCurrentMonth: 1_200_000, creditCardCurrentStatement: 1_200_000 }),
    );

    const usageInsights = result.allInsights.filter((insight) => insight.kind === "high_usage");
    expect(usageInsights).toHaveLength(1);
    expect(usageInsights[0]?.kind).toBe("high_usage");
    expect(usageInsights[0]?.severity).toBe("alert");
  });
});

function buildResult(overrides: Partial<InsightsContext>) {
  return buildInsightsResult({
    context: buildBaseContext(overrides),
    t,
    currencyFormatter,
    intlLocale: "es-AR",
  });
}

function onDay(day: number): Partial<InsightsContext> {
  return { referenceDate: new Date(2026, 3, day, 12), elapsedDaysCurrentMonth: day, daysInCurrentMonth: 30 };
}

function findById(result: ReturnType<typeof buildInsightsResult>, id: string) {
  return result.allInsights.find((insight) => insight.id === id);
}

describe("credit card insights against the expected income (CA1)", () => {
  it("does not report high usage on day 5 when the salary is expected but not yet received", () => {
    const result = buildResult({
      ...onDay(5),
      incomeCurrentMonth: 50_000,
      projectedIncomeTotal: 1_050_000,
      creditCardExpenseCurrentMonth: 100_000,
      creditCardCurrentStatement: 100_000,
    });

    expect(result.allInsights.filter((insight) => insight.kind === "high_usage")).toEqual([]);
    const commitment = result.allInsights.find((insight) => insight.kind === "next_month_commitment");
    expect(commitment?.data?.incomeReference).toBe(1_050_000);
  });

  it("reports high debt as a warning, not an alert, against the expected income", () => {
    const result = buildResult({
      incomeCurrentMonth: 500_000,
      projectedIncomeTotal: 1_050_000,
      creditCardDebtTotal: 600_000,
    });

    const debtInsights = result.allInsights.filter((insight) => insight.kind === "high_debt");
    expect(debtInsights.map((insight) => insight.id)).toEqual(["credit_card_debt_warning"]);
    expect(debtInsights[0]?.severity).toBe("warning");
  });

  it("reports the next month commitment as a warning against the expected income", () => {
    const result = buildResult({
      incomeCurrentMonth: 500_000,
      projectedIncomeTotal: 1_050_000,
      creditCardNextMonthCommitment: 400_000,
    });

    const commitment = result.allInsights.find((insight) => insight.kind === "next_month_commitment");
    expect(commitment?.id).toBe("credit_card_next_commitment_warning");
    expect(commitment?.data?.nextMonthCommitmentVsIncome).toBeCloseTo(400_000 / 1_050_000);
  });

  it("skips usage and debt insights without an expected income", () => {
    const result = buildResult({
      incomeCurrentMonth: 1_000_000,
      projectedIncomeTotal: 0,
      creditCardExpenseCurrentMonth: 2_000_000,
      creditCardDebtTotal: 2_000_000,
    });

    expect(result.allInsights.some((insight) => insight.kind === "high_usage" || insight.kind === "high_debt")).toBe(
      false,
    );
    expect(result.allInsights.find((insight) => insight.kind === "next_month_commitment")?.severity).toBe("info");
  });
});

describe("credit card acceleration to date (CA2)", () => {
  it("does not flag acceleration when the month to date is only 10% above last month's", () => {
    const result = buildResult({
      creditCardPreviousMonthStatement: 6_000,
      creditCardExpenseCurrentMonth: 1_100,
      creditCardExpensePreviousMonthToDate: 1_000,
      creditCardExpenseCurrentMonthToDate: 1_100,
    });

    expect(result.allInsights.some((insight) => insight.kind === "spending_acceleration")).toBe(false);
  });

  it("flags acceleration as info on day 12 when the month to date is 30% above last month's", () => {
    const result = buildResult({
      ...onDay(12),
      creditCardPreviousMonthStatement: 6_000,
      creditCardExpenseCurrentMonth: 1_300,
      creditCardExpensePreviousMonthToDate: 1_000,
      creditCardExpenseCurrentMonthToDate: 1_300,
    });

    const acceleration = findById(result, "credit_card_acceleration");
    expect(acceleration?.severity).toBe("info");
    expect(acceleration?.priority).toBe(210);
  });

  it("flags acceleration as a warning when the month to date is 70% above last month's", () => {
    const result = buildResult({
      creditCardExpensePreviousMonthToDate: 1_000,
      creditCardExpenseCurrentMonthToDate: 1_700,
    });

    const acceleration = findById(result, "credit_card_acceleration");
    expect(acceleration?.severity).toBe("warning");
    expect(acceleration?.priority).toBe(230);
  });

  it("does not flag acceleration before day 10", () => {
    const result = buildResult({
      ...onDay(5),
      creditCardExpensePreviousMonthToDate: 1_000,
      creditCardExpenseCurrentMonthToDate: 2_000,
    });

    expect(result.allInsights.some((insight) => insight.kind === "spending_acceleration")).toBe(false);
  });

  it("does not flag acceleration without card spending last month to date", () => {
    const result = buildResult({
      creditCardExpensePreviousMonthToDate: 0,
      creditCardExpenseCurrentMonthToDate: 2_000,
    });

    expect(result.allInsights.some((insight) => insight.kind === "spending_acceleration")).toBe(false);
  });
});

describe("category imbalance over variable spending (CA3)", () => {
  function imbalanceOf(overrides: Partial<InsightsContext>) {
    return buildResult(overrides).allInsights.filter((insight) => insight.kind === "category_imbalance");
  }

  it("ignores a fixed rent that dominates the month", () => {
    expect(
      imbalanceOf({
        expenseCurrentMonth: 1_150,
        expenseByCategoryCurrentMonth: [
          { categoryId: "cat-rent", categoryName: "Alquiler", amount: 1_000, behavior: "fixed", transactionCount: 1 },
          { categoryId: "cat-food", categoryName: "Comida", amount: 100, behavior: "variable", transactionCount: 1 },
          { categoryId: "cat-bus", categoryName: "Transporte", amount: 50, behavior: "variable", transactionCount: 1 },
        ],
      }),
    ).toEqual([]);
  });

  it("reports a high imbalance as a warning when one variable category reaches 80% on day 15", () => {
    const insights = imbalanceOf({
      ...onDay(15),
      expenseByCategoryCurrentMonth: [
        { categoryId: "cat-rent", categoryName: "Alquiler", amount: 5_000, behavior: "fixed", transactionCount: 1 },
        { categoryId: "cat-market", categoryName: "Supermercado", amount: 800, behavior: "variable", transactionCount: 4 },
        { categoryId: "cat-food", categoryName: "Comida", amount: 200, behavior: "variable", transactionCount: 2 },
      ],
    });

    expect(insights.map((insight) => insight.id)).toEqual(["behavior_category_imbalance_high"]);
    expect(insights[0]?.severity).toBe("warning");
    expect(insights[0]?.data?.categoryId).toBe("cat-market");
    expect(insights[0]?.data?.topShare).toBeCloseTo(0.8);
  });

  it("reports a moderate imbalance as a warning at 60%", () => {
    const insights = imbalanceOf({
      ...onDay(15),
      expenseByCategoryCurrentMonth: [
        { categoryId: "cat-market", categoryName: "Supermercado", amount: 600, behavior: "variable", transactionCount: 4 },
        { categoryId: "cat-food", categoryName: "Comida", amount: 400, behavior: "variable", transactionCount: 2 },
      ],
    });

    expect(insights.map((insight) => insight.id)).toEqual(["behavior_category_imbalance_moderate"]);
    expect(insights[0]?.severity).toBe("warning");
  });

  it("does not report an imbalance before day 10", () => {
    expect(
      imbalanceOf({
        ...onDay(8),
        expenseByCategoryCurrentMonth: [
          { categoryId: "cat-market", categoryName: "Supermercado", amount: 800, behavior: "variable", transactionCount: 4 },
          { categoryId: "cat-food", categoryName: "Comida", amount: 200, behavior: "variable", transactionCount: 2 },
        ],
      }),
    ).toEqual([]);
  });

  it("does not report an imbalance with fewer than 5 variable expenses", () => {
    expect(
      imbalanceOf({
        expenseByCategoryCurrentMonth: [
          { categoryId: "cat-market", categoryName: "Supermercado", amount: 800, behavior: "variable", transactionCount: 2 },
          { categoryId: "cat-food", categoryName: "Comida", amount: 200, behavior: "variable", transactionCount: 2 },
        ],
      }),
    ).toEqual([]);
  });

  it("does not report an imbalance with a single variable category", () => {
    expect(
      imbalanceOf({
        expenseByCategoryCurrentMonth: [
          { categoryId: "cat-rent", categoryName: "Alquiler", amount: 1_000, behavior: "fixed", transactionCount: 1 },
          { categoryId: "cat-market", categoryName: "Supermercado", amount: 800, behavior: "variable", transactionCount: 6 },
        ],
      }),
    ).toEqual([]);
  });
});

describe("insight order (CA4)", () => {
  const variableImbalance: Partial<InsightsContext> = {
    expenseByCategoryCurrentMonth: [
      { categoryId: "cat-market", categoryName: "Supermercado", amount: 800, behavior: "variable", transactionCount: 4 },
      { categoryId: "cat-food", categoryName: "Comida", amount: 200, behavior: "variable", transactionCount: 2 },
    ],
  };

  it("orders alerts by priority: projected spending, card debt, card usage and next month commitment", () => {
    const result = buildResult({
      projectedIncomeTotal: 1_100_000,
      projectedExpenseTotal: 1_200_000,
      creditCardDebtTotal: 1_200_000,
      creditCardExpenseCurrentMonth: 1_200_000,
      creditCardNextMonthCommitment: 600_000,
    });

    expect(result.allInsights.filter((insight) => insight.severity === "alert").map((insight) => insight.id)).toEqual([
      "spending_excess_alert",
      "credit_card_debt_alert",
      "credit_card_usage_alert",
      "credit_card_next_commitment_alert",
    ]);
  });

  it("orders warnings by priority", () => {
    const warningOverrides: Partial<InsightsContext> = {
      ...variableImbalance,
      projectedIncomeTotal: 1_100_000,
      projectedExpenseTotal: 1_000_000,
      creditCardDebtTotal: 700_000,
      creditCardExpenseCurrentMonth: 950_000,
      creditCardNextMonthCommitment: 440_000,
      variableExpenseBudgetTotal: 100,
      expenseBudgetByCategoryCurrentMonth: [
        { categoryId: "cat-fun", categoryName: "Ocio", expenseBehavior: "variable", budgeted: 100, actual: 150 },
      ],
    };
    const withUnpaid = buildResult({
      ...warningOverrides,
      creditCardPreviousMonthStatement: 900_000,
      creditCardPaymentsCurrentMonth: 0,
    });
    const withRolledDebt = buildResult({
      ...warningOverrides,
      creditCardPreviousMonthStatement: 900_000,
      creditCardPaymentsCurrentMonth: 100_000,
    });

    const warnings = [...withUnpaid.allInsights, ...withRolledDebt.allInsights]
      .filter((insight) => insight.severity === "warning")
      .filter((insight, index, list) => list.findIndex((other) => other.id === insight.id) === index)
      .sort(compareInsightsByPriority);

    expect(warnings.map((insight) => insight.id)).toEqual([
      "spending_excess_warning",
      "credit_card_unpaid",
      "credit_card_next_commitment_warning",
      "credit_card_debt_warning",
      "budget_category_exceeded",
      "credit_card_usage_warning",
      "credit_card_rolled_debt",
      "behavior_category_imbalance_high",
    ]);
  });

  it("orders by severity first, then by priority, then by id", () => {
    const base = { module: "spending", kind: "excess_spending", title: "", message: "" } as const;
    const insights: Insight[] = [
      { ...base, id: "b", severity: "info", priority: 999 },
      { ...base, id: "c", severity: "warning", priority: 100 },
      { ...base, id: "a", severity: "warning", priority: 100 },
      { ...base, id: "d", severity: "warning", priority: 500 },
      { ...base, id: "e", severity: "alert", priority: 1 },
      { ...base, id: "f", severity: "positive", priority: 1_000 },
    ];

    expect([...insights].sort(compareInsightsByPriority).map((insight) => insight.id)).toEqual([
      "e",
      "d",
      "a",
      "c",
      "b",
      "f",
    ]);
  });

  it("keeps projected spending above an unpaid card in the dashboard slot", () => {
    const result = buildResult({
      projectedIncomeTotal: 1_100_000,
      projectedExpenseTotal: 1_000_000,
      creditCardPreviousMonthStatement: 900_000,
      creditCardPaymentsCurrentMonth: 0,
    });

    expect(result.primaryInsight?.id).toBe("spending_excess_warning");
  });
});

describe("budget insights (CA6, CA7, CA8)", () => {
  function budgetContext(
    categories: InsightCategoryBudget[],
    overrides: Partial<InsightsContext> = {},
  ): Partial<InsightsContext> {
    return {
      ...onDay(10),
      variableExpenseBudgetTotal: categories.reduce((total, category) => total + category.budgeted, 0),
      expenseBudgetByCategoryCurrentMonth: categories,
      ...overrides,
    };
  }

  function variable(categoryId: string, budgeted: number, actual: number): InsightCategoryBudget {
    return { categoryId, categoryName: categoryId, expenseBehavior: "variable", budgeted, actual };
  }

  function budgetInsightsOf(overrides: Partial<InsightsContext>) {
    return buildResult(overrides).allInsights.filter((insight) => insight.module === "budget");
  }

  it("reports a variable category at 60% on day 10 of 30 as at risk", () => {
    const insights = budgetInsightsOf(budgetContext([variable("Comida", 100, 60)]));

    expect(insights.map((insight) => [insight.id, insight.kind, insight.severity])).toEqual([
      ["budget_category_at_risk", "budget_at_risk", "info"],
    ]);
    expect(insights[0]?.priority).toBe(880);
  });

  it("reports a variable category at 110% as exceeded", () => {
    const insights = budgetInsightsOf(budgetContext([variable("Comida", 100, 110)]));

    expect(insights.map((insight) => [insight.id, insight.kind, insight.severity])).toEqual([
      ["budget_category_exceeded", "budget_exceeded", "warning"],
    ]);
    expect(insights[0]?.priority).toBe(830);
  });

  it("ignores a fixed category even at 150%", () => {
    expect(
      budgetInsightsOf(
        budgetContext([{ categoryId: "Alquiler", categoryName: "Alquiler", expenseBehavior: "fixed", budgeted: 100, actual: 150 }]),
      ),
    ).toEqual([]);
  });

  it("ignores a category without budget even with spending", () => {
    expect(
      budgetInsightsOf(budgetContext([variable("Comida", 0, 50)], { variableExpenseBudgetTotal: 100 })),
    ).toEqual([]);
  });

  it("groups every exceeded category in one insight, naming the largest overrun", () => {
    const result = buildRealResult(
      "es",
      "ARS",
      buildBaseContext(budgetContext([variable("Comida", 100, 130), variable("Ocio", 100, 150)])),
    );
    const exceeded = result.allInsights.filter((insight) => insight.kind === "budget_exceeded");

    expect(exceeded).toHaveLength(1);
    expect(exceeded[0]?.title).toContain("Ocio");
    expect(exceeded[0]?.message).toContain("Hay 1 categoría más en la misma situación.");
    expect(exceeded[0]?.data?.categoryIds).toEqual(["Ocio", "Comida"]);
  });

  it("reports an exceeded and an at risk category as two insights", () => {
    const insights = budgetInsightsOf(budgetContext([variable("Comida", 100, 130), variable("Ocio", 100, 60)]));

    expect(insights.map((insight) => insight.id).sort()).toEqual(["budget_category_at_risk", "budget_category_exceeded"]);
  });

  it("names the at risk category furthest ahead of the month pace and counts the others", () => {
    const result = buildRealResult(
      "en",
      "ARS",
      buildBaseContext(
        budgetContext([variable("Comida", 100, 50), variable("Ocio", 100, 90), variable("Taxi", 100, 70)]),
      ),
    );
    const atRisk = result.allInsights.find((insight) => insight.kind === "budget_at_risk");

    expect(atRisk?.title).toContain("Ocio");
    expect(atRisk?.message).toContain("2 more categories are in the same situation.");
  });

  it.each([
    [[variable("a", 100, 10), variable("b", 100, 45), variable("c", 100, 100), variable("d", 100, 100.01)]],
    [[variable("a", 100, 200), variable("b", 50, 49), variable("c", 0, 10), variable("d", 1_000, 433)]],
    [
      [
        { categoryId: "fixed", categoryName: "fixed", expenseBehavior: "fixed", budgeted: 100, actual: 500 },
        { categoryId: "none", categoryName: "none", expenseBehavior: null, budgeted: 100, actual: 90 },
        variable("e", 100, 44),
        variable("f", 100, 43),
      ] satisfies InsightCategoryBudget[],
    ],
  ])("counts the same categories as the budget page counter (%#)", (categories) => {
    const insights = budgetInsightsOf(budgetContext(categories));
    const flaggedIds = insights.flatMap((insight) => (insight.data?.categoryIds as string[] | undefined) ?? []);
    const counterIds = categories
      .filter((category) =>
        isBudgetCategoryAtRisk({
          type: "expense",
          expenseBehavior: category.expenseBehavior,
          budgeted: category.budgeted,
          actual: category.actual,
          monthElapsedRatio: 10 / 30,
        }),
      )
      .map((category) => category.categoryId);

    expect([...flaggedIds].sort()).toEqual([...counterIds].sort());
  });

  it("congratulates a variable pace 15% under budget", () => {
    const result = buildRealResult(
      "es",
      "ARS",
      buildBaseContext({
        ...onDay(15),
        variableExpenseBudgetTotal: 1_000,
        projectedExpenseVariable: 850,
      }),
    );
    const paceBelow = result.allInsights.find((insight) => insight.kind === "budget_pace_below");

    expect(paceBelow?.id).toBe("budget_variable_pace_below");
    expect(paceBelow?.severity).toBe("positive");
    expect(paceBelow?.title).toBe("Vas 15% por debajo de lo previsto en gastos variables");
  });

  it("does not congratulate a variable pace at 95% of the budget", () => {
    const insights = budgetInsightsOf({ ...onDay(15), variableExpenseBudgetTotal: 1_000, projectedExpenseVariable: 950 });

    expect(insights.some((insight) => insight.kind === "budget_pace_below")).toBe(false);
  });

  it("does not congratulate a variable pace before day 10", () => {
    const insights = budgetInsightsOf({ ...onDay(8), variableExpenseBudgetTotal: 1_000, projectedExpenseVariable: 850 });

    expect(insights.some((insight) => insight.kind === "budget_pace_below")).toBe(false);
  });

  it("does not congratulate a variable pace with fewer than 5 variable expenses", () => {
    const insights = budgetInsightsOf({
      ...onDay(15),
      variableExpenseBudgetTotal: 1_000,
      projectedExpenseVariable: 850,
      expenseByCategoryCurrentMonth: [
        { categoryId: "cat-food", categoryName: "Comida", amount: 100, behavior: "variable", transactionCount: 4 },
      ],
    });

    expect(insights.some((insight) => insight.kind === "budget_pace_below")).toBe(false);
  });

  it("omits the budget module without a variable budget", () => {
    const result = buildResult({});

    expect(result.modules.map((moduleResult) => moduleResult.module)).not.toContain("budget");
    expect(result.modules).toHaveLength(5);
  });

  it("shows the budget module after spending with a variable budget", () => {
    const result = buildResult({ variableExpenseBudgetTotal: 1_000 });

    expect(result.modules.map((moduleResult) => moduleResult.module)).toEqual([
      "credit_card",
      "spending",
      "budget",
      "behavior",
      "cashflow",
      "activity",
    ]);
    expect(result.modules[2]?.metadata.title).toBe("insightsV2.modules.budget.title");
  });
});

describe("insight wording with the real dictionary (CA9)", () => {
  it.each(supportedLocales)("never calls the category imbalance habitual or usual in %s", (locale) => {
    for (const overrides of [dominantCategoryExpense, highlyDominantCategoryExpense]) {
      const result = buildRealResult(locale, "ARS", buildBaseContext(overrides));
      const imbalance = result.allInsights.find((insight) => insight.kind === "category_imbalance");
      const behaviorModule = result.modules.find((moduleResult) => moduleResult.module === "behavior");

      expect(imbalance).toBeDefined();
      for (const text of [imbalance?.title ?? "", imbalance?.message ?? "", behaviorModule?.metadata.description ?? ""]) {
        expect(text.toLowerCase()).not.toMatch(/habitual|usual/);
      }
    }
  });

  it.each(supportedLocales)("describes card usage against the income you expect in %s", (locale) => {
    const usage = buildRealResult(locale, "ARS", buildBaseContext({ creditCardExpenseCurrentMonth: 900_000 })).allInsights.find(
      (insight) => insight.kind === "high_usage",
    );

    expect(usage?.message).toContain(locale === "es" ? "de lo que esperás cobrar este mes" : "of the income you expect this month");
  });

  it("compares card spending to the same point of last month", () => {
    const acceleration = buildRealResult(
      "es",
      "ARS",
      buildBaseContext({ creditCardExpensePreviousMonthToDate: 1_000, creditCardExpenseCurrentMonthToDate: 1_700 }),
    ).allInsights.find((insight) => insight.kind === "spending_acceleration");

    expect(acceleration?.message).toBe(
      `Llevás ${buildFormatter("es", "ARS").format(1_700)} con tarjeta este mes; a esta altura del mes pasado llevabas ${buildFormatter("es", "ARS").format(1_000)}.`,
    );
  });
});
