"use client";

import { useCallback, useMemo } from "react";

import { buildSafeCurrencyFormatter, parseAmountValue, roundMoney } from "@/features/dashboard/lib/dashboard-math";
import { shouldShowDashboardOnboardingCta } from "@/features/dashboard/onboarding-cta-visibility";
import type {
  DashboardLocale,
  DashboardTypeLabels,
  LinkedWorkspaceBalanceGroup,
  LinkedWorkspacePaymentMethodBalanceRow,
  PaymentMethodBalanceRow,
  PaymentMethodTypeLabels,
  TranslationFn,
} from "@/features/dashboard/types/dashboard";
import {
  localeCompareByName,
  mapPaymentMethodTypeLabel,
  mapTransactionTypeLabel,
  monthLabelFromOptions,
} from "@/features/i18n/formatting";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { buildWorkspaceHref } from "@/features/workspace/routing";
import type { TransactionType } from "@/types/database";

type UseDashboardPresentationOptions = {
  locale: DashboardLocale;
  intlLocale: string;
  t: TranslationFn;
  workspaceSlug: string;
  selectedYear: number;
  selectedMonth: number;
  monthOptions: Array<{ value: string; label: string }>;
  startYear: number;
  paymentMethodRows: PaymentMethodBalanceRow[];
  linkedWorkspacePaymentMethodBalances: LinkedWorkspacePaymentMethodBalanceRow[];
  currencyFormatter: Intl.NumberFormat;
  showCents: boolean;
  isBootstrapping: boolean;
  hasAnyTransactions: boolean;
};

export type DashboardPresentationModel = {
  typeLabels: DashboardTypeLabels;
  paymentMethodTypeLabels: PaymentMethodTypeLabels;
  yearOptions: Array<{ value: string; label: string }>;
  linkedWorkspaceBalanceGroups: LinkedWorkspaceBalanceGroup[];
  linkedWorkspaceCurrencyFormatters: Map<string, Intl.NumberFormat>;
  shouldShowLinkedWorkspaceSummary: boolean;
  shouldShowOnboardingCta: boolean;
  onboardingHref: string;
  selectedPeriodLabel: string;
  paymentMethodDrilldownHref: (paymentMethodId: string) => string;
  categoryDrilldownHref: (type: TransactionType, categoryId: string) => string;
};

export function useDashboardPresentation({
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
}: UseDashboardPresentationOptions): DashboardPresentationModel {
  const typeLabels = useMemo<DashboardTypeLabels>(
    () => ({
      income: mapTransactionTypeLabel("income", t, { plural: true }),
      expense: mapTransactionTypeLabel("expense", t, { plural: true }),
      saving: mapTransactionTypeLabel("saving", t, { plural: true }),
      transfer: t("transactions.transfer"),
    }),
    [t],
  );

  const paymentMethodTypeLabels = useMemo<PaymentMethodTypeLabels>(
    () => ({
      cash: mapPaymentMethodTypeLabel("cash", t),
      debit_card: mapPaymentMethodTypeLabel("debit_card", t),
      credit_card: mapPaymentMethodTypeLabel("credit_card", t),
      bank_transfer: mapPaymentMethodTypeLabel("bank_transfer", t),
      other: mapPaymentMethodTypeLabel("other", t),
    }),
    [t],
  );

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const initialYear = Math.min(startYear, selectedYear, currentYear - 1);
    const finalYear = Math.max(selectedYear, currentYear + 2);
    const options: Array<{ value: string; label: string }> = [];

    for (let year = finalYear; year >= initialYear; year -= 1) {
      options.push({
        value: String(year),
        label: String(year),
      });
    }

    return options;
  }, [selectedYear, startYear]);

  const normalizedLinkedWorkspacePaymentMethodBalances = useMemo(() => {
    return linkedWorkspacePaymentMethodBalances.map((row) => {
      const paymentMethodBalance = roundMoney(parseAmountValue(row.payment_method_balance));
      const workspaceTotalBalance = roundMoney(parseAmountValue(row.workspace_total_balance));

      return {
        ...row,
        paymentMethodBalance,
        workspaceTotalBalance,
      };
    });
  }, [linkedWorkspacePaymentMethodBalances]);

  const linkedWorkspaceBalanceGroups = useMemo<LinkedWorkspaceBalanceGroup[]>(() => {
    const groupsByWorkspaceId = new Map<string, LinkedWorkspaceBalanceGroup>();

    for (const row of normalizedLinkedWorkspacePaymentMethodBalances) {
      const workspaceId = row.target_workspace_id;
      const existingGroup = groupsByWorkspaceId.get(workspaceId);

      if (existingGroup) {
        existingGroup.paymentMethods.push({
          id: row.payment_method_id,
          name: row.payment_method_name,
          type: row.payment_method_type,
          balance: row.paymentMethodBalance,
        });
        continue;
      }

      groupsByWorkspaceId.set(workspaceId, {
        linkId: row.link_id,
        workspaceId,
        workspaceName: row.target_workspace_name,
        currencyCode: (row.target_currency_code ?? "N/A").toUpperCase(),
        visibilityMode: row.visibility_mode,
        totalBalance: row.workspaceTotalBalance,
        paymentMethods: [
          {
            id: row.payment_method_id,
            name: row.payment_method_name,
            type: row.payment_method_type,
            balance: row.paymentMethodBalance,
          },
        ],
      });
    }

    return Array.from(groupsByWorkspaceId.values())
      .map((group) => ({
        ...group,
        paymentMethods: [...group.paymentMethods].sort((a, b) => localeCompareByName(a.name, b.name, locale)),
      }))
      .sort((a, b) => localeCompareByName(a.workspaceName, b.workspaceName, locale));
  }, [locale, normalizedLinkedWorkspacePaymentMethodBalances]);

  const linkedWorkspaceCurrencyFormatters = useMemo(() => {
    const formattersByCode = new Map<string, Intl.NumberFormat>();

    for (const group of linkedWorkspaceBalanceGroups) {
      formattersByCode.set(
        group.currencyCode,
        buildSafeCurrencyFormatter(intlLocale, group.currencyCode, showCents, currencyFormatter),
      );
    }

    return formattersByCode;
  }, [currencyFormatter, intlLocale, linkedWorkspaceBalanceGroups, showCents]);

  const shouldShowLinkedWorkspaceSummary = useMemo(() => {
    return linkedWorkspaceBalanceGroups.length > 0;
  }, [linkedWorkspaceBalanceGroups]);

  const shouldShowOnboardingCta = useMemo(() => {
    if (isBootstrapping) {
      return false;
    }

    return shouldShowDashboardOnboardingCta({
      paymentMethodCount: paymentMethodRows.length,
      hasAnyTransactions,
    });
  }, [hasAnyTransactions, isBootstrapping, paymentMethodRows.length]);

  const onboardingHref = useMemo(() => buildWorkspaceHref(workspaceSlug, "/start"), [workspaceSlug]);

  const selectedPeriodLabel = `${monthLabelFromOptions(
    selectedMonth,
    monthOptions,
    t("common.messages.month"),
  )} ${selectedYear}`;

  const paymentMethodDrilldownHref = useCallback(
    (paymentMethodId: string) =>
      buildTransactionsDrilldownHref({
        workspaceSlug,
        year: selectedYear,
        month: selectedMonth,
        paymentMethodId,
      }),
    [selectedMonth, selectedYear, workspaceSlug],
  );

  const categoryDrilldownHref = useCallback(
    (type: TransactionType, categoryId: string) =>
      buildTransactionsDrilldownHref({
        workspaceSlug,
        year: selectedYear,
        month: selectedMonth,
        type,
        categoryId,
      }),
    [selectedMonth, selectedYear, workspaceSlug],
  );

  return {
    typeLabels,
    paymentMethodTypeLabels,
    yearOptions,
    linkedWorkspaceBalanceGroups,
    linkedWorkspaceCurrencyFormatters,
    shouldShowLinkedWorkspaceSummary,
    shouldShowOnboardingCta,
    onboardingHref,
    selectedPeriodLabel,
    paymentMethodDrilldownHref,
    categoryDrilldownHref,
  };
}
