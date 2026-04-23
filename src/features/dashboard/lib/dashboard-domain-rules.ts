import { localeCompareByName } from "@/features/i18n/formatting";
import type {
  DashboardLocale,
  FinancialSummary,
  PaymentMethodBalanceRow,
  TransactionLiteRow,
} from "@/features/dashboard/types/dashboard";

import { parseAmountValue, roundMoney } from "./dashboard-math";

export const dashboardAdjustmentSystemKeys = [
  "balance_adjustment",
  "expense_manual_adjustment",
] as const;

export function buildGovernedDateRangeFilter(start: string, end: string) {
  return [
    `and(effective_date.gte.${start},effective_date.lt.${end})`,
    `and(effective_date.is.null,transaction_date.gte.${start},transaction_date.lt.${end})`,
  ].join(",");
}

export function buildGovernedDateBeforeFilter(end: string) {
  return [
    `effective_date.lt.${end}`,
    `and(effective_date.is.null,transaction_date.lt.${end})`,
  ].join(",");
}

type BuildFinancialSummaryOptions = {
  locale: DashboardLocale;
  transactionRows: TransactionLiteRow[];
  allTransactionsImpact: Map<string, number>;
  nextMonthCommitmentByMethodId: Map<string, number>;
  previousMonthStatementByMethodId: Map<string, number>;
  currentMonthPaymentsByMethodId: Map<string, number>;
  paymentMethodRows: PaymentMethodBalanceRow[];
};

export function buildFinancialSummary({
  locale,
  transactionRows,
  allTransactionsImpact,
  nextMonthCommitmentByMethodId,
  previousMonthStatementByMethodId,
  currentMonthPaymentsByMethodId,
  paymentMethodRows,
}: BuildFinancialSummaryOptions): FinancialSummary {
  const monthImpactByMethodId = new Map<string, number>();
  const monthConsumptionByMethodId = new Map<string, number>();

  for (const row of transactionRows) {
    if (!row.payment_method_id) {
      continue;
    }

    const parsedAmount = parseAmountValue(row.amount);
    let signedAmount = 0;

    if (row.type === "income") {
      signedAmount = parsedAmount;
    } else if (row.type === "expense" || row.type === "saving") {
      signedAmount = -parsedAmount;
    } else if (row.type === "transfer") {
      if (row.direction === "in") {
        signedAmount = parsedAmount;
      } else if (row.direction === "out") {
        signedAmount = -parsedAmount;
      }
    }

    const previousImpact = monthImpactByMethodId.get(row.payment_method_id) ?? 0;
    monthImpactByMethodId.set(row.payment_method_id, roundMoney(previousImpact + signedAmount));

    if (row.type === "expense") {
      const previousConsumption = monthConsumptionByMethodId.get(row.payment_method_id) ?? 0;
      monthConsumptionByMethodId.set(
        row.payment_method_id,
        roundMoney(previousConsumption + parsedAmount),
      );
    }
  }

  const activeIncludedRows = paymentMethodRows
    .filter((row) => row.is_active && row.include_in_balance)
    .map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      currentBalance: roundMoney((row.current_balance ?? 0) + (allTransactionsImpact.get(row.id) ?? 0)),
      monthImpact: roundMoney(monthImpactByMethodId.get(row.id) ?? 0),
    }))
    .sort((a, b) => localeCompareByName(a.name, b.name, locale));

  const availabilityRows = activeIncludedRows
    .filter((row) => row.type !== "credit_card")
    .sort((a, b) => {
      if (b.currentBalance !== a.currentBalance) {
        return b.currentBalance - a.currentBalance;
      }
      return localeCompareByName(a.name, b.name, locale);
    });

  const creditCardRows = activeIncludedRows
    .filter((row) => row.type === "credit_card")
    .map((row) => {
      const previousMonthStatement = roundMoney(previousMonthStatementByMethodId.get(row.id) ?? 0);
      const monthPayments = roundMoney(currentMonthPaymentsByMethodId.get(row.id) ?? 0);
      const monthConsumption = roundMoney(monthConsumptionByMethodId.get(row.id) ?? 0);
      const rolledDebt = roundMoney(previousMonthStatement - monthPayments);
      const nextMonthInstallments = roundMoney(nextMonthCommitmentByMethodId.get(row.id) ?? 0);

      return {
        id: row.id,
        name: row.name,
        type: "credit_card" as const,
        previousMonthStatement,
        monthPayments,
        monthConsumption,
        rolledDebt,
        nextMonthInstallments,
      };
    })
    .sort((a, b) => {
      if (b.monthConsumption !== a.monthConsumption) {
        return b.monthConsumption - a.monthConsumption;
      }
      return localeCompareByName(a.name, b.name, locale);
    });

  const availabilityTotalBalance = roundMoney(
    availabilityRows.reduce((sum, row) => sum + row.currentBalance, 0),
  );
  const availabilityTotalMonthImpact = roundMoney(
    availabilityRows.reduce((sum, row) => sum + row.monthImpact, 0),
  );
  const creditCardPreviousMonthStatementTotal = roundMoney(
    creditCardRows.reduce((sum, row) => sum + row.previousMonthStatement, 0),
  );
  const creditCardMonthPaymentsTotal = roundMoney(
    creditCardRows.reduce((sum, row) => sum + row.monthPayments, 0),
  );
  const creditCardMonthConsumptionTotal = roundMoney(
    creditCardRows.reduce((sum, row) => sum + row.monthConsumption, 0),
  );
  const creditCardRolledDebtTotal = roundMoney(
    creditCardRows.reduce((sum, row) => sum + row.rolledDebt, 0),
  );
  const creditCardNextMonthInstallmentsTotal = roundMoney(
    creditCardRows.reduce((sum, row) => sum + row.nextMonthInstallments, 0),
  );
  const includedActiveCount = availabilityRows.length + creditCardRows.length;
  const excludedActiveCount = paymentMethodRows.filter((row) => row.is_active && !row.include_in_balance).length;
  const inactiveCount = paymentMethodRows.filter((row) => !row.is_active).length;

  return {
    availabilityRows,
    creditCardRows,
    availabilityTotalBalance,
    availabilityTotalMonthImpact,
    creditCardPreviousMonthStatementTotal,
    creditCardMonthPaymentsTotal,
    creditCardMonthConsumptionTotal,
    creditCardRolledDebtTotal,
    creditCardNextMonthInstallmentsTotal,
    includedActiveCount,
    excludedActiveCount,
    inactiveCount,
  };
}
