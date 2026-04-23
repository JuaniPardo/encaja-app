import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

type SpendingModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

const zeroTolerance = 0.005;

function createInsight(options: Omit<Insight, "module">): Insight {
  return {
    module: "spending",
    ...options,
  };
}

export function resolveSpendingModuleMetadata(t: TranslationFn): InsightModuleMetadata {
  return {
    module: "spending",
    title: t("insightsV2.modules.spending.title"),
    description: t("insightsV2.modules.spending.description"),
  };
}

export function generateSpendingInsights({
  context,
  t,
  currencyFormatter,
}: SpendingModuleOptions): Insight[] {
  const insights: Insight[] = [];
  const projectedExpense = context.projectedExpenseTotal;
  const projectedIncome = context.projectedIncomeTotal;

  if (projectedIncome > zeroTolerance) {
    const projectedExpenseVsIncome = projectedExpense / projectedIncome;

    if (projectedExpenseVsIncome >= 1) {
      insights.push(
        createInsight({
          id: "spending_excess_alert",
          kind: "excess_spending",
          severity: "alert",
          priority: 940,
          impact: 5,
          urgency: 5,
          title: t("insightsV2.modules.spending.insights.excessSpending.alertTitle"),
          message: t("insightsV2.modules.spending.insights.excessSpending.alertMessage", undefined, {
            ratio: formatPercentValue(projectedExpenseVsIncome, currencyFormatter),
          }),
          data: {
            projectedExpenseVsIncome,
            projectedExpense,
            projectedIncome,
          },
        }),
      );
    } else if (projectedExpenseVsIncome >= 0.85) {
      insights.push(
        createInsight({
          id: "spending_excess_warning",
          kind: "excess_spending",
          severity: "warning",
          priority: 760,
          impact: 4,
          urgency: 4,
          title: t("insightsV2.modules.spending.insights.excessSpending.warningTitle"),
          message: t("insightsV2.modules.spending.insights.excessSpending.warningMessage", undefined, {
            ratio: formatPercentValue(projectedExpenseVsIncome, currencyFormatter),
          }),
          data: {
            projectedExpenseVsIncome,
            projectedExpense,
            projectedIncome,
          },
        }),
      );
    }
  } else if (projectedExpense > zeroTolerance && context.availableCurrent > zeroTolerance) {
    const projectedExpenseVsAvailability = projectedExpense / context.availableCurrent;
    if (projectedExpenseVsAvailability >= 1) {
      insights.push(
        createInsight({
          id: "spending_excess_without_income",
          kind: "excess_spending",
          severity: "warning",
          priority: 730,
          impact: 4,
          urgency: 4,
          title: t("insightsV2.modules.spending.insights.excessSpending.noIncomeTitle"),
          message: t("insightsV2.modules.spending.insights.excessSpending.noIncomeMessage", undefined, {
            projectedExpense: currencyFormatter.format(projectedExpense),
            availableAmount: currencyFormatter.format(context.availableCurrent),
          }),
          data: {
            projectedExpense,
            availableCurrent: context.availableCurrent,
          },
        }),
      );
    }
  }

  return insights;
}
