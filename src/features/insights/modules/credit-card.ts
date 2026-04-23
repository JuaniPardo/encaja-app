import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

type CreditCardModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
};

export const creditCardModuleMetadataKey = "credit_card" as const;

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
  const statementCurrent = context.creditCardCurrentStatement;
  const nextMonthCommitment = context.creditCardNextMonthCommitment;

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

    const currentStatementVsIncome = statementCurrent / totalIncome;
    if (currentStatementVsIncome >= 0.5) {
      insights.push(
        createInsight({
          id: "credit_card_statement_alert",
          kind: "high_statement",
          severity: "alert",
          priority: 710,
          title: t("insightsV2.modules.creditCard.insights.statementPressure.alertTitle"),
          message: t("insightsV2.modules.creditCard.insights.statementPressure.alertMessage", undefined, {
            statementAmount: currencyFormatter.format(statementCurrent),
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
          priority: 690,
          title: t("insightsV2.modules.creditCard.insights.statementPressure.warningTitle"),
          message: t("insightsV2.modules.creditCard.insights.statementPressure.warningMessage", undefined, {
            statementAmount: currencyFormatter.format(statementCurrent),
          }),
          data: {
            currentStatementVsIncome,
          },
        }),
      );
    }

  }

  if (nextMonthCommitment > tolerance) {
    const formattedCommitment = currencyFormatter.format(nextMonthCommitment);
    const nextMonthCommitmentVsIncome = hasIncome ? nextMonthCommitment / totalIncome : null;

    if (nextMonthCommitmentVsIncome !== null && nextMonthCommitmentVsIncome >= 0.5) {
      insights.push(
        createInsight({
          id: "credit_card_next_commitment_alert",
          kind: "next_month_commitment",
          severity: "alert",
          priority: 915,
          title: t("insightsV2.modules.creditCard.insights.nextCommitment.alertTitle", undefined, {
            amount: formattedCommitment,
          }),
          message: t("insightsV2.modules.creditCard.insights.nextCommitment.alertMessage"),
          data: {
            nextMonthCommitmentVsIncome,
            statementCurrent,
            nextMonthCommitment,
            incomeReference: totalIncome,
          },
        }),
      );
    } else if (nextMonthCommitmentVsIncome !== null && nextMonthCommitmentVsIncome >= 0.35) {
      insights.push(
        createInsight({
          id: "credit_card_next_commitment_warning",
          kind: "next_month_commitment",
          severity: "warning",
          priority: 900,
          title: t("insightsV2.modules.creditCard.insights.nextCommitment.warningTitle", undefined, {
            amount: formattedCommitment,
          }),
          message: t("insightsV2.modules.creditCard.insights.nextCommitment.warningMessage"),
          data: {
            nextMonthCommitmentVsIncome,
            statementCurrent,
            nextMonthCommitment,
            incomeReference: totalIncome,
          },
        }),
      );
    } else {
      insights.push(
        createInsight({
          id: "credit_card_next_commitment_info",
          kind: "next_month_commitment",
          severity: "info",
          priority: 870,
          title: t("insightsV2.modules.creditCard.insights.nextCommitment.infoTitle", undefined, {
            amount: formattedCommitment,
          }),
          message: t("insightsV2.modules.creditCard.insights.nextCommitment.infoMessage"),
          data: {
            nextMonthCommitmentVsIncome,
            statementCurrent,
            nextMonthCommitment,
            incomeReference: totalIncome,
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
