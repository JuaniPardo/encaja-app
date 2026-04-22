import { compareInsightsByPriority } from "@/features/insights/priority";
import {
  generateCreditCardInsights,
  resolveCreditCardModuleMetadata,
  type TranslationFn,
} from "@/features/insights/modules/credit-card";
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
  const creditCardMetadata = resolveCreditCardModuleMetadata(t);
  const creditCardInsights = generateCreditCardInsights({
    context,
    t,
    currencyFormatter,
  }).sort(compareInsightsByPriority);

  const modules = [
    {
      module: "credit_card" as const,
      metadata: creditCardMetadata,
      insights: creditCardInsights,
    },
  ];

  const allInsights = modules.flatMap((moduleResult) => moduleResult.insights).sort(compareInsightsByPriority);
  const primaryInsight = allInsights[0] ?? null;

  return {
    allInsights,
    primaryInsight,
    modules,
  };
}
