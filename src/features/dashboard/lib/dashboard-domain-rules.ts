import { localeCompareByName } from "@/features/i18n/formatting";
import type {
  BudgetItemLiteRow,
  CategoryRow,
  DashboardLocale,
  FinancialSummary,
  PaymentMethodBalanceRow,
  ProjectionBehaviorSummary,
  ProjectionBehaviorValue,
  TransactionLiteRow,
} from "@/features/dashboard/types/dashboard";

import { parseAmountValue, roundMoney } from "./dashboard-math";

export const dashboardAdjustmentSystemKeys = [
  "balance_adjustment",
  "expense_manual_adjustment",
] as const;

type ProjectionCategoryRow = Pick<
  CategoryRow,
  "id" | "type" | "source" | "system_category_id" | "expense_behavior"
>;
type ProjectionTransactionRow = Pick<TransactionLiteRow, "category_id" | "amount" | "type">;
type ProjectionBudgetItemRow = Pick<BudgetItemLiteRow, "category_id" | "amount">;

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

type ResolveCategoryBehaviorOptions = {
  category: ProjectionCategoryRow;
  systemCategoryKeyById: Map<string, string>;
};

export function resolveCategoryBehavior({
  category,
  systemCategoryKeyById,
}: ResolveCategoryBehaviorOptions): ProjectionBehaviorValue | null {
  if (category.type === "expense") {
    return category.expense_behavior === "fixed" ? "fixed" : "variable";
  }

  if (category.type === "income") {
    if (category.source === "custom") {
      return "variable";
    }

    if (!category.system_category_id) {
      return "fixed";
    }

    const systemKey = systemCategoryKeyById.get(category.system_category_id);
    if (systemKey === "income_extra") {
      return "variable";
    }

    return "fixed";
  }

  return null;
}

type BuildProjectionBehaviorSummaryOptions = {
  categories: ProjectionCategoryRow[];
  transactionRows: ProjectionTransactionRow[];
  budgetItems: ProjectionBudgetItemRow[];
  systemCategoryKeyById: Map<string, string>;
  selectedYear: number;
  selectedMonth: number;
  referenceDate: Date;
};

export function buildProjectionBehaviorSummary({
  categories,
  transactionRows,
  budgetItems,
  systemCategoryKeyById,
  selectedYear,
  selectedMonth,
  referenceDate,
}: BuildProjectionBehaviorSummaryOptions): ProjectionBehaviorSummary {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const budgetByCategoryId = new Map<string, number>();

  for (const item of budgetItems) {
    const previousAmount = budgetByCategoryId.get(item.category_id) ?? 0;
    budgetByCategoryId.set(item.category_id, roundMoney(previousAmount + parseAmountValue(item.amount)));
  }

  let incomeFixedReal = 0;
  let incomeVariableReal = 0;
  let expenseFixedReal = 0;
  let expenseVariableReal = 0;
  let incomeFixedBudget = 0;
  let incomeVariableBudget = 0;
  let expenseFixedBudget = 0;
  let expenseVariableBudget = 0;

  for (const category of categories) {
    const behavior = resolveCategoryBehavior({ category, systemCategoryKeyById });
    const budgetAmount = roundMoney(budgetByCategoryId.get(category.id) ?? 0);

    if (category.type === "income") {
      if (behavior === "fixed") {
        incomeFixedBudget = roundMoney(incomeFixedBudget + budgetAmount);
      } else if (behavior === "variable") {
        incomeVariableBudget = roundMoney(incomeVariableBudget + budgetAmount);
      }
      continue;
    }

    if (category.type === "expense") {
      if (behavior === "fixed") {
        expenseFixedBudget = roundMoney(expenseFixedBudget + budgetAmount);
      } else if (behavior === "variable") {
        expenseVariableBudget = roundMoney(expenseVariableBudget + budgetAmount);
      }
    }
  }

  for (const row of transactionRows) {
    const category = categoryById.get(row.category_id);
    if (!category) {
      continue;
    }

    const amount = parseAmountValue(row.amount);
    const behavior = resolveCategoryBehavior({ category, systemCategoryKeyById });
    if (behavior === null) {
      continue;
    }

    if (row.type === "income" && category.type === "income") {
      if (behavior === "fixed") {
        incomeFixedReal = roundMoney(incomeFixedReal + amount);
      } else {
        incomeVariableReal = roundMoney(incomeVariableReal + amount);
      }
      continue;
    }

    if (row.type === "expense" && category.type === "expense") {
      if (behavior === "fixed") {
        expenseFixedReal = roundMoney(expenseFixedReal + amount);
      } else {
        expenseVariableReal = roundMoney(expenseVariableReal + amount);
      }
    }
  }

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const selectedPeriod = selectedYear * 100 + selectedMonth;
  const currentPeriod = referenceDate.getFullYear() * 100 + (referenceDate.getMonth() + 1);
  let elapsedDays = 0;

  if (selectedPeriod < currentPeriod) {
    elapsedDays = daysInMonth;
  } else if (selectedPeriod === currentPeriod) {
    elapsedDays = Math.min(referenceDate.getDate(), daysInMonth);
  }

  const remainingDays = Math.max(daysInMonth - elapsedDays, 0);

  const projectVariableComponent = (variableReal: number) => {
    if (elapsedDays <= 0 || elapsedDays >= daysInMonth) {
      return roundMoney(variableReal);
    }

    return roundMoney((variableReal / elapsedDays) * daysInMonth);
  };

  const incomeVariableProjected = projectVariableComponent(incomeVariableReal);
  const expenseVariableProjected = projectVariableComponent(expenseVariableReal);
  const incomeProjectedTotal = roundMoney(incomeFixedReal + incomeVariableProjected);
  const expenseProjectedTotal = roundMoney(expenseFixedReal + expenseVariableProjected);
  const incomeVariableDailyPace = elapsedDays <= 0 ? 0 : roundMoney(incomeVariableReal / elapsedDays);
  const expenseVariableDailyPace = elapsedDays <= 0 ? 0 : roundMoney(expenseVariableReal / elapsedDays);

  return {
    daysInMonth,
    elapsedDays,
    remainingDays,
    income: {
      fixedReal: incomeFixedReal,
      variableReal: incomeVariableReal,
      fixedBudget: incomeFixedBudget,
      variableBudget: incomeVariableBudget,
      variableDailyPace: incomeVariableDailyPace,
      variableProjected: incomeVariableProjected,
      projectedTotal: incomeProjectedTotal,
    },
    expense: {
      fixedReal: expenseFixedReal,
      variableReal: expenseVariableReal,
      fixedBudget: expenseFixedBudget,
      variableBudget: expenseVariableBudget,
      variableDailyPace: expenseVariableDailyPace,
      variableProjected: expenseVariableProjected,
      projectedTotal: expenseProjectedTotal,
    },
    projectedBalance: roundMoney(incomeProjectedTotal - expenseProjectedTotal),
  };
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
