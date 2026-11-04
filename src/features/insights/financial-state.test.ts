import { describe, expect, it } from "vitest";

import { buildSafeCurrencyFormatter } from "@/features/dashboard/lib/dashboard-math";
import { resolveIntlLocale, supportedLocales } from "@/features/i18n/config";
import { getTranslation } from "@/features/i18n/dictionaries";
import { resolveFinancialState } from "@/features/insights/financial-state";
import { createPercentFormatter } from "@/features/insights/intl";
import type { InsightsContext } from "@/features/insights/types";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const t = (key: string) => key;
const percentFormatter = createPercentFormatter("es-AR");

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
    creditCardPreviousMonthStatement: 240_000,
    creditCardRolledDebtCurrent: -10_000,
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
      percentFormatter,
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
      percentFormatter,
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
      percentFormatter,
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
      percentFormatter,
    });

    expect(state.level).toBe("critical");
  });
});

const CURRENCY_NEXT_TO_PERCENT = /(\$|Bs|US\$|ARS|BOB)\s?-?\d[\d.,]*\s?%/;

const levelScenarios = [
  {
    level: "healthy",
    expectedRatio: "14%",
    overrides: {
      availableCurrent: 1_200_000,
      creditCardExpenseCurrentMonth: 120_000,
      creditCardNextMonthCommitment: 50_000,
      projectedBalance: 420_000,
    },
  },
  {
    level: "stable",
    expectedRatio: "38%",
    overrides: {
      availableCurrent: 850_000,
      creditCardExpenseCurrentMonth: 280_000,
      creditCardNextMonthCommitment: 170_000,
      projectedBalance: 120_000,
    },
  },
  {
    level: "attention",
    expectedRatio: "51%",
    overrides: {
      availableCurrent: 650_000,
      creditCardExpenseCurrentMonth: 360_000,
      creditCardNextMonthCommitment: 240_000,
      projectedBalance: 40_000,
    },
  },
  {
    level: "critical",
    expectedRatio: "84%",
    overrides: {
      availableCurrent: 300_000,
      creditCardExpenseCurrentMonth: 520_000,
      creditCardNextMonthCommitment: 460_000,
      projectedBalance: -150_000,
    },
  },
] as const;

const financialStateMatrix = supportedLocales.flatMap((locale) =>
  ["ARS", "BOB"].flatMap((currencyCode) =>
    levelScenarios.flatMap((scenario) =>
      [true, false].map((withIncome) => ({ locale, currencyCode, withIncome, ...scenario })),
    ),
  ),
);

describe("resolveFinancialState with the real dictionary", () => {
  it.each(financialStateMatrix)(
    "renders the $level state in $locale with $currencyCode (income: $withIncome)",
    ({ locale, currencyCode, withIncome, level, expectedRatio, overrides }) => {
      const intlLocale = resolveIntlLocale(locale);
      const state = resolveFinancialState({
        context: buildBaseContext({
          ...overrides,
          ...(withIncome ? {} : { incomeCurrentMonth: 0, projectedIncomeTotal: 0 }),
        }),
        t: (key, fallback, values) => getTranslation(locale, key, fallback, values),
        currencyFormatter: buildSafeCurrencyFormatter(intlLocale, currencyCode, false, currencyFormatter),
        percentFormatter: createPercentFormatter(intlLocale),
      });

      if (withIncome) {
        expect(state.level).toBe(level);
        expect(state.message).toContain(expectedRatio);
      }

      for (const text of [state.title, state.message]) {
        expect(text).not.toContain("{{");
        expect(text.startsWith("insightsV2.")).toBe(false);
        expect(text).not.toMatch(CURRENCY_NEXT_TO_PERCENT);
      }
    },
  );
});
