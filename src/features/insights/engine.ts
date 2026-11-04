import { compareInsightsByPriority } from "@/features/insights/priority";
import { resolveFinancialState } from "@/features/insights/financial-state";
import {
  generateCreditCardInsights,
  resolveCreditCardModuleMetadata,
} from "@/features/insights/modules/credit-card";
import { generateBehaviorInsights, resolveBehaviorModuleMetadata } from "@/features/insights/modules/behavior";
import { generateSpendingInsights, resolveSpendingModuleMetadata } from "@/features/insights/modules/spending";
import { generateCashflowInsights, resolveCashflowModuleMetadata } from "@/features/insights/modules/cashflow";
import { generateActivityInsights, resolveActivityModuleMetadata } from "@/features/insights/modules/activity";
import { createPercentFormatter, type TranslationFn } from "@/features/insights/intl";
import type { InsightModuleResult, InsightsContext, InsightsResult } from "@/features/insights/types";

type BuildInsightsResultOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
  intlLocale: string;
};

export function buildInsightsResult({
  context,
  t,
  currencyFormatter,
  intlLocale,
}: BuildInsightsResultOptions): InsightsResult {
  const percentFormatter = createPercentFormatter(intlLocale);
  const financialState = resolveFinancialState({
    context,
    t,
    currencyFormatter,
    percentFormatter,
  });

  const creditCardMetadata = resolveCreditCardModuleMetadata(t);
  const creditCardInsights = generateCreditCardInsights({
    context,
    t,
    currencyFormatter,
    percentFormatter,
  }).sort(compareInsightsByPriority);
  const spendingMetadata = resolveSpendingModuleMetadata(t);
  const spendingInsights = generateSpendingInsights({
    context,
    t,
    currencyFormatter,
    percentFormatter,
  }).sort(compareInsightsByPriority);
  const behaviorMetadata = resolveBehaviorModuleMetadata(t);
  const behaviorInsights = generateBehaviorInsights({
    context,
    t,
    percentFormatter,
  }).sort(compareInsightsByPriority);
  const cashflowMetadata = resolveCashflowModuleMetadata(t);
  const cashflowInsights = generateCashflowInsights({
    context,
    t,
    percentFormatter,
  }).sort(compareInsightsByPriority);
  const activityMetadata = resolveActivityModuleMetadata(t);
  const activityInsights = generateActivityInsights({
    context,
    t,
  }).sort(compareInsightsByPriority);

  const creditCardModule: InsightModuleResult[] =
    context.creditCardCount === 0
      ? []
      : [
          {
            module: "credit_card",
            metadata: creditCardMetadata,
            insights: creditCardInsights,
          },
        ];

  const modules: InsightModuleResult[] = [
    ...creditCardModule,
    {
      module: "spending",
      metadata: spendingMetadata,
      insights: spendingInsights,
    },
    {
      module: "behavior",
      metadata: behaviorMetadata,
      insights: behaviorInsights,
    },
    {
      module: "cashflow",
      metadata: cashflowMetadata,
      insights: cashflowInsights,
    },
    {
      module: "activity",
      metadata: activityMetadata,
      insights: activityInsights,
    },
  ];

  const allInsights = modules.flatMap((moduleResult) => moduleResult.insights).sort(compareInsightsByPriority);
  const primaryInsight = allInsights[0] ?? null;

  return {
    financialState,
    allInsights,
    primaryInsight,
    modules,
  };
}
