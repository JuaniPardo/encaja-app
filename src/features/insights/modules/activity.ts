import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";
import type { TranslationFn } from "@/features/insights/intl";

type ActivityModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
};

function createInsight(options: Omit<Insight, "module">): Insight {
  return {
    module: "activity",
    ...options,
  };
}

export function resolveActivityModuleMetadata(t: TranslationFn): InsightModuleMetadata {
  return {
    module: "activity",
    title: t("insightsV2.modules.activity.title"),
    description: t("insightsV2.modules.activity.description"),
  };
}

export function generateActivityInsights({ context, t }: ActivityModuleOptions): Insight[] {
  const elapsedDays = context.elapsedDaysCurrentMonth;
  const transactionsCount = context.relevantTransactionCountCurrentMonth;

  if (elapsedDays < 10) {
    return [];
  }

  if (elapsedDays >= 20 && transactionsCount === 0) {
    return [
      createInsight({
        id: "activity_low_alert",
        kind: "low_activity",
        severity: "warning",
        priority: 540,
        impact: 2,
        urgency: 3,
        title: t("insightsV2.modules.activity.insights.lowActivity.warningTitle"),
        message: t("insightsV2.modules.activity.insights.lowActivity.warningMessage", undefined, {
          days: elapsedDays,
        }),
        data: {
          elapsedDays,
          transactionsCount,
        },
      }),
    ];
  }

  if (transactionsCount <= 2) {
    return [
      createInsight({
        id: "activity_low_info",
        kind: "low_activity",
        severity: "info",
        priority: 320,
        impact: 1,
        urgency: 2,
        title: t("insightsV2.modules.activity.insights.lowActivity.infoTitle"),
        message: t("insightsV2.modules.activity.insights.lowActivity.infoMessage", undefined, {
          count: transactionsCount,
        }),
        data: {
          elapsedDays,
          transactionsCount,
        },
      }),
    ];
  }

  return [];
}
