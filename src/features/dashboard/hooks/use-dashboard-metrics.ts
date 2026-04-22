"use client";

import { useMemo } from "react";

import { parseAmountValue, roundMoney, sortCategories } from "@/features/dashboard/lib/dashboard-math";
import { dashboardVisibleTypes, typeTheme } from "@/features/dashboard/lib/dashboard-theme";
import type {
  BudgetItemLiteRow,
  CategoryRow,
  CategorySummaryRow,
  DashboardLocale,
  DonutDataByType,
  FinancialSummary,
  PaymentMethodBalanceRow,
  TotalsByType,
  TransactionLiteRow,
  TranslationFn,
} from "@/features/dashboard/types/dashboard";
import { localeCompareByName } from "@/features/i18n/formatting";
import type { TransactionType } from "@/types/database";

type UseDashboardMetricsOptions = {
  locale: DashboardLocale;
  t: TranslationFn;
  categories: CategoryRow[];
  budgetItems: BudgetItemLiteRow[];
  transactionRows: TransactionLiteRow[];
  allTransactionsImpact: Map<string, number>;
  futureInstallmentsByMethodId: Map<string, number>;
  nextMonthCommitmentByMethodId: Map<string, number>;
  paymentMethodRows: PaymentMethodBalanceRow[];
};

export type DashboardMetricsModel = {
  metrics: {
    groupedRows: Record<TransactionType, CategorySummaryRow[]>;
    totalsByType: TotalsByType;
    balanceBudget: number;
    balanceReal: number;
    balanceDelta: number;
  };
  savingsVsIncome: number | null;
  donutData: DonutDataByType;
  summaryRows: Array<{
    type: TransactionType;
    rows: CategorySummaryRow[];
  }>;
  financialSummary: FinancialSummary;
};

export function useDashboardMetrics({
  locale,
  t,
  categories,
  budgetItems,
  transactionRows,
  allTransactionsImpact,
  futureInstallmentsByMethodId,
  nextMonthCommitmentByMethodId,
  paymentMethodRows,
}: UseDashboardMetricsOptions): DashboardMetricsModel {
  const metrics = useMemo(() => {
    const groupedRows: Record<TransactionType, CategorySummaryRow[]> = {
      income: [],
      expense: [],
      saving: [],
      transfer: [],
    };

    const totalsByType: TotalsByType = {
      income: { budget: 0, real: 0, deviation: 0 },
      expense: { budget: 0, real: 0, deviation: 0 },
      saving: { budget: 0, real: 0, deviation: 0 },
      transfer: { budget: 0, real: 0, deviation: 0 },
    };

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const budgetByCategoryId = new Map<string, number>();
    const realByCategoryId = new Map<string, number>();

    for (const item of budgetItems) {
      const parsedAmount = parseAmountValue(item.amount);
      const previousAmount = budgetByCategoryId.get(item.category_id) ?? 0;
      budgetByCategoryId.set(item.category_id, previousAmount + parsedAmount);
    }

    for (const row of transactionRows) {
      const category = categoryById.get(row.category_id);
      if (!category) {
        continue;
      }

      const parsedAmount = parseAmountValue(row.amount);
      const previousAmount = realByCategoryId.get(row.category_id) ?? 0;
      realByCategoryId.set(row.category_id, previousAmount + parsedAmount);
    }

    const categoryIdsWithData = new Set<string>([...budgetByCategoryId.keys(), ...realByCategoryId.keys()]);

    const visibleCategories = categories
      .filter((category) => category.is_active || categoryIdsWithData.has(category.id))
      .sort((a, b) => sortCategories(a, b, locale));

    for (const category of visibleCategories) {
      const budgetAmount = roundMoney(budgetByCategoryId.get(category.id) ?? 0);
      const realAmount = roundMoney(realByCategoryId.get(category.id) ?? 0);
      const deviation = roundMoney(realAmount - budgetAmount);
      const executionPercent = Math.abs(budgetAmount) < 0.005 ? null : (realAmount / budgetAmount) * 100;

      groupedRows[category.type].push({
        categoryId: category.id,
        categoryName: category.name,
        categoryIsActive: category.is_active,
        budgetAmount,
        realAmount,
        deviation,
        executionPercent,
      });

      totalsByType[category.type].budget += budgetAmount;
      totalsByType[category.type].real += realAmount;
    }

    for (const type of Object.keys(totalsByType) as TransactionType[]) {
      totalsByType[type].budget = roundMoney(totalsByType[type].budget);
      totalsByType[type].real = roundMoney(totalsByType[type].real);
      totalsByType[type].deviation = roundMoney(totalsByType[type].real - totalsByType[type].budget);
    }

    const balanceBudget = roundMoney(
      totalsByType.income.budget - totalsByType.expense.budget - totalsByType.saving.budget,
    );
    const balanceReal = roundMoney(
      totalsByType.income.real - totalsByType.expense.real - totalsByType.saving.real,
    );
    const balanceDelta = roundMoney(balanceReal - balanceBudget);

    return {
      groupedRows,
      totalsByType,
      balanceBudget,
      balanceReal,
      balanceDelta,
    };
  }, [budgetItems, categories, locale, transactionRows]);

  const savingsVsIncome = useMemo(() => {
    if (metrics.totalsByType.income.real <= 0) {
      return null;
    }

    return (metrics.totalsByType.saving.real / metrics.totalsByType.income.real) * 100;
  }, [metrics.totalsByType.income.real, metrics.totalsByType.saving.real]);

  const donutData = useMemo<DonutDataByType>(() => {
    const data: DonutDataByType = {
      income: { total: 0, slices: [] },
      expense: { total: 0, slices: [] },
      saving: { total: 0, slices: [] },
      transfer: { total: 0, slices: [] },
    };

    for (const type of Object.keys(metrics.groupedRows) as TransactionType[]) {
      const rows = metrics.groupedRows[type]
        .filter((row) => row.realAmount > 0)
        .sort((a, b) => b.realAmount - a.realAmount);

      const total = rows.reduce((sum, row) => sum + row.realAmount, 0);
      if (total <= 0) {
        data[type] = { total: 0, slices: [] };
        continue;
      }

      const topRows = rows.slice(0, 5);
      const rest = rows.slice(5);
      const palette = typeTheme[type].palette;
      const slices = topRows.map((row, index) => ({
        label: row.categoryName,
        amount: row.realAmount,
        value: (row.realAmount / total) * 100,
        color: palette[index % palette.length],
      }));

      if (rest.length > 0) {
        const restAmount = rest.reduce((sum, row) => sum + row.realAmount, 0);
        slices.push({
          label: t("dashboard.otherCategories"),
          amount: restAmount,
          value: (restAmount / total) * 100,
          color: "#b0b4bb",
        });
      }

      data[type] = { total: roundMoney(total), slices };
    }

    return data;
  }, [metrics.groupedRows, t]);

  const summaryRows = useMemo(() => {
    return dashboardVisibleTypes.map((type) => ({
      type,
      rows: metrics.groupedRows[type],
    }));
  }, [metrics.groupedRows]);

  const financialSummary = useMemo<FinancialSummary>(() => {
    const monthImpactByMethodId = new Map<string, number>();
    const currentStatementByMethodId = new Map<string, number>();

    for (const row of transactionRows) {
      if (!row.payment_method_id) {
        continue;
      }

      const parsedAmount = parseAmountValue(row.amount);
      const signedAmount = row.type === "income" ? parsedAmount : -parsedAmount;
      const previousAmount = monthImpactByMethodId.get(row.payment_method_id) ?? 0;
      monthImpactByMethodId.set(row.payment_method_id, roundMoney(previousAmount + signedAmount));

      if (row.type === "expense") {
        const previousStatementAmount = currentStatementByMethodId.get(row.payment_method_id) ?? 0;
        currentStatementByMethodId.set(
          row.payment_method_id,
          roundMoney(previousStatementAmount + parsedAmount),
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
        const debtCurrent = roundMoney(Math.max(0, -row.currentBalance));
        const monthConsumption = roundMoney(currentStatementByMethodId.get(row.id) ?? 0);
        const nextMonthInstallments = roundMoney(nextMonthCommitmentByMethodId.get(row.id) ?? 0);
        const installmentBalance = roundMoney(futureInstallmentsByMethodId.get(row.id) ?? 0);

        return {
          id: row.id,
          name: row.name,
          type: "credit_card" as const,
          debtCurrent,
          monthConsumption,
          nextMonthInstallments,
          installmentBalance,
        };
      })
      .sort((a, b) => {
        if (b.debtCurrent !== a.debtCurrent) {
          return b.debtCurrent - a.debtCurrent;
        }
        return localeCompareByName(a.name, b.name, locale);
      });

    const availabilityTotalBalance = roundMoney(
      availabilityRows.reduce((sum, row) => sum + row.currentBalance, 0),
    );
    const availabilityTotalMonthImpact = roundMoney(
      availabilityRows.reduce((sum, row) => sum + row.monthImpact, 0),
    );
    const creditCardDebtCurrentTotal = roundMoney(
      creditCardRows.reduce((sum, row) => sum + row.debtCurrent, 0),
    );
    const creditCardMonthConsumptionTotal = roundMoney(
      creditCardRows.reduce((sum, row) => sum + row.monthConsumption, 0),
    );
    const creditCardNextMonthInstallmentsTotal = roundMoney(
      creditCardRows.reduce((sum, row) => sum + row.nextMonthInstallments, 0),
    );
    const creditCardInstallmentBalanceTotal = roundMoney(
      creditCardRows.reduce((sum, row) => sum + row.installmentBalance, 0),
    );
    const includedActiveCount = availabilityRows.length + creditCardRows.length;
    const excludedActiveCount = paymentMethodRows.filter((row) => row.is_active && !row.include_in_balance).length;
    const inactiveCount = paymentMethodRows.filter((row) => !row.is_active).length;

    return {
      availabilityRows,
      creditCardRows,
      availabilityTotalBalance,
      availabilityTotalMonthImpact,
      creditCardDebtCurrentTotal,
      creditCardMonthConsumptionTotal,
      creditCardNextMonthInstallmentsTotal,
      creditCardInstallmentBalanceTotal,
      includedActiveCount,
      excludedActiveCount,
      inactiveCount,
    };
  }, [
    allTransactionsImpact,
    futureInstallmentsByMethodId,
    locale,
    nextMonthCommitmentByMethodId,
    paymentMethodRows,
    transactionRows,
  ]);

  return {
    metrics,
    savingsVsIncome,
    donutData,
    summaryRows,
    financialSummary,
  };
}
