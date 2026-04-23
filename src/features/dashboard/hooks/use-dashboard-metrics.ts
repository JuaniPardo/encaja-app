"use client";

import { useMemo } from "react";

import {
  buildFinancialSummary,
  buildProjectionBehaviorSummary,
} from "@/features/dashboard/lib/dashboard-domain-rules";
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
  ProjectionBehaviorSummary,
  TotalsByType,
  TransactionLiteRow,
  TranslationFn,
} from "@/features/dashboard/types/dashboard";
import { localeCompareByName } from "@/features/i18n/formatting";
import type { TransactionType } from "@/types/database";

type UseDashboardMetricsOptions = {
  locale: DashboardLocale;
  t: TranslationFn;
  selectedYear: number;
  selectedMonth: number;
  referenceDate: Date;
  categories: CategoryRow[];
  systemCategoryKeyById: Map<string, string>;
  budgetItems: BudgetItemLiteRow[];
  transactionRows: TransactionLiteRow[];
  allTransactionsImpact: Map<string, number>;
  nextMonthCommitmentByMethodId: Map<string, number>;
  previousMonthStatementByMethodId: Map<string, number>;
  currentMonthPaymentsByMethodId: Map<string, number>;
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
  projectionBehaviorSummary: ProjectionBehaviorSummary;
  financialSummary: FinancialSummary;
};

export function useDashboardMetrics({
  locale,
  t,
  selectedYear,
  selectedMonth,
  referenceDate,
  categories,
  systemCategoryKeyById,
  budgetItems,
  transactionRows,
  allTransactionsImpact,
  nextMonthCommitmentByMethodId,
  previousMonthStatementByMethodId,
  currentMonthPaymentsByMethodId,
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
    const zeroTolerance = 0.005;

    const getRowRank = (row: CategorySummaryRow) => {
      if (row.executionPercent === null) {
        return 2;
      }

      if (Math.abs(row.realAmount) < zeroTolerance) {
        return 1;
      }

      return 0;
    };

    return dashboardVisibleTypes.map((type) => ({
      type,
      rows: [...metrics.groupedRows[type]].sort((a, b) => {
        const rankDiff = getRowRank(a) - getRowRank(b);
        if (rankDiff !== 0) {
          return rankDiff;
        }

        if (b.realAmount !== a.realAmount) {
          return b.realAmount - a.realAmount;
        }

        return localeCompareByName(a.categoryName, b.categoryName, locale);
      }),
    }));
  }, [locale, metrics.groupedRows]);

  const financialSummary = useMemo<FinancialSummary>(() => {
    return buildFinancialSummary({
      locale,
      transactionRows,
      allTransactionsImpact,
      nextMonthCommitmentByMethodId,
      previousMonthStatementByMethodId,
      currentMonthPaymentsByMethodId,
      paymentMethodRows,
    });
  }, [
    allTransactionsImpact,
    currentMonthPaymentsByMethodId,
    locale,
    nextMonthCommitmentByMethodId,
    paymentMethodRows,
    previousMonthStatementByMethodId,
    transactionRows,
  ]);

  const projectionBehaviorSummary = useMemo<ProjectionBehaviorSummary>(() => {
    return buildProjectionBehaviorSummary({
      categories,
      transactionRows,
      budgetItems,
      systemCategoryKeyById,
      selectedYear,
      selectedMonth,
      referenceDate,
    });
  }, [
    budgetItems,
    categories,
    referenceDate,
    selectedMonth,
    selectedYear,
    systemCategoryKeyById,
    transactionRows,
  ]);

  return {
    metrics,
    savingsVsIncome,
    donutData,
    summaryRows,
    projectionBehaviorSummary,
    financialSummary,
  };
}
