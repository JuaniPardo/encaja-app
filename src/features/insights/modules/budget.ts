import { resolveBudgetCategoryRisk } from "@/features/budget/line-status";
import { countVariableExpenseTransactions } from "@/features/insights/context-math";
import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import {
  INSIGHT_ZERO_TOLERANCE,
  MIN_ELAPSED_DAYS_FOR_PACE_SIGNALS,
  MIN_VARIABLE_EXPENSE_COUNT,
} from "@/features/insights/thresholds";
import type {
  Insight,
  InsightCategoryBudget,
  InsightModuleMetadata,
  InsightsContext,
} from "@/features/insights/types";

type BudgetModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
  percentFormatter: Intl.NumberFormat;
};

const PACE_BELOW_MAX_PROJECTED_RATIO = 0.9;

function createInsight(options: Omit<Insight, "module">): Insight {
  return {
    module: "budget",
    ...options,
  };
}

export function resolveBudgetModuleMetadata(t: TranslationFn): InsightModuleMetadata {
  return {
    module: "budget",
    title: t("insightsV2.modules.budget.title"),
    description: t("insightsV2.modules.budget.description"),
  };
}

function resolveMonthElapsedRatio(context: InsightsContext) {
  return context.daysInCurrentMonth > 0 ? context.elapsedDaysCurrentMonth / context.daysInCurrentMonth : 0;
}

function appendOthersSentence(message: string, othersCount: number, t: TranslationFn) {
  if (othersCount <= 0) {
    return message;
  }

  const othersSentence =
    othersCount === 1
      ? t("insightsV2.modules.budget.insights.others.one")
      : t("insightsV2.modules.budget.insights.others.other", undefined, { count: othersCount });

  return `${message} ${othersSentence}`;
}

function compareByExceededAmount(left: InsightCategoryBudget, right: InsightCategoryBudget) {
  const diff = right.actual - right.budgeted - (left.actual - left.budgeted);
  return diff !== 0 ? diff : left.categoryId.localeCompare(right.categoryId);
}

function compareByUsedRatio(left: InsightCategoryBudget, right: InsightCategoryBudget) {
  const diff = right.actual / right.budgeted - left.actual / left.budgeted;
  return diff !== 0 ? diff : left.categoryId.localeCompare(right.categoryId);
}

export function generateBudgetInsights({
  context,
  t,
  currencyFormatter,
  percentFormatter,
}: BudgetModuleOptions): Insight[] {
  const insights: Insight[] = [];
  const monthElapsedRatio = resolveMonthElapsedRatio(context);

  const exceeded: InsightCategoryBudget[] = [];
  const atRisk: InsightCategoryBudget[] = [];
  for (const category of context.expenseBudgetByCategoryCurrentMonth) {
    const risk = resolveBudgetCategoryRisk({
      type: "expense",
      expenseBehavior: category.expenseBehavior,
      budgeted: category.budgeted,
      actual: category.actual,
      monthElapsedRatio,
    });

    if (risk === "exceeded") {
      exceeded.push(category);
    } else if (risk === "atRisk") {
      atRisk.push(category);
    }
  }

  exceeded.sort(compareByExceededAmount);
  const mainExceeded = exceeded[0];
  if (mainExceeded) {
    insights.push(
      createInsight({
        id: "budget_category_exceeded",
        kind: "budget_exceeded",
        severity: "warning",
        priority: 830,
        title: t("insightsV2.modules.budget.insights.exceeded.title", undefined, {
          categoryName: mainExceeded.categoryName,
        }),
        message: appendOthersSentence(
          t("insightsV2.modules.budget.insights.exceeded.message", undefined, {
            actualAmount: currencyFormatter.format(mainExceeded.actual),
            budgetAmount: currencyFormatter.format(mainExceeded.budgeted),
          }),
          exceeded.length - 1,
          t,
        ),
        data: {
          categoryId: mainExceeded.categoryId,
          categoryIds: exceeded.map((category) => category.categoryId),
          budgeted: mainExceeded.budgeted,
          actual: mainExceeded.actual,
        },
      }),
    );
  }

  atRisk.sort(compareByUsedRatio);
  const mainAtRisk = atRisk[0];
  if (mainAtRisk) {
    const usedRatio = mainAtRisk.actual / mainAtRisk.budgeted;
    insights.push(
      createInsight({
        id: "budget_category_at_risk",
        kind: "budget_at_risk",
        severity: "info",
        priority: 880,
        title: t("insightsV2.modules.budget.insights.atRisk.title", undefined, {
          categoryName: mainAtRisk.categoryName,
        }),
        message: appendOthersSentence(
          t("insightsV2.modules.budget.insights.atRisk.message", undefined, {
            usedRatio: formatPercentValue(usedRatio, percentFormatter),
            actualAmount: currencyFormatter.format(mainAtRisk.actual),
            budgetAmount: currencyFormatter.format(mainAtRisk.budgeted),
            elapsedRatio: formatPercentValue(monthElapsedRatio, percentFormatter),
          }),
          atRisk.length - 1,
          t,
        ),
        data: {
          categoryId: mainAtRisk.categoryId,
          categoryIds: atRisk.map((category) => category.categoryId),
          usedRatio,
          monthElapsedRatio,
        },
      }),
    );
  }

  const variableBudget = context.variableExpenseBudgetTotal;
  const projectedVariable = context.projectedExpenseVariable;
  if (
    variableBudget > INSIGHT_ZERO_TOLERANCE &&
    context.elapsedDaysCurrentMonth >= MIN_ELAPSED_DAYS_FOR_PACE_SIGNALS &&
    countVariableExpenseTransactions(context.expenseByCategoryCurrentMonth) >= MIN_VARIABLE_EXPENSE_COUNT &&
    projectedVariable <= variableBudget * PACE_BELOW_MAX_PROJECTED_RATIO
  ) {
    const belowRatio = 1 - projectedVariable / variableBudget;
    insights.push(
      createInsight({
        id: "budget_variable_pace_below",
        kind: "budget_pace_below",
        severity: "positive",
        priority: 320,
        title: t("insightsV2.modules.budget.insights.paceBelow.title", undefined, {
          ratio: formatPercentValue(belowRatio, percentFormatter),
        }),
        message: t("insightsV2.modules.budget.insights.paceBelow.message", undefined, {
          projectedAmount: currencyFormatter.format(projectedVariable),
          budgetAmount: currencyFormatter.format(variableBudget),
        }),
        data: {
          belowRatio,
          projectedVariable,
          variableBudget,
        },
      }),
    );
  }

  return insights;
}
