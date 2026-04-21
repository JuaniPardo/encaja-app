import type { SupabaseClient } from "@supabase/supabase-js";

import { buildMonthRange, parseAmountValue, roundMoney } from "@/features/dashboard/lib/dashboard-math";
import type { InsightsContext } from "@/features/insights/types";
import type { Database } from "@/types/database";

type PaymentMethodRow = Pick<
  Database["public"]["Tables"]["payment_methods"]["Row"],
  "id" | "type" | "current_balance"
>;

type TransactionRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "amount" | "type" | "payment_method_id" | "direction" | "effective_date" | "transaction_date" | "installment_purchase_id"
>;

type LoadInsightsContextOptions = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  referenceDate: Date;
};

function buildTransactionPeriodFilter(start: string, end: string) {
  return [
    `and(effective_date.gte.${start},effective_date.lt.${end})`,
    `and(effective_date.is.null,transaction_date.gte.${start},transaction_date.lt.${end})`,
  ].join(",");
}

function buildTransactionBeforePeriodFilter(end: string) {
  return [
    `effective_date.lt.${end}`,
    `and(effective_date.is.null,transaction_date.lt.${end})`,
  ].join(",");
}

function resolvePaymentMethodImpact(row: TransactionRow) {
  const amount = parseAmountValue(row.amount);
  if (row.type === "income") {
    return amount;
  }
  if (row.type === "expense" || row.type === "saving") {
    return -amount;
  }
  if (row.type === "transfer") {
    return row.direction === "in" ? amount : -amount;
  }

  return 0;
}

export async function loadInsightsContext({
  supabase,
  workspaceId,
  referenceDate,
}: LoadInsightsContextOptions): Promise<InsightsContext> {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const previousDate = new Date(currentYear, currentMonth - 2, 1, 12, 0, 0, 0);
  const nextDate = new Date(currentYear, currentMonth, 1, 12, 0, 0, 0);

  const currentPeriod = buildMonthRange(currentYear, currentMonth);
  const previousPeriod = buildMonthRange(previousDate.getFullYear(), previousDate.getMonth() + 1);
  const nextPeriod = buildMonthRange(nextDate.getFullYear(), nextDate.getMonth() + 1);

  const paymentMethodsResponse = await supabase
    .from("payment_methods")
    .select("id, type, current_balance")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (paymentMethodsResponse.error) {
    throw paymentMethodsResponse.error;
  }

  const paymentMethods = (paymentMethodsResponse.data ?? []) as PaymentMethodRow[];
  const creditCards = paymentMethods.filter((row) => row.type === "credit_card");
  const creditCardIds = new Set(creditCards.map((row) => row.id));

  const currentTransactionsResponse = await supabase
    .from("transactions")
    .select("amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id")
    .eq("workspace_id", workspaceId)
    .or(buildTransactionPeriodFilter(currentPeriod.start, currentPeriod.end));

  if (currentTransactionsResponse.error) {
    throw currentTransactionsResponse.error;
  }

  const previousTransactionsResponse = await supabase
    .from("transactions")
    .select("amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id")
    .eq("workspace_id", workspaceId)
    .or(buildTransactionPeriodFilter(previousPeriod.start, previousPeriod.end));

  if (previousTransactionsResponse.error) {
    throw previousTransactionsResponse.error;
  }

  let historicalCreditTransactions: TransactionRow[] = [];
  if (creditCards.length > 0) {
    const historicalCreditTransactionsResponse = await supabase
      .from("transactions")
      .select("amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id")
      .eq("workspace_id", workspaceId)
      .in("payment_method_id", creditCards.map((row) => row.id))
      .or(buildTransactionBeforePeriodFilter(currentPeriod.end));

    if (historicalCreditTransactionsResponse.error) {
      throw historicalCreditTransactionsResponse.error;
    }

    historicalCreditTransactions = (historicalCreditTransactionsResponse.data ?? []) as TransactionRow[];
  }

  let nextMonthInstallmentTransactions: TransactionRow[] = [];
  if (creditCards.length > 0) {
    const nextMonthInstallmentsResponse = await supabase
      .from("transactions")
      .select("amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id")
      .eq("workspace_id", workspaceId)
      .in("payment_method_id", creditCards.map((row) => row.id))
      .not("installment_purchase_id", "is", null)
      .gte("effective_date", nextPeriod.start)
      .lt("effective_date", nextPeriod.end);

    if (nextMonthInstallmentsResponse.error) {
      throw nextMonthInstallmentsResponse.error;
    }

    nextMonthInstallmentTransactions = (nextMonthInstallmentsResponse.data ?? []) as TransactionRow[];
  }

  const currentTransactions = (currentTransactionsResponse.data ?? []) as TransactionRow[];
  const previousTransactions = (previousTransactionsResponse.data ?? []) as TransactionRow[];

  let incomeCurrentMonth = 0;
  let creditCardExpenseCurrentMonth = 0;
  let creditCardPaymentsCurrentMonth = 0;

  for (const row of currentTransactions) {
    const amount = parseAmountValue(row.amount);
    if (row.type === "income") {
      incomeCurrentMonth += amount;
      continue;
    }

    if (!row.payment_method_id || !creditCardIds.has(row.payment_method_id)) {
      continue;
    }

    if (row.type === "expense") {
      creditCardExpenseCurrentMonth += amount;
    }

    if (row.type === "transfer" && row.direction === "in") {
      creditCardPaymentsCurrentMonth += amount;
    }
  }

  let creditCardExpensePreviousMonth = 0;
  for (const row of previousTransactions) {
    if (
      row.type === "expense" &&
      row.payment_method_id !== null &&
      creditCardIds.has(row.payment_method_id)
    ) {
      creditCardExpensePreviousMonth += parseAmountValue(row.amount);
    }
  }

  let creditCardNextMonthInstallments = 0;
  for (const row of nextMonthInstallmentTransactions) {
    if (
      row.type === "expense" &&
      row.payment_method_id !== null &&
      creditCardIds.has(row.payment_method_id)
    ) {
      creditCardNextMonthInstallments += parseAmountValue(row.amount);
    }
  }

  const balanceByMethodId = new Map<string, number>();
  for (const method of creditCards) {
    balanceByMethodId.set(method.id, parseAmountValue(method.current_balance));
  }

  for (const row of historicalCreditTransactions) {
    if (!row.payment_method_id) {
      continue;
    }
    if (!balanceByMethodId.has(row.payment_method_id)) {
      continue;
    }

    const currentBalance = balanceByMethodId.get(row.payment_method_id) ?? 0;
    balanceByMethodId.set(row.payment_method_id, roundMoney(currentBalance + resolvePaymentMethodImpact(row)));
  }

  let creditCardDebtTotal = 0;
  for (const [, balance] of balanceByMethodId.entries()) {
    if (balance < 0) {
      creditCardDebtTotal += Math.abs(balance);
    }
  }

  return {
    referenceDate,
    currentPeriod,
    previousPeriod,
    nextPeriod,
    creditCardCount: creditCards.length,
    incomeCurrentMonth: roundMoney(incomeCurrentMonth),
    creditCardExpenseCurrentMonth: roundMoney(creditCardExpenseCurrentMonth),
    creditCardExpensePreviousMonth: roundMoney(creditCardExpensePreviousMonth),
    creditCardPaymentsCurrentMonth: roundMoney(creditCardPaymentsCurrentMonth),
    creditCardDebtTotal: roundMoney(creditCardDebtTotal),
    creditCardCurrentStatement: roundMoney(creditCardExpenseCurrentMonth),
    creditCardNextMonthInstallments: roundMoney(creditCardNextMonthInstallments),
  };
}
