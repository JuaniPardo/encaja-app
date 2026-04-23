import { roundMoney } from "@/features/dashboard/lib/dashboard-math";
import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import type { FinancialState, FinancialStateLevel, InsightsContext } from "@/features/insights/types";

type ResolveFinancialStateOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

const zeroTolerance = 0.005;

function resolveIncomeReference(context: InsightsContext) {
  if (context.projectedIncomeTotal > zeroTolerance) {
    return context.projectedIncomeTotal;
  }

  if (context.incomeCurrentMonth > zeroTolerance) {
    return context.incomeCurrentMonth;
  }

  return null;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, roundMoney(value)));
}

function resolvePressureScore({
  futurePressureVsIncome,
  futurePressureVsAvailable,
  projectedBalance,
  incomeReference,
}: {
  futurePressureVsIncome: number | null;
  futurePressureVsAvailable: number | null;
  projectedBalance: number;
  incomeReference: number | null;
}) {
  const incomePressure = futurePressureVsIncome === null ? 0 : futurePressureVsIncome * 55;
  const availabilityPressure = futurePressureVsAvailable === null ? 0 : futurePressureVsAvailable * 35;
  const projectionPressure =
    incomeReference === null || incomeReference <= zeroTolerance || projectedBalance >= 0
      ? 0
      : Math.abs(projectedBalance) / incomeReference * 40;

  return clampScore(incomePressure + availabilityPressure + projectionPressure);
}

function resolveFinancialStateLevel({
  futurePressureAmount,
  futurePressureVsIncome,
  futurePressureVsAvailable,
  projectedExpenseVsIncome,
  projectedBalance,
  availableCurrent,
}: {
  futurePressureAmount: number;
  futurePressureVsIncome: number | null;
  futurePressureVsAvailable: number | null;
  projectedExpenseVsIncome: number | null;
  projectedBalance: number;
  availableCurrent: number;
}): FinancialStateLevel {
  if (
    (futurePressureVsAvailable !== null && futurePressureVsAvailable >= 1.15) ||
    (futurePressureVsIncome !== null && futurePressureVsIncome >= 0.9) ||
    projectedBalance < -zeroTolerance
  ) {
    return "critical";
  }

  if (
    (futurePressureVsAvailable !== null && futurePressureVsAvailable >= 0.8) ||
    (futurePressureVsIncome !== null && futurePressureVsIncome >= 0.6) ||
    (projectedExpenseVsIncome !== null && projectedExpenseVsIncome >= 0.95)
  ) {
    return "attention";
  }

  if (futurePressureAmount > zeroTolerance && availableCurrent <= zeroTolerance && futurePressureVsIncome === null) {
    return "attention";
  }

  if (
    (futurePressureVsIncome === null || futurePressureVsIncome < 0.35) &&
    (futurePressureVsAvailable === null || futurePressureVsAvailable < 0.5) &&
    projectedBalance >= -zeroTolerance
  ) {
    return "healthy";
  }

  return "stable";
}

export function resolveFinancialState({
  context,
  t,
  currencyFormatter,
}: ResolveFinancialStateOptions): FinancialState {
  const availableCurrent = roundMoney(context.availableCurrent);
  const futurePressureAmount = roundMoney(
    Math.max(
      0,
      context.creditCardExpenseCurrentMonth +
        context.creditCardNextMonthCommitment +
        context.creditCardRolledDebtCurrent,
    ),
  );
  const incomeReference = resolveIncomeReference(context);
  const futurePressureVsIncome =
    incomeReference === null || incomeReference <= zeroTolerance ? null : futurePressureAmount / incomeReference;
  const futurePressureVsAvailable =
    availableCurrent <= zeroTolerance ? null : futurePressureAmount / availableCurrent;
  const projectedExpenseVsIncome =
    incomeReference === null || incomeReference <= zeroTolerance
      ? null
      : context.projectedExpenseTotal / incomeReference;

  const level = resolveFinancialStateLevel({
    futurePressureAmount,
    futurePressureVsIncome,
    futurePressureVsAvailable,
    projectedExpenseVsIncome,
    projectedBalance: context.projectedBalance,
    availableCurrent,
  });

  const values = {
    availableAmount: currencyFormatter.format(availableCurrent),
    futurePressureAmount: currencyFormatter.format(futurePressureAmount),
    projectedVariableExpense: currencyFormatter.format(context.projectedExpenseVariable),
    projectedBalance: currencyFormatter.format(context.projectedBalance),
    pressureRatio:
      futurePressureVsIncome === null ? "-" : formatPercentValue(futurePressureVsIncome, currencyFormatter),
  };
  const messageKey =
    futurePressureVsIncome === null
      ? `insightsV2.financialState.levels.${level}.messageNoIncome`
      : `insightsV2.financialState.levels.${level}.message`;

  return {
    level,
    title: t(`insightsV2.financialState.levels.${level}.title`),
    message: t(messageKey, undefined, values),
    pressureScore: resolvePressureScore({
      futurePressureVsIncome,
      futurePressureVsAvailable,
      projectedBalance: context.projectedBalance,
      incomeReference,
    }),
    data: {
      availableCurrent,
      futurePressureAmount,
      futurePressureVsIncome: futurePressureVsIncome === null ? null : roundMoney(futurePressureVsIncome),
      projectedExpenseVariable: roundMoney(context.projectedExpenseVariable),
      projectedBalance: roundMoney(context.projectedBalance),
    },
  };
}
