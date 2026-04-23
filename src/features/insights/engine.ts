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
import type { TranslationFn } from "@/features/insights/intl";
import type { InsightsContext, InsightsResult } from "@/features/insights/types";

type BuildInsightsResultOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

export function buildInsightsResult({
  context,
  t,
  currencyFormatter,
}: BuildInsightsResultOptions): InsightsResult {
  const financialState = resolveFinancialState({
    context,
    t,
    currencyFormatter,
  });

  const creditCardMetadata = resolveCreditCardModuleMetadata(t);
  const creditCardInsights = generateCreditCardInsights({
    context,
    t,
    currencyFormatter,
  }).sort(compareInsightsByPriority);
  const spendingMetadata = resolveSpendingModuleMetadata(t);
  const spendingInsights = generateSpendingInsights({
    context,
    t,
    currencyFormatter,
  }).sort(compareInsightsByPriority);
  const behaviorMetadata = resolveBehaviorModuleMetadata(t);
  const behaviorInsights = generateBehaviorInsights({
    context,
    t,
    currencyFormatter,
  }).sort(compareInsightsByPriority);
  const cashflowMetadata = resolveCashflowModuleMetadata(t);
  const cashflowInsights = generateCashflowInsights({
    context,
    t,
    currencyFormatter,
  }).sort(compareInsightsByPriority);
  const activityMetadata = resolveActivityModuleMetadata(t);
  const activityInsights = generateActivityInsights({
    context,
    t,
  }).sort(compareInsightsByPriority);

  const modules = [
    {
      module: "credit_card" as const,
      metadata: creditCardMetadata,
      insights: creditCardInsights,
    },
    {
      module: "spending" as const,
      metadata: spendingMetadata,
      insights: spendingInsights,
    },
    {
      module: "behavior" as const,
      metadata: behaviorMetadata,
      insights: behaviorInsights,
    },
    {
      module: "cashflow" as const,
      metadata: cashflowMetadata,
      insights: cashflowInsights,
    },
    {
      module: "activity" as const,
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
