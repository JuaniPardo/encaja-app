export interface DashboardOnboardingCtaVisibilitySignals {
  paymentMethodCount: number;
  hasAnyTransactions: boolean;
}

function toSafeCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

export function shouldShowDashboardOnboardingCta(
  signals: DashboardOnboardingCtaVisibilitySignals,
) {
  const paymentMethodCount = toSafeCount(signals.paymentMethodCount);

  return paymentMethodCount === 0 || !signals.hasAnyTransactions;
}
