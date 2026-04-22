"use client";

import type {
  BudgetItemLiteRow,
  CategoryRow,
  DashboardLocale,
  LinkedWorkspacePaymentMethodBalanceRow,
  PaymentMethodBalanceRow,
  TransactionLiteRow,
  TranslationFn,
} from "@/features/dashboard/types/dashboard";

import { useDashboardMetrics, type DashboardMetricsModel } from "./use-dashboard-metrics";
import { useDashboardPresentation, type DashboardPresentationModel } from "./use-dashboard-presentation";

type UseDashboardViewModelOptions = {
  locale: DashboardLocale;
  intlLocale: string;
  t: TranslationFn;
  workspaceSlug: string;
  selectedYear: number;
  selectedMonth: number;
  monthOptions: Array<{ value: string; label: string }>;
  startYear: number;
  categories: CategoryRow[];
  budgetItems: BudgetItemLiteRow[];
  transactionRows: TransactionLiteRow[];
  allTransactionsImpact: Map<string, number>;
  futureInstallmentsByMethodId: Map<string, number>;
  nextMonthCommitmentByMethodId: Map<string, number>;
  paymentMethodRows: PaymentMethodBalanceRow[];
  linkedWorkspacePaymentMethodBalances: LinkedWorkspacePaymentMethodBalanceRow[];
  currencyFormatter: Intl.NumberFormat;
  showCents: boolean;
  isBootstrapping: boolean;
  hasAnyTransactions: boolean;
};

export type DashboardViewModel = DashboardPresentationModel & DashboardMetricsModel;

export function useDashboardViewModel({
  locale,
  intlLocale,
  t,
  workspaceSlug,
  selectedYear,
  selectedMonth,
  monthOptions,
  startYear,
  categories,
  budgetItems,
  transactionRows,
  allTransactionsImpact,
  futureInstallmentsByMethodId,
  nextMonthCommitmentByMethodId,
  paymentMethodRows,
  linkedWorkspacePaymentMethodBalances,
  currencyFormatter,
  showCents,
  isBootstrapping,
  hasAnyTransactions,
}: UseDashboardViewModelOptions): DashboardViewModel {
  const metricsModel = useDashboardMetrics({
    locale,
    t,
    categories,
    budgetItems,
    transactionRows,
    allTransactionsImpact,
    futureInstallmentsByMethodId,
    nextMonthCommitmentByMethodId,
    paymentMethodRows,
  });

  const presentationModel = useDashboardPresentation({
    locale,
    intlLocale,
    t,
    workspaceSlug,
    selectedYear,
    selectedMonth,
    monthOptions,
    startYear,
    paymentMethodRows,
    linkedWorkspacePaymentMethodBalances,
    currencyFormatter,
    showCents,
    isBootstrapping,
    hasAnyTransactions,
  });

  return {
    ...presentationModel,
    ...metricsModel,
  };
}
