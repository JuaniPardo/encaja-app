import { parseAmountValue, roundMoney } from "@/features/dashboard/lib/dashboard-math";
import type {
  InsightCategoryBudget,
  InsightCategoryExpense,
  InsightPeriodRange,
} from "@/features/insights/types";
import type { Database } from "@/types/database";

type ImputationDateRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "effective_date" | "transaction_date"
>;

type CardExpenseRow = ImputationDateRow &
  Pick<Database["public"]["Tables"]["transactions"]["Row"], "amount" | "type" | "payment_method_id" | "category_id">;

type BudgetCategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "name" | "type" | "expense_behavior"
>;

type BudgetAmountRow = Pick<Database["public"]["Tables"]["budget_items"]["Row"], "category_id" | "amount">;

function resolveImputationDate(row: ImputationDateRow) {
  return row.effective_date ?? row.transaction_date;
}

export function resolveImputationDay(row: ImputationDateRow) {
  return Number(resolveImputationDate(row).slice(8, 10));
}

export function resolveCardComparisonCutoffDay(
  referenceDate: Date,
  daysInCurrentMonth: number,
  daysInPreviousMonth: number,
) {
  const today = referenceDate.getDate();
  if (today >= daysInCurrentMonth) {
    return daysInPreviousMonth;
  }

  return Math.min(today, daysInPreviousMonth);
}

type SumCardExpenseUpToDayOptions = {
  rows: CardExpenseRow[];
  period: InsightPeriodRange;
  cutoffDay: number;
  creditCardIds: ReadonlySet<string>;
  excludedCategoryIds: ReadonlySet<string>;
};

export function sumCardExpenseUpToDay({
  rows,
  period,
  cutoffDay,
  creditCardIds,
  excludedCategoryIds,
}: SumCardExpenseUpToDayOptions) {
  let total = 0;
  for (const row of rows) {
    if (
      row.type !== "expense" ||
      row.payment_method_id === null ||
      !creditCardIds.has(row.payment_method_id) ||
      excludedCategoryIds.has(row.category_id)
    ) {
      continue;
    }

    const imputationDate = resolveImputationDate(row);
    if (imputationDate < period.start || imputationDate >= period.end) {
      continue;
    }

    if (resolveImputationDay(row) > cutoffDay) {
      continue;
    }

    total = roundMoney(total + parseAmountValue(row.amount));
  }

  return total;
}

type BuildExpenseBudgetByCategoryOptions = {
  categories: BudgetCategoryRow[];
  budgetItems: BudgetAmountRow[];
  expenseByCategory: ReadonlyMap<string, number>;
};

export function buildExpenseBudgetByCategory({
  categories,
  budgetItems,
  expenseByCategory,
}: BuildExpenseBudgetByCategoryOptions): InsightCategoryBudget[] {
  const budgetedByCategoryId = new Map<string, number>();
  for (const item of budgetItems) {
    const previousAmount = budgetedByCategoryId.get(item.category_id) ?? 0;
    budgetedByCategoryId.set(item.category_id, roundMoney(previousAmount + parseAmountValue(item.amount)));
  }

  return categories.flatMap((category) => {
    const budgeted = budgetedByCategoryId.get(category.id) ?? 0;
    if (category.type !== "expense" || budgeted <= 0) {
      return [];
    }

    return [
      {
        categoryId: category.id,
        categoryName: category.name,
        expenseBehavior: category.expense_behavior,
        budgeted,
        actual: roundMoney(expenseByCategory.get(category.id) ?? 0),
      },
    ];
  });
}

export function countVariableExpenseTransactions(expenseByCategory: InsightCategoryExpense[]) {
  return expenseByCategory
    .filter((category) => category.behavior === "variable")
    .reduce((total, category) => total + category.transactionCount, 0);
}
