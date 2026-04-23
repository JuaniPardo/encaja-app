import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildProjectionBehaviorSummary,
  dashboardAdjustmentSystemKeys,
} from "@/features/dashboard/lib/dashboard-domain-rules";
import { buildMonthRange, parseAmountValue, roundMoney } from "@/features/dashboard/lib/dashboard-math";
import type { InsightsContext } from "@/features/insights/types";
import type { Database } from "@/types/database";

type PaymentMethodRow = Pick<
  Database["public"]["Tables"]["payment_methods"]["Row"],
  "id" | "type" | "current_balance" | "is_active" | "include_in_balance"
>;

type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name" | "type" | "source" | "system_category_id" | "expense_behavior"
>;

type SystemCategoryKeyRow = Pick<Database["public"]["Tables"]["system_categories"]["Row"], "id" | "key">;

type TransactionRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  | "amount"
  | "type"
  | "payment_method_id"
  | "direction"
  | "effective_date"
  | "transaction_date"
  | "installment_purchase_id"
  | "category_id"
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

  const categoriesResponse = await supabase
    .from("categories")
    .select("id, name, type, source, system_category_id, expense_behavior")
    .eq("workspace_id", workspaceId);

  if (categoriesResponse.error) {
    throw categoriesResponse.error;
  }

  const categories = (categoriesResponse.data ?? []) as CategoryRow[];
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const systemCategoriesResponse = await supabase
    .from("system_categories")
    .select("id, key");

  if (systemCategoriesResponse.error) {
    throw systemCategoriesResponse.error;
  }

  const systemCategoryRows = (systemCategoriesResponse.data ?? []) as SystemCategoryKeyRow[];
  const systemCategoryKeyById = new Map(systemCategoryRows.map((row) => [row.id, row.key]));

  const adjustmentSystemCategoryIds = new Set(
    systemCategoryRows
      .filter((systemCategory) =>
        dashboardAdjustmentSystemKeys.includes(
          systemCategory.key as (typeof dashboardAdjustmentSystemKeys)[number],
        ),
      )
      .map((systemCategory) => systemCategory.id),
  );

  const excludedDashboardCategoryIds = new Set(
    categories
      .filter(
        (category): category is CategoryRow & { system_category_id: string } =>
          category.system_category_id !== null && adjustmentSystemCategoryIds.has(category.system_category_id),
      )
      .map((category) => category.id),
  );

  const paymentMethodsResponse = await supabase
    .from("payment_methods")
    .select("id, type, current_balance, is_active, include_in_balance")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  if (paymentMethodsResponse.error) {
    throw paymentMethodsResponse.error;
  }

  const paymentMethods = (paymentMethodsResponse.data ?? []) as PaymentMethodRow[];
  const activeCreditCards = paymentMethods.filter((row) => row.type === "credit_card");
  const creditCardIds = new Set(activeCreditCards.map((row) => row.id));

  const currentTransactionsResponse = await supabase
    .from("transactions")
    .select(
      "amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id, category_id",
    )
    .eq("workspace_id", workspaceId)
    .or(buildTransactionPeriodFilter(currentPeriod.start, currentPeriod.end));

  if (currentTransactionsResponse.error) {
    throw currentTransactionsResponse.error;
  }

  const previousTransactionsResponse = await supabase
    .from("transactions")
    .select(
      "amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id, category_id",
    )
    .eq("workspace_id", workspaceId)
    .or(buildTransactionPeriodFilter(previousPeriod.start, previousPeriod.end));

  if (previousTransactionsResponse.error) {
    throw previousTransactionsResponse.error;
  }

  const historicalTransactionsResponse = await supabase
    .from("transactions")
    .select(
      "amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id, category_id",
    )
    .eq("workspace_id", workspaceId)
    .or(buildTransactionBeforePeriodFilter(currentPeriod.end));

  if (historicalTransactionsResponse.error) {
    throw historicalTransactionsResponse.error;
  }

  let nextMonthCommitmentTransactions: TransactionRow[] = [];
  if (activeCreditCards.length > 0) {
    const nextMonthCommitmentResponse = await supabase
      .from("transactions")
      .select(
        "amount, type, payment_method_id, direction, effective_date, transaction_date, installment_purchase_id, category_id",
      )
      .eq("workspace_id", workspaceId)
      .in("payment_method_id", activeCreditCards.map((row) => row.id))
      .eq("type", "expense")
      .not("installment_purchase_id", "is", null)
      .or(buildTransactionPeriodFilter(nextPeriod.start, nextPeriod.end));

    if (nextMonthCommitmentResponse.error) {
      throw nextMonthCommitmentResponse.error;
    }

    nextMonthCommitmentTransactions = (nextMonthCommitmentResponse.data ?? []) as TransactionRow[];
  }

  const currentTransactions = (currentTransactionsResponse.data ?? []) as TransactionRow[];
  const previousTransactions = (previousTransactionsResponse.data ?? []) as TransactionRow[];
  const historicalTransactions = (historicalTransactionsResponse.data ?? []) as TransactionRow[];

  let incomeCurrentMonth = 0;
  let expenseCurrentMonth = 0;
  let savingCurrentMonth = 0;
  let creditCardExpenseCurrentMonth = 0;
  let creditCardPaymentsCurrentMonth = 0;
  let relevantTransactionCountCurrentMonth = 0;

  const expenseByCategoryMap = new Map<string, number>();

  for (const row of currentTransactions) {
    const amount = parseAmountValue(row.amount);
    const isExcludedCategory = excludedDashboardCategoryIds.has(row.category_id);

    if (row.type === "income") {
      if (!isExcludedCategory) {
        incomeCurrentMonth = roundMoney(incomeCurrentMonth + amount);
        relevantTransactionCountCurrentMonth += 1;
      }
      continue;
    }

    if (row.type === "saving") {
      if (!isExcludedCategory) {
        savingCurrentMonth = roundMoney(savingCurrentMonth + amount);
        relevantTransactionCountCurrentMonth += 1;
      }
      continue;
    }

    if (row.type === "expense") {
      if (!isExcludedCategory) {
        expenseCurrentMonth = roundMoney(expenseCurrentMonth + amount);
        relevantTransactionCountCurrentMonth += 1;

        const previousAmount = expenseByCategoryMap.get(row.category_id) ?? 0;
        expenseByCategoryMap.set(row.category_id, roundMoney(previousAmount + amount));
      }

      if (row.payment_method_id && creditCardIds.has(row.payment_method_id) && !isExcludedCategory) {
        creditCardExpenseCurrentMonth = roundMoney(creditCardExpenseCurrentMonth + amount);
      }
      continue;
    }

    if (
      row.type === "transfer" &&
      row.direction === "in" &&
      row.payment_method_id !== null &&
      creditCardIds.has(row.payment_method_id)
    ) {
      creditCardPaymentsCurrentMonth = roundMoney(creditCardPaymentsCurrentMonth + amount);
    }
  }

  let creditCardExpensePreviousMonth = 0;
  for (const row of previousTransactions) {
    if (
      row.type === "expense" &&
      row.payment_method_id !== null &&
      creditCardIds.has(row.payment_method_id) &&
      !excludedDashboardCategoryIds.has(row.category_id)
    ) {
      creditCardExpensePreviousMonth = roundMoney(creditCardExpensePreviousMonth + parseAmountValue(row.amount));
    }
  }

  let creditCardNextMonthCommitment = 0;
  for (const row of nextMonthCommitmentTransactions) {
    if (
      row.type === "expense" &&
      row.payment_method_id !== null &&
      creditCardIds.has(row.payment_method_id) &&
      !excludedDashboardCategoryIds.has(row.category_id)
    ) {
      creditCardNextMonthCommitment = roundMoney(creditCardNextMonthCommitment + parseAmountValue(row.amount));
    }
  }

  const historicalImpactByMethodId = new Map<string, number>();
  for (const row of historicalTransactions) {
    if (!row.payment_method_id) {
      continue;
    }

    const previousImpact = historicalImpactByMethodId.get(row.payment_method_id) ?? 0;
    historicalImpactByMethodId.set(
      row.payment_method_id,
      roundMoney(previousImpact + resolvePaymentMethodImpact(row)),
    );
  }

  let availableCurrent = 0;
  for (const method of paymentMethods) {
    if (!method.is_active || !method.include_in_balance || method.type === "credit_card") {
      continue;
    }

    const methodBalance = roundMoney(
      parseAmountValue(method.current_balance) + (historicalImpactByMethodId.get(method.id) ?? 0),
    );
    availableCurrent = roundMoney(availableCurrent + methodBalance);
  }

  let creditCardDebtTotal = 0;
  for (const method of activeCreditCards) {
    const methodBalance = roundMoney(
      parseAmountValue(method.current_balance) + (historicalImpactByMethodId.get(method.id) ?? 0),
    );
    if (methodBalance < 0) {
      creditCardDebtTotal = roundMoney(creditCardDebtTotal + Math.abs(methodBalance));
    }
  }

  const projectionSummary = buildProjectionBehaviorSummary({
    categories,
    transactionRows: currentTransactions
      .filter(
        (row) =>
          (row.type === "income" || row.type === "expense") &&
          !excludedDashboardCategoryIds.has(row.category_id),
      )
      .map((row) => ({
        category_id: row.category_id,
        amount: row.amount,
        type: row.type,
      })),
    budgetItems: [],
    systemCategoryKeyById,
    selectedYear: currentYear,
    selectedMonth: currentMonth,
    referenceDate,
  });

  const expenseByCategoryCurrentMonth = Array.from(expenseByCategoryMap.entries())
    .map(([categoryId, amount]) => {
      const category = categoryById.get(categoryId);
      return {
        categoryId,
        categoryName: category?.name ?? "Sin categoría",
        amount: roundMoney(amount),
        behavior: category?.type === "expense" ? (category.expense_behavior === "fixed" ? "fixed" : "variable") : null,
      } as const;
    })
    .sort((left, right) => right.amount - left.amount);

  return {
    referenceDate,
    currentPeriod,
    previousPeriod,
    nextPeriod,
    availableCurrent: roundMoney(availableCurrent),
    creditCardCount: activeCreditCards.length,
    incomeCurrentMonth: roundMoney(incomeCurrentMonth),
    expenseCurrentMonth: roundMoney(expenseCurrentMonth),
    savingCurrentMonth: roundMoney(savingCurrentMonth),
    creditCardExpenseCurrentMonth: roundMoney(creditCardExpenseCurrentMonth),
    creditCardExpensePreviousMonth: roundMoney(creditCardExpensePreviousMonth),
    creditCardPaymentsCurrentMonth: roundMoney(creditCardPaymentsCurrentMonth),
    creditCardDebtTotal: roundMoney(creditCardDebtTotal),
    creditCardCurrentStatement: roundMoney(creditCardExpenseCurrentMonth),
    creditCardNextMonthCommitment: roundMoney(creditCardNextMonthCommitment),
    projectedIncomeTotal: roundMoney(projectionSummary.income.projectedTotal),
    projectedExpenseTotal: roundMoney(projectionSummary.expense.projectedTotal),
    projectedExpenseVariable: roundMoney(projectionSummary.expense.variableProjected),
    projectedBalance: roundMoney(projectionSummary.projectedBalance),
    elapsedDaysCurrentMonth: projectionSummary.elapsedDays,
    daysInCurrentMonth: projectionSummary.daysInMonth,
    relevantTransactionCountCurrentMonth,
    expenseByCategoryCurrentMonth,
  };
}
