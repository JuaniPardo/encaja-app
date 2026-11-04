import { roundMoney } from "@/features/dashboard/lib/dashboard-math";
import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import type {
  FinancialState,
  FinancialStateLevel,
  FinancialStateReason,
  InsightsContext,
} from "@/features/insights/types";

type ResolveFinancialStateOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
  percentFormatter: Intl.NumberFormat;
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

type FinancialStateLevelResult = {
  level: FinancialStateLevel;
  reason: FinancialStateReason;
};

function resolveFinancialStateLevel({
  futurePressureAmount,
  futurePressureVsIncome,
  futurePressureVsAvailable,
  projectedExpenseVsIncome,
  projectedBalance,
  availableCurrent,
  hasExpectedFixedIncome,
  isMonthClosed,
}: {
  futurePressureAmount: number;
  futurePressureVsIncome: number | null;
  futurePressureVsAvailable: number | null;
  projectedExpenseVsIncome: number | null;
  projectedBalance: number;
  availableCurrent: number;
  hasExpectedFixedIncome: boolean;
  isMonthClosed: boolean;
}): FinancialStateLevelResult {
  const hasProjectedDeficit = projectedBalance < -zeroTolerance;

  if (futurePressureVsAvailable !== null && futurePressureVsAvailable >= 1.15) {
    return { level: "critical", reason: "pressureOverAvailable" };
  }

  if (futurePressureVsIncome !== null && futurePressureVsIncome >= 0.9) {
    return { level: "critical", reason: "pressureOverIncome" };
  }

  if (hasProjectedDeficit && (hasExpectedFixedIncome || isMonthClosed)) {
    return { level: "critical", reason: "projectedDeficit" };
  }

  if (futurePressureVsAvailable !== null && futurePressureVsAvailable >= 0.8) {
    return { level: "attention", reason: "pressureOverAvailable" };
  }

  if (futurePressureVsIncome !== null && futurePressureVsIncome >= 0.6) {
    return { level: "attention", reason: "pressureOverIncome" };
  }

  if (projectedExpenseVsIncome !== null && projectedExpenseVsIncome >= 0.95) {
    return { level: "attention", reason: "expenseNearIncome" };
  }

  if (futurePressureAmount > zeroTolerance && availableCurrent <= zeroTolerance && futurePressureVsIncome === null) {
    return { level: "attention", reason: "pressureWithoutAvailable" };
  }

  if (hasProjectedDeficit) {
    return { level: "attention", reason: "projectedDeficitWithoutFixedIncome" };
  }

  const reason: FinancialStateReason = futurePressureAmount > zeroTolerance ? "margin" : "marginWithoutCard";

  if (
    (futurePressureVsIncome === null || futurePressureVsIncome < 0.35) &&
    (futurePressureVsAvailable === null || futurePressureVsAvailable < 0.5)
  ) {
    return { level: "healthy", reason };
  }

  return { level: "stable", reason };
}

export function resolveFinancialState({
  context,
  t,
  currencyFormatter,
  percentFormatter,
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

  const { level, reason } = resolveFinancialStateLevel({
    futurePressureAmount,
    futurePressureVsIncome,
    futurePressureVsAvailable,
    projectedExpenseVsIncome,
    projectedBalance: context.projectedBalance,
    availableCurrent,
    hasExpectedFixedIncome: context.projectedFixedIncome > zeroTolerance,
    isMonthClosed: context.elapsedDaysCurrentMonth >= context.daysInCurrentMonth,
  });

  const formatRatio = (ratio: number | null) =>
    ratio === null ? "-" : formatPercentValue(ratio, percentFormatter);
  const values = {
    availableAmount: currencyFormatter.format(availableCurrent),
    futurePressureAmount: currencyFormatter.format(futurePressureAmount),
    projectedBalance: currencyFormatter.format(context.projectedBalance),
    pressureRatio: formatRatio(futurePressureVsIncome),
    availableRatio: formatRatio(futurePressureVsAvailable),
    expenseRatio: formatRatio(projectedExpenseVsIncome),
  };

  return {
    level,
    reason,
    title: t(`insightsV2.financialState.levels.${level}.title`),
    message: t(`insightsV2.financialState.reasons.${reason}`, undefined, values),
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
