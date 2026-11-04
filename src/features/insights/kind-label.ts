import type { TranslationFn } from "@/features/insights/intl";
import type { Insight, InsightKind } from "@/features/insights/types";

export const insightKindBadgeKey: Record<InsightKind, string> = {
  unpaid: "insightsV2.dashboard.kindBadge.pendingDebt",
  rolled_debt: "insightsV2.dashboard.kindBadge.pendingDebt",
  high_debt: "insightsV2.dashboard.kindBadge.highDebt",
  high_usage: "insightsV2.dashboard.kindBadge.highUsage",
  next_month_commitment: "insightsV2.dashboard.kindBadge.futureCommitment",
  spending_acceleration: "insightsV2.dashboard.kindBadge.cardAcceleration",
  excess_spending: "insightsV2.dashboard.kindBadge.expensePressure",
  category_imbalance: "insightsV2.dashboard.kindBadge.categoryImbalance",
  low_saving: "insightsV2.dashboard.kindBadge.lowSaving",
  low_activity: "insightsV2.dashboard.kindBadge.lowActivity",
  full_payment: "insightsV2.dashboard.kindBadge.controlled",
  stable: "insightsV2.dashboard.kindBadge.controlled",
  budget_exceeded: "insightsV2.dashboard.kindBadge.budgetExceeded",
  budget_at_risk: "insightsV2.dashboard.kindBadge.budgetAtRisk",
  budget_pace_below: "insightsV2.dashboard.kindBadge.budgetUnderPace",
};

export function resolveInsightKindLabel(insight: Pick<Insight, "kind">, t: TranslationFn) {
  return t(insightKindBadgeKey[insight.kind]);
}
