import { countVariableExpenseTransactions } from "@/features/insights/context-math";
import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import {
  INSIGHT_ZERO_TOLERANCE,
  MIN_ELAPSED_DAYS_FOR_PACE_SIGNALS,
  MIN_VARIABLE_EXPENSE_COUNT,
} from "@/features/insights/thresholds";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

type BehaviorModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  percentFormatter: Intl.NumberFormat;
};

const MIN_VARIABLE_CATEGORIES_WITH_EXPENSE = 2;
const MODERATE_IMBALANCE_SHARE = 0.55;
const HIGH_IMBALANCE_SHARE = 0.75;

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
  percentFormatter,
}: BehaviorModuleOptions): Insight[] {
  if (context.elapsedDaysCurrentMonth < MIN_ELAPSED_DAYS_FOR_PACE_SIGNALS) {
    return [];
  }

  if (countVariableExpenseTransactions(context.expenseByCategoryCurrentMonth) < MIN_VARIABLE_EXPENSE_COUNT) {
    return [];
  }

  const variableCategories = context.expenseByCategoryCurrentMonth
    .filter((category) => category.behavior === "variable" && category.amount > INSIGHT_ZERO_TOLERANCE)
    .sort((left, right) => right.amount - left.amount);
  if (variableCategories.length < MIN_VARIABLE_CATEGORIES_WITH_EXPENSE) {
    return [];
  }

  const totalVariableExpense = variableCategories.reduce((total, category) => total + category.amount, 0);
  const topCategory = variableCategories[0];
  if (!topCategory || totalVariableExpense <= INSIGHT_ZERO_TOLERANCE) {
    return [];
  }

  const topShare = topCategory.amount / totalVariableExpense;
  if (topShare < MODERATE_IMBALANCE_SHARE) {
    return [];
  }

  const isHigh = topShare >= HIGH_IMBALANCE_SHARE;

  return [
    createInsight({
      id: isHigh ? "behavior_category_imbalance_high" : "behavior_category_imbalance_moderate",
      kind: "category_imbalance",
      severity: "warning",
      priority: isHigh ? 700 : 680,
      title: isHigh
        ? t("insightsV2.modules.behavior.insights.categoryImbalance.highTitle", undefined, {
            categoryName: topCategory.categoryName,
          })
        : t("insightsV2.modules.behavior.insights.categoryImbalance.moderateTitle", undefined, {
            categoryName: topCategory.categoryName,
          }),
      message: t("insightsV2.modules.behavior.insights.categoryImbalance.message", undefined, {
        ratio: formatPercentValue(topShare, percentFormatter),
      }),
      data: {
        categoryId: topCategory.categoryId,
        topShare,
        topAmount: topCategory.amount,
        totalVariableExpense,
      },
    }),
  ];
}
