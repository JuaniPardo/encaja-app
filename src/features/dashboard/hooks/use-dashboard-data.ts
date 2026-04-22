"use client";

import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildMonthRange, parseAmountValue, roundMoney, sortCategories } from "@/features/dashboard/lib/dashboard-math";
import type {
  BudgetItemLiteRow,
  BudgetPeriodIdRow,
  CategoryRow,
  DashboardLocale,
  LinkedWorkspacePaymentMethodBalanceRow,
  PaymentMethodBalanceRow,
  TransactionIdRow,
  TransactionLiteRow,
  TranslationFn,
  WorkspaceSettingsLiteRow,
} from "@/features/dashboard/types/dashboard";
import { excludeTransfers } from "@/features/transactions/queries";
import type { Database } from "@/types/database";

type UseDashboardDataOptions = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  locale: DashboardLocale;
  selectedYear: number;
  selectedMonth: number;
  t: TranslationFn;
};

type FutureInstallmentRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "payment_method_id" | "amount"
>;

type NextMonthCommitmentRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "payment_method_id" | "amount"
>;

export function useDashboardData({
  supabase,
  workspaceId,
  locale,
  selectedYear,
  selectedMonth,
  t,
}: UseDashboardDataOptions) {
  const now = new Date();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemLiteRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<TransactionLiteRow[]>([]);
  const [allTransactionsImpact, setAllTransactionsImpact] = useState<Map<string, number>>(new Map());
  const [futureInstallmentsByMethodId, setFutureInstallmentsByMethodId] = useState<
    Map<string, number>
  >(new Map());
  const [nextMonthCommitmentByMethodId, setNextMonthCommitmentByMethodId] = useState<Map<string, number>>(
    new Map(),
  );
  const [paymentMethodRows, setPaymentMethodRows] = useState<PaymentMethodBalanceRow[]>([]);
  const [linkedWorkspacePaymentMethodBalances, setLinkedWorkspacePaymentMethodBalances] = useState<
    LinkedWorkspacePaymentMethodBalanceRow[]
  >([]);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [hasAnyTransactions, setHasAnyTransactions] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  useEffect(() => {
    const run = async () => {
      const [categoriesResponse, paymentMethodsResponse, settingsResponse, anyTransactionsResponse] =
        await Promise.all([
          supabase
            .from("categories")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: true }),
          supabase
            .from("payment_methods")
            .select("id, name, type, is_active, include_in_balance, current_balance")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: true }),
          supabase
            .from("workspace_settings")
            .select("start_year, currency_code, show_cents")
            .eq("workspace_id", workspaceId)
            .maybeSingle(),
          supabase
            .from("transactions")
            .select("id")
            .eq("workspace_id", workspaceId)
            .limit(1),
        ]);

      if (categoriesResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadCategoriesError"),
          message: categoriesResponse.error.message,
        });
        setCategories([]);
      } else {
        const sortedCategories = [...categoriesResponse.data].sort((a, b) => sortCategories(a, b, locale));
        setCategories(sortedCategories);
      }

      if (settingsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadSettingsError"),
          message: settingsResponse.error.message,
        });
        setStartYear(new Date().getFullYear());
        setCurrencyCode("ARS");
        setShowCents(false);
      } else {
        const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
        setStartYear(settings?.start_year ?? new Date().getFullYear());
        setCurrencyCode(settings?.currency_code ?? "ARS");
        setShowCents(settings?.show_cents ?? false);
      }

      if (paymentMethodsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadFinancialMethodsError"),
          message: paymentMethodsResponse.error.message,
        });
        setPaymentMethodRows([]);
      } else {
        setPaymentMethodRows((paymentMethodsResponse.data ?? []) as PaymentMethodBalanceRow[]);
      }

      if (anyTransactionsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadOnboardingSignalsError"),
          message: anyTransactionsResponse.error.message,
        });
        setHasAnyTransactions(false);
      } else {
        const rows = (anyTransactionsResponse.data ?? []) as TransactionIdRow[];
        setHasAnyTransactions(rows.length > 0);
      }

      setIsBootstrapping(false);
    };

    void run();
  }, [locale, supabase, t, workspaceId]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    const run = async () => {
      const { start, end } = buildMonthRange(selectedYear, selectedMonth);
      const nextPeriodDate = new Date(selectedYear, selectedMonth, 1, 12, 0, 0, 0);
      const nextPeriod = buildMonthRange(nextPeriodDate.getFullYear(), nextPeriodDate.getMonth() + 1);

      const periodResponsePromise = supabase
        .from("budget_periods")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .maybeSingle();

      const transactionFilter = [
        `and(effective_date.gte.${start},effective_date.lt.${end})`,
        `and(effective_date.is.null,transaction_date.gte.${start},transaction_date.lt.${end})`,
      ].join(",");

      const transactionsResponsePromise = excludeTransfers(
        supabase
          .from("transactions")
          .select("category_id, amount, transaction_date, effective_date, type, payment_method_id")
          .eq("workspace_id", workspaceId)
          .or(transactionFilter),
      );

      const historicalFilter = [
        `effective_date.lt.${end}`,
        `and(effective_date.is.null,transaction_date.lt.${end})`,
      ].join(",");

      const historicalTransactionsPromise = supabase
        .from("transactions")
        .select("amount, type, payment_method_id, transaction_date, effective_date, direction")
        .eq("workspace_id", workspaceId)
        .or(historicalFilter);

      const futureInstallmentsPromise = supabase
        .from("transactions")
        .select("payment_method_id, amount")
        .eq("workspace_id", workspaceId)
        .eq("type", "expense")
        .not("installment_purchase_id", "is", null)
        .gte("effective_date", end)
        .not("payment_method_id", "is", null);

      const nextMonthCommitmentFilter = [
        `and(effective_date.gte.${nextPeriod.start},effective_date.lt.${nextPeriod.end})`,
        `and(effective_date.is.null,transaction_date.gte.${nextPeriod.start},transaction_date.lt.${nextPeriod.end})`,
      ].join(",");

      const nextMonthCommitmentPromise = supabase
        .from("transactions")
        .select("payment_method_id, amount")
        .eq("workspace_id", workspaceId)
        .eq("type", "expense")
        .not("payment_method_id", "is", null)
        .or(nextMonthCommitmentFilter);

      const linkedWorkspaceSummaryPromise = supabase.rpc(
        "list_linked_workspace_payment_method_balances",
        {
          p_source_workspace_id: workspaceId,
        },
      );

      const [
        periodResponse,
        transactionsResponse,
        historicalTransactionsResponse,
        futureInstallmentsResponse,
        nextMonthCommitmentResponse,
        linkedWorkspaceSummaryResponse,
      ] = await Promise.all([
        periodResponsePromise,
        transactionsResponsePromise,
        historicalTransactionsPromise,
        futureInstallmentsPromise,
        nextMonthCommitmentPromise,
        linkedWorkspaceSummaryPromise,
      ]);

      if (transactionsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadPeriodTransactionsError"),
          message: transactionsResponse.error.message,
        });
        setTransactionRows([]);
      } else {
        setTransactionRows((transactionsResponse.data ?? []) as TransactionLiteRow[]);
      }

      if (historicalTransactionsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadPeriodTransactionsError"),
          message: historicalTransactionsResponse.error.message,
        });
        setAllTransactionsImpact(new Map());
      } else {
        const historicalTransactions = historicalTransactionsResponse.data as TransactionLiteRow[];
        const impactMap = new Map<string, number>();
        for (const row of historicalTransactions) {
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
            signedAmount = row.direction === "in" ? parsedAmount : -parsedAmount;
          }

          const previousAmount = impactMap.get(row.payment_method_id) ?? 0;
          impactMap.set(row.payment_method_id, roundMoney(previousAmount + signedAmount));
        }

        setAllTransactionsImpact(impactMap);
      }

      if (futureInstallmentsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadPendingInstallmentsError"),
          message: futureInstallmentsResponse.error.message,
        });
        setFutureInstallmentsByMethodId(new Map());
      } else {
        const futureRows = (futureInstallmentsResponse.data ?? []) as FutureInstallmentRow[];
        const futureMap = new Map<string, number>();

        for (const row of futureRows) {
          if (!row.payment_method_id) {
            continue;
          }

          const previousAmount = futureMap.get(row.payment_method_id) ?? 0;
          futureMap.set(
            row.payment_method_id,
            roundMoney(previousAmount + parseAmountValue(row.amount)),
          );
        }

        setFutureInstallmentsByMethodId(futureMap);
      }

      if (nextMonthCommitmentResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadNextMonthCommitmentError"),
          message: nextMonthCommitmentResponse.error.message,
        });
        setNextMonthCommitmentByMethodId(new Map());
      } else {
        const nextCommitmentRows = (nextMonthCommitmentResponse.data ?? []) as NextMonthCommitmentRow[];
        const nextCommitmentMap = new Map<string, number>();

        for (const row of nextCommitmentRows) {
          if (!row.payment_method_id) {
            continue;
          }

          const previousAmount = nextCommitmentMap.get(row.payment_method_id) ?? 0;
          nextCommitmentMap.set(
            row.payment_method_id,
            roundMoney(previousAmount + parseAmountValue(row.amount)),
          );
        }

        setNextMonthCommitmentByMethodId(nextCommitmentMap);
      }

      if (linkedWorkspaceSummaryResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadExternalSummariesError"),
          message: linkedWorkspaceSummaryResponse.error.message,
        });
        setLinkedWorkspacePaymentMethodBalances([]);
      } else {
        setLinkedWorkspacePaymentMethodBalances(
          (linkedWorkspaceSummaryResponse.data ?? []) as LinkedWorkspacePaymentMethodBalanceRow[],
        );
      }

      if (periodResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadBudgetPeriodError"),
          message: periodResponse.error.message,
        });
        setBudgetItems([]);
        setIsLoadingSummary(false);
        return;
      }

      const period = periodResponse.data as BudgetPeriodIdRow | null;
      if (!period) {
        setBudgetItems([]);
        setIsLoadingSummary(false);
        return;
      }

      const budgetItemsResponse = await supabase
        .from("budget_items")
        .select("category_id, amount")
        .eq("budget_period_id", period.id);

      if (budgetItemsResponse.error) {
        notifications.show({
          color: "red",
          title: t("dashboard.notifications.loadPeriodBudgetError"),
          message: budgetItemsResponse.error.message,
        });
        setBudgetItems([]);
      } else {
        setBudgetItems((budgetItemsResponse.data ?? []) as BudgetItemLiteRow[]);
      }

      setIsLoadingSummary(false);
    };

    void run();
  }, [isBootstrapping, selectedMonth, selectedYear, supabase, t, workspaceId]);

  return {
    categories,
    budgetItems,
    transactionRows,
    allTransactionsImpact,
    futureInstallmentsByMethodId,
    nextMonthCommitmentByMethodId,
    paymentMethodRows,
    linkedWorkspacePaymentMethodBalances,
    startYear,
    currencyCode,
    showCents,
    hasAnyTransactions,
    isBootstrapping,
    isLoadingSummary,
    setIsLoadingSummary,
  };
}
