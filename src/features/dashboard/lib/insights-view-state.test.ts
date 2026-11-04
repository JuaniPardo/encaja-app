import { describe, expect, it } from "vitest";

import type { Insight, InsightsResult } from "@/features/insights/types";

import { resolveDashboardInsightsView } from "./insights-view-state";

const primaryInsight: Insight = {
  id: "spending_excess_alert",
  module: "spending",
  kind: "excess_spending",
  severity: "alert",
  title: "title",
  message: "message",
  priority: 940,
};

function buildResult(overrides: Partial<InsightsResult> = {}): InsightsResult {
  return {
    financialState: {
      level: "healthy",
      title: "Saludable",
      message: "message",
      pressureScore: 0,
      data: {
        availableCurrent: 0,
        futurePressureAmount: 0,
        futurePressureVsIncome: null,
        projectedExpenseVariable: 0,
        projectedBalance: 0,
      },
    },
    allInsights: [primaryInsight],
    primaryInsight,
    modules: [],
    ...overrides,
  };
}

describe("resolveDashboardInsightsView", () => {
  it("hides the financial state while the onboarding CTA is shown", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: true,
        isLoading: false,
        hasError: false,
        result: buildResult(),
      }),
    ).toEqual({ financialState: "hidden", primarySlot: "onboarding" });
  });

  it("shows skeletons during the first load", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: false,
        isLoading: true,
        hasError: false,
        result: null,
      }),
    ).toEqual({ financialState: "loading", primarySlot: "loading" });
  });

  it("shows the error state when insights fail without a result", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: false,
        isLoading: false,
        hasError: true,
        result: null,
      }),
    ).toEqual({ financialState: "error", primarySlot: "error" });
  });

  it("never reports a ready state without a computed result", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: false,
        isLoading: false,
        hasError: false,
        result: null,
      }).financialState,
    ).not.toBe("ready");
  });

  it("shows the primary insight once the result is ready", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: false,
        isLoading: false,
        hasError: false,
        result: buildResult(),
      }),
    ).toEqual({ financialState: "ready", primarySlot: "insight" });
  });

  it("shows the empty slot when the result has no primary insight", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: false,
        isLoading: false,
        hasError: false,
        result: buildResult({ allInsights: [], primaryInsight: null }),
      }),
    ).toEqual({ financialState: "ready", primarySlot: "empty" });
  });

  it("keeps the previous result without skeletons while reloading", () => {
    expect(
      resolveDashboardInsightsView({
        shouldShowOnboardingCta: false,
        isLoading: true,
        hasError: false,
        result: buildResult(),
      }),
    ).toEqual({ financialState: "ready", primarySlot: "insight" });
  });
});
