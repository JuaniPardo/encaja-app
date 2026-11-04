import type { InsightsResult } from "@/features/insights/types";

export type DashboardFinancialStateView = "hidden" | "loading" | "error" | "ready";

export type DashboardPrimarySlotView = "onboarding" | "loading" | "error" | "insight" | "empty";

type ResolveDashboardInsightsViewOptions = {
  shouldShowOnboardingCta: boolean;
  isLoading: boolean;
  hasError: boolean;
  result: InsightsResult | null;
};

export function resolveDashboardInsightsView({
  shouldShowOnboardingCta,
  isLoading,
  hasError,
  result,
}: ResolveDashboardInsightsViewOptions): {
  financialState: DashboardFinancialStateView;
  primarySlot: DashboardPrimarySlotView;
} {
  if (shouldShowOnboardingCta) {
    return { financialState: "hidden", primarySlot: "onboarding" };
  }

  if (result) {
    return { financialState: "ready", primarySlot: result.primaryInsight ? "insight" : "empty" };
  }

  if (hasError) {
    return { financialState: "error", primarySlot: "error" };
  }

  if (isLoading) {
    return { financialState: "loading", primarySlot: "loading" };
  }

  return { financialState: "error", primarySlot: "error" };
}
