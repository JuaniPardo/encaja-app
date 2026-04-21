import { roundMoney } from "@/features/dashboard/lib/dashboard-math";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

export type TranslationFn = (
  key: string,
  fallback?: string,
  values?: Record<string, string | number>,
) => string;

type CreditCardModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

export const creditCardModuleMetadataKey = "credit_card" as const;

function formatPercentValue(value: number, formatter: Intl.NumberFormat) {
  return `${formatter.format(roundMoney(value * 100))}%`;
}

function createInsight(options: Omit<Insight, "module">): Insight {
  return {
    module: "credit_card",
    ...options,
  };
}

export function resolveCreditCardModuleMetadata(t: TranslationFn): InsightModuleMetadata {
  return {
    module: "credit_card",
    title: t("insightsV2.modules.creditCard.title"),
    description: t("insightsV2.modules.creditCard.description"),
  };
}

export function generateCreditCardInsights({
  context,
  t,
  currencyFormatter,
}: CreditCardModuleOptions): Insight[] {
  if (context.creditCardCount === 0) {
    return [
      createInsight({
        id: "credit_card_stable",
        kind: "stable",
        severity: "info",
        priority: 120,
        title: t("insightsV2.modules.creditCard.insights.stable.title"),
        message: t("insightsV2.modules.creditCard.insights.stable.message"),
      }),
    ];
  }

  const insights: Insight[] = [];
  const tolerance = 0.005;

  const totalIncome = context.incomeCurrentMonth;
  const monthlyCardExpense = context.creditCardExpenseCurrentMonth;
  const previousMonthCardExpense = context.creditCardExpensePreviousMonth;
  const monthlyCardPayments = context.creditCardPaymentsCurrentMonth;
  const totalDebt = context.creditCardDebtTotal;
  const currentStatement = context.creditCardCurrentStatement;
  const nextMonthInstallments = context.creditCardNextMonthInstallments;

  const hasIncome = totalIncome > tolerance;
  const hasPreviousStatementToPay = previousMonthCardExpense > tolerance;

  if (hasPreviousStatementToPay) {
    if (monthlyCardPayments > tolerance && monthlyCardPayments + tolerance < previousMonthCardExpense) {
      insights.push(
        createInsight({
          id: "credit_card_rolled_debt",
          kind: "rolled_debt",
          severity: "warning",
          priority: 810,
          title: t("insightsV2.modules.creditCard.insights.rolledDebt.title"),
          message: t("insightsV2.modules.creditCard.insights.rolledDebt.message"),
          data: {
            monthlyCardPayments,
            previousMonthCardExpense,
          },
        }),
      );
    } else if (monthlyCardPayments > tolerance && monthlyCardPayments + tolerance >= previousMonthCardExpense) {
      insights.push(
        createInsight({
          id: "credit_card_full_payment",
          kind: "full_payment",
          severity: "positive",
          priority: 300,
          title: t("insightsV2.modules.creditCard.insights.fullPayment.title"),
          message: t("insightsV2.modules.creditCard.insights.fullPayment.message"),
          data: {
            monthlyCardPayments,
          },
        }),
      );
    } else {
      insights.push(
        createInsight({
          id: "credit_card_unpaid",
          kind: "unpaid",
          severity: "alert",
          priority: 980,
          title: t("insightsV2.modules.creditCard.insights.unpaid.title"),
          message: t("insightsV2.modules.creditCard.insights.unpaid.message"),
          data: {
            monthlyCardPayments,
            previousMonthCardExpense,
          },
        }),
      );
    }
  }

  if (hasIncome) {
    const expenseVsIncome = monthlyCardExpense / totalIncome;
    if (expenseVsIncome >= 1) {
      insights.push(
        createInsight({
          id: "credit_card_usage_alert",
          kind: "high_usage",
          severity: "alert",
          priority: 930,
          title: t("insightsV2.modules.creditCard.insights.highUsage.alertTitle"),
          message: t("insightsV2.modules.creditCard.insights.highUsage.alertMessage", undefined, {
            ratio: formatPercentValue(expenseVsIncome, currencyFormatter),
          }),
          data: {
            expenseVsIncome,
          },
        }),
      );
    } else if (expenseVsIncome >= 0.8) {
      insights.push(
        createInsight({
          id: "credit_card_usage_warning",
          kind: "high_usage",
          severity: "warning",
          priority: 820,
          title: t("insightsV2.modules.creditCard.insights.highUsage.warningTitle"),
          message: t("insightsV2.modules.creditCard.insights.highUsage.warningMessage", undefined, {
            ratio: formatPercentValue(expenseVsIncome, currencyFormatter),
          }),
          data: {
            expenseVsIncome,
          },
        }),
      );
    }

    const debtVsIncome = totalDebt / totalIncome;
    if (debtVsIncome >= 1) {
      insights.push(
        createInsight({
          id: "credit_card_debt_alert",
          kind: "high_debt",
          severity: "alert",
          priority: 950,
          title: t("insightsV2.modules.creditCard.insights.highDebt.alertTitle"),
          message: t("insightsV2.modules.creditCard.insights.highDebt.alertMessage", undefined, {
            debtAmount: currencyFormatter.format(totalDebt),
          }),
          data: {
            debtVsIncome,
          },
        }),
      );
    } else if (debtVsIncome > 0.5) {
      insights.push(
        createInsight({
          id: "credit_card_debt_warning",
          kind: "high_debt",
          severity: "warning",
          priority: 850,
          title: t("insightsV2.modules.creditCard.insights.highDebt.warningTitle"),
          message: t("insightsV2.modules.creditCard.insights.highDebt.warningMessage", undefined, {
            debtAmount: currencyFormatter.format(totalDebt),
          }),
          data: {
            debtVsIncome,
          },
        }),
      );
    }

    const currentStatementVsIncome = currentStatement / totalIncome;
    if (currentStatementVsIncome >= 0.5) {
      insights.push(
        createInsight({
          id: "credit_card_statement_alert",
          kind: "high_statement",
          severity: "alert",
          priority: 780,
          title: t("insightsV2.modules.creditCard.insights.statementPressure.alertTitle"),
          message: t("insightsV2.modules.creditCard.insights.statementPressure.alertMessage", undefined, {
            statementAmount: currencyFormatter.format(currentStatement),
          }),
          data: {
            currentStatementVsIncome,
          },
        }),
      );
    } else if (currentStatementVsIncome >= 0.35) {
      insights.push(
        createInsight({
          id: "credit_card_statement_warning",
          kind: "high_statement",
          severity: "warning",
          priority: 760,
          title: t("insightsV2.modules.creditCard.insights.statementPressure.warningTitle"),
          message: t("insightsV2.modules.creditCard.insights.statementPressure.warningMessage", undefined, {
            statementAmount: currencyFormatter.format(currentStatement),
          }),
          data: {
            currentStatementVsIncome,
          },
        }),
      );
    }

    const nextMonthInstallmentsVsIncome = nextMonthInstallments / totalIncome;
    if (nextMonthInstallmentsVsIncome >= 0.5) {
      insights.push(
        createInsight({
          id: "credit_card_next_commitment_alert",
          kind: "next_month_commitment",
          severity: "alert",
          priority: 740,
          title: t("insightsV2.modules.creditCard.insights.nextCommitment.alertTitle"),
          message: t("insightsV2.modules.creditCard.insights.nextCommitment.alertMessage", undefined, {
            amount: currencyFormatter.format(nextMonthInstallments),
          }),
          data: {
            nextMonthInstallmentsVsIncome,
          },
        }),
      );
    } else if (nextMonthInstallmentsVsIncome >= 0.35) {
      insights.push(
        createInsight({
          id: "credit_card_next_commitment_warning",
          kind: "next_month_commitment",
          severity: "warning",
          priority: 720,
          title: t("insightsV2.modules.creditCard.insights.nextCommitment.warningTitle"),
          message: t("insightsV2.modules.creditCard.insights.nextCommitment.warningMessage", undefined, {
            amount: currencyFormatter.format(nextMonthInstallments),
          }),
          data: {
            nextMonthInstallmentsVsIncome,
          },
        }),
      );
    } else if (nextMonthInstallmentsVsIncome >= 0.2) {
      insights.push(
        createInsight({
          id: "credit_card_next_commitment_info",
          kind: "next_month_commitment",
          severity: "info",
          priority: 700,
          title: t("insightsV2.modules.creditCard.insights.nextCommitment.infoTitle"),
          message: t("insightsV2.modules.creditCard.insights.nextCommitment.infoMessage", undefined, {
            amount: currencyFormatter.format(nextMonthInstallments),
          }),
          data: {
            nextMonthInstallmentsVsIncome,
          },
        }),
      );
    }
  }

  if (previousMonthCardExpense > tolerance && monthlyCardExpense > previousMonthCardExpense * 1.2) {
    const ratio = monthlyCardExpense / previousMonthCardExpense;
    insights.push(
      createInsight({
        id: "credit_card_acceleration",
        kind: "spending_acceleration",
        severity: ratio >= 1.6 ? "warning" : "info",
        priority: ratio >= 1.6 ? 230 : 210,
        title: t("insightsV2.modules.creditCard.insights.acceleration.title"),
        message: t("insightsV2.modules.creditCard.insights.acceleration.message", undefined, {
          previousAmount: currencyFormatter.format(previousMonthCardExpense),
          currentAmount: currencyFormatter.format(monthlyCardExpense),
        }),
        data: {
          ratio,
        },
      }),
    );
  }

  if (insights.length === 0) {
    insights.push(
      createInsight({
        id: "credit_card_stable",
        kind: "stable",
        severity: "info",
        priority: 120,
        title: t("insightsV2.modules.creditCard.insights.stable.title"),
        message: t("insightsV2.modules.creditCard.insights.stable.message"),
      }),
    );
  }

  return insights;
}
