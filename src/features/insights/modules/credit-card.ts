import { formatPercentValue, type TranslationFn } from "@/features/insights/intl";
import { INSIGHT_ZERO_TOLERANCE, MIN_ELAPSED_DAYS_FOR_PACE_SIGNALS } from "@/features/insights/thresholds";
import type { Insight, InsightModuleMetadata, InsightsContext } from "@/features/insights/types";

type CreditCardModuleOptions = {
  context: InsightsContext;
  t: TranslationFn;
  currencyFormatter: Intl.NumberFormat;
  percentFormatter: Intl.NumberFormat;
};

export const creditCardModuleMetadataKey = "credit_card" as const;

const UNPAID_WARNING_FROM_DAY = 16;
const ACCELERATION_INFO_RATIO = 1.2;
const ACCELERATION_WARNING_RATIO = 1.6;

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
  percentFormatter,
}: CreditCardModuleOptions): Insight[] {
  if (context.creditCardCount === 0) {
    return [];
  }

  const insights: Insight[] = [];
  const tolerance = INSIGHT_ZERO_TOLERANCE;

  const expectedIncome = context.projectedIncomeTotal;
  const monthlyCardExpense = context.creditCardExpenseCurrentMonth;
  const previousStatement = context.creditCardPreviousMonthStatement;
  const monthlyCardPayments = context.creditCardPaymentsCurrentMonth;
  const totalDebt = context.creditCardDebtTotal;
  const statementCurrent = context.creditCardCurrentStatement;
  const nextMonthCommitment = context.creditCardNextMonthCommitment;

  const hasIncome = expectedIncome > tolerance;
  const hasPreviousStatementToPay = previousStatement > tolerance;

  if (hasPreviousStatementToPay) {
    if (monthlyCardPayments > tolerance && monthlyCardPayments + tolerance < previousStatement) {
      insights.push(
        createInsight({
          id: "credit_card_rolled_debt",
          kind: "rolled_debt",
          severity: "warning",
          priority: 810,
          title: t("insightsV2.modules.creditCard.insights.rolledDebt.title"),
          message: t("insightsV2.modules.creditCard.insights.rolledDebt.message", undefined, {
            paidAmount: currencyFormatter.format(monthlyCardPayments),
          }),
          data: {
            monthlyCardPayments,
            previousStatement,
          },
        }),
      );
    } else if (monthlyCardPayments > tolerance && monthlyCardPayments + tolerance >= previousStatement) {
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
          severity: context.referenceDate.getDate() >= UNPAID_WARNING_FROM_DAY ? "warning" : "info",
          priority: 980,
          title: t("insightsV2.modules.creditCard.insights.unpaid.title"),
          message: t("insightsV2.modules.creditCard.insights.unpaid.message"),
          data: {
            monthlyCardPayments,
            previousStatement,
          },
        }),
      );
    }
  }

  if (hasIncome) {
    const expenseVsIncome = monthlyCardExpense / expectedIncome;
    if (expenseVsIncome >= 1) {
      insights.push(
        createInsight({
          id: "credit_card_usage_alert",
          kind: "high_usage",
          severity: "alert",
          priority: 930,
          title: t("insightsV2.modules.creditCard.insights.highUsage.alertTitle"),
          message: t("insightsV2.modules.creditCard.insights.highUsage.alertMessage", undefined, {
            ratio: formatPercentValue(expenseVsIncome, percentFormatter),
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
            ratio: formatPercentValue(expenseVsIncome, percentFormatter),
          }),
          data: {
            expenseVsIncome,
          },
        }),
      );
    }

    const debtVsIncome = totalDebt / expectedIncome;
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
  }

  if (nextMonthCommitment > tolerance) {
    const formattedCommitment = currencyFormatter.format(nextMonthCommitment);
    const nextMonthCommitmentVsIncome = hasIncome ? nextMonthCommitment / expectedIncome : null;

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
            incomeReference: expectedIncome,
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
            incomeReference: expectedIncome,
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
            incomeReference: expectedIncome,
          },
        }),
      );
    }
  }

  const currentCardExpenseToDate = context.creditCardExpenseCurrentMonthToDate;
  const previousCardExpenseToDate = context.creditCardExpensePreviousMonthToDate;
  if (
    context.elapsedDaysCurrentMonth >= MIN_ELAPSED_DAYS_FOR_PACE_SIGNALS &&
    previousCardExpenseToDate > tolerance &&
    currentCardExpenseToDate > previousCardExpenseToDate * ACCELERATION_INFO_RATIO
  ) {
    const ratio = currentCardExpenseToDate / previousCardExpenseToDate;
    const isWarning = ratio >= ACCELERATION_WARNING_RATIO;
    insights.push(
      createInsight({
        id: "credit_card_acceleration",
        kind: "spending_acceleration",
        severity: isWarning ? "warning" : "info",
        priority: isWarning ? 230 : 210,
        title: t("insightsV2.modules.creditCard.insights.acceleration.title"),
        message: t("insightsV2.modules.creditCard.insights.acceleration.message", undefined, {
          previousAmount: currencyFormatter.format(previousCardExpenseToDate),
          currentAmount: currencyFormatter.format(currentCardExpenseToDate),
        }),
        data: {
          ratio,
          currentCardExpenseToDate,
          previousCardExpenseToDate,
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
