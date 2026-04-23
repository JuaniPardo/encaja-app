import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

type CashflowModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

const zeroTolerance = 0.005;

function createInsight(options: Omit<Insight, "module">): Insight {
  return {
    module: "cashflow",
    ...options,
  };
}

export function resolveCashflowModuleMetadata(t: TranslationFn): InsightModuleMetadata {
  return {
    module: "cashflow",
    title: t("insightsV2.modules.cashflow.title"),
    description: t("insightsV2.modules.cashflow.description"),
  };
}

export function generateCashflowInsights({
  context,
  t,
  currencyFormatter,
}: CashflowModuleOptions): Insight[] {
  if (context.elapsedDaysCurrentMonth < 7 || context.incomeCurrentMonth <= zeroTolerance) {
    return [];
  }

  const savingsRate = context.savingCurrentMonth / context.incomeCurrentMonth;
  if (savingsRate >= 0.08) {
    return [];
  }

  if (savingsRate <= zeroTolerance) {
    return [
      createInsight({
        id: "cashflow_low_saving_warning",
        kind: "low_saving",
        severity: "warning",
        priority: 660,
        impact: 3,
        urgency: 3,
        title: t("insightsV2.modules.cashflow.insights.lowSaving.warningTitle"),
        message: t("insightsV2.modules.cashflow.insights.lowSaving.warningMessage", undefined, {
          ratio: formatPercentValue(savingsRate, currencyFormatter),
        }),
        data: {
          savingsRate,
          savingCurrentMonth: context.savingCurrentMonth,
          incomeCurrentMonth: context.incomeCurrentMonth,
        },
      }),
    ];
  }

  return [
    createInsight({
      id: "cashflow_low_saving_info",
      kind: "low_saving",
      severity: "info",
      priority: 420,
      impact: 2,
      urgency: 2,
      title: t("insightsV2.modules.cashflow.insights.lowSaving.infoTitle"),
      message: t("insightsV2.modules.cashflow.insights.lowSaving.infoMessage", undefined, {
        ratio: formatPercentValue(savingsRate, currencyFormatter),
      }),
      data: {
        savingsRate,
        savingCurrentMonth: context.savingCurrentMonth,
        incomeCurrentMonth: context.incomeCurrentMonth,
      },
    }),
  ];
}
