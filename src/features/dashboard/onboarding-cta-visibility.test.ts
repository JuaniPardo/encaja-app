import { describe, expect, it } from "vitest";

import { shouldShowDashboardOnboardingCta } from "@/features/dashboard/onboarding-cta-visibility";

describe("shouldShowDashboardOnboardingCta", () => {
  it("returns true when there are no payment methods", () => {
    expect(
      shouldShowDashboardOnboardingCta({
        paymentMethodCount: 0,
        hasAnyTransactions: true,
      }),
    ).toBe(true);
  });

  it("returns true when there are no transactions", () => {
    expect(
      shouldShowDashboardOnboardingCta({
        paymentMethodCount: 2,
        hasAnyTransactions: false,
      }),
    ).toBe(true);
  });

  it("returns false when setup is sufficient", () => {
    expect(
      shouldShowDashboardOnboardingCta({
        paymentMethodCount: 2,
        hasAnyTransactions: true,
      }),
    ).toBe(false);
  });

  it("normalizes invalid payment method counts", () => {
    expect(
      shouldShowDashboardOnboardingCta({
        paymentMethodCount: Number.NaN,
        hasAnyTransactions: true,
      }),
    ).toBe(true);
  });
});
