import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

type BehaviorModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

const zeroTolerance = 0.005;

function createInsight(options: Omit<Insight, "module">): Insight {
  return {
    module: "behavior",
    ...options,
  };
}

export function resolveBehaviorModuleMetadata(t: TranslationFn): InsightModuleMetadata {
  return {
    module: "behavior",
    title: t("insightsV2.modules.behavior.title"),
    description: t("insightsV2.modules.behavior.description"),
  };
}

export function generateBehaviorInsights({
  context,
  t,
  currencyFormatter,
}: BehaviorModuleOptions): Insight[] {
  const totalExpense = context.expenseCurrentMonth;
  if (totalExpense <= zeroTolerance || context.expenseByCategoryCurrentMonth.length === 0) {
    return [];
  }

  const topCategory = [...context.expenseByCategoryCurrentMonth].sort((left, right) => right.amount - left.amount)[0];
  if (!topCategory) {
    return [];
  }

  const topShare = topCategory.amount / totalExpense;
  if (topShare < 0.55) {
    return [];
  }

  if (topShare >= 0.75) {
    return [
      createInsight({
        id: "behavior_category_imbalance_alert",
        kind: "category_imbalance",
        severity: "alert",
        priority: 820,
        impact: 4,
        urgency: 4,
        title: t("insightsV2.modules.behavior.insights.categoryImbalance.alertTitle"),
        message: t("insightsV2.modules.behavior.insights.categoryImbalance.alertMessage", undefined, {
          categoryName: topCategory.categoryName,
          ratio: formatPercentValue(topShare, currencyFormatter),
        }),
        data: {
          categoryId: topCategory.categoryId,
          topShare,
          topAmount: topCategory.amount,
          totalExpense,
        },
      }),
    ];
  }

  return [
    createInsight({
      id: "behavior_category_imbalance_warning",
      kind: "category_imbalance",
      severity: "warning",
      priority: 680,
      impact: 3,
      urgency: 3,
      title: t("insightsV2.modules.behavior.insights.categoryImbalance.warningTitle"),
      message: t("insightsV2.modules.behavior.insights.categoryImbalance.warningMessage", undefined, {
        categoryName: topCategory.categoryName,
        ratio: formatPercentValue(topShare, currencyFormatter),
      }),
      data: {
        categoryId: topCategory.categoryId,
        topShare,
        topAmount: topCategory.amount,
        totalExpense,
      },
    }),
  ];
}
