"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  LoadingOverlay,
  Menu,
  Paper,
  RingProgress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { ProgressCell } from "@/features/dashboard/progress-cell";
import {
  buildMonthOptions,
  localeCompareByName,
  mapPaymentMethodTypeLabel,
  mapTransactionTypeLabel,
  monthLabelFromOptions,
} from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { transactionTypeColorCssVar } from "@/features/transactions/type-colors";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import { excludeTransfers } from "@/features/transactions/queries";
import type { Database, PaymentMethodType, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code" | "show_cents"
>;
type LinkedWorkspaceSummaryRow =
  Database["public"]["Functions"]["list_linked_workspace_summaries"]["Returns"][number];
type BudgetPeriodIdRow = Pick<Database["public"]["Tables"]["budget_periods"]["Row"], "id">;
type BudgetItemLiteRow = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "category_id" | "amount"
>;
type TransactionLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "amount" | "transaction_date" | "effective_date" | "type" | "payment_method_id" | "direction"
>;
type PaymentMethodBalanceRow = Pick<
  Database["public"]["Tables"]["payment_methods"]["Row"],
  "id" | "name" | "type" | "is_active" | "include_in_balance" | "current_balance"
>;

type CategorySummaryRow = {
  categoryId: string;
  categoryName: string;
  categoryIsActive: boolean;
  budgetAmount: number;
  realAmount: number;
  deviation: number;
  executionPercent: number | null;
};

type TotalsByType = Record<
  TransactionType,
  {
    budget: number;
    real: number;
    deviation: number;
  }
>;

type DonutSlice = {
  label: string;
  amount: number;
  value: number;
  color: string;
};

type DonutDataByType = Record<
  TransactionType,
  {
    total: number;
    slices: DonutSlice[];
  }
>;

type FinancialMethodRow = {
  id: string;
  name: string;
  type: PaymentMethodType;
  currentBalance: number;
  monthImpact: number;
};

const deviationTolerance = 0.005;

const typeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
  transfer: 3,
};

const dashboardVisibleTypes: TransactionType[] = ["income", "expense", "saving"];

const compactSummaryTheme: Record<
  TransactionType,
  {
    color: string;
    textColor: string;
  }
> = {
  income: {
    color: transactionTypeColorCssVar("income", 6),
    textColor: transactionTypeColorCssVar("income", 7),
  },
  expense: {
    color: transactionTypeColorCssVar("expense", 6),
    textColor: transactionTypeColorCssVar("expense", 7),
  },
  saving: {
    color: transactionTypeColorCssVar("saving", 6),
    textColor: transactionTypeColorCssVar("saving", 7),
  },
  transfer: {
    color: transactionTypeColorCssVar("transfer", 6),
    textColor: transactionTypeColorCssVar("transfer", 7),
  },
};

const compactSummaryBaseColor = "var(--mantine-color-gray-3)";
const compactSummaryNeutralColor = "var(--mantine-color-gray-5)";

const typeTheme: Record<
  TransactionType,
  {
    main: string;
    header: string;
    palette: string[];
  }
> = {
  income: {
    main: transactionTypeColorCssVar("income", 6),
    header: transactionTypeColorCssVar("income", 7),
    palette: [
      transactionTypeColorCssVar("income", 6),
      transactionTypeColorCssVar("income", 5),
      transactionTypeColorCssVar("income", 4),
      transactionTypeColorCssVar("income", 3),
      transactionTypeColorCssVar("income", 2),
      transactionTypeColorCssVar("income", 1),
    ],
  },
  expense: {
    main: transactionTypeColorCssVar("expense", 6),
    header: transactionTypeColorCssVar("expense", 7),
    palette: [
      transactionTypeColorCssVar("expense", 6),
      transactionTypeColorCssVar("expense", 5),
      transactionTypeColorCssVar("expense", 4),
      transactionTypeColorCssVar("expense", 3),
      transactionTypeColorCssVar("expense", 2),
      transactionTypeColorCssVar("expense", 1),
    ],
  },
  saving: {
    main: transactionTypeColorCssVar("saving", 6),
    header: transactionTypeColorCssVar("saving", 7),
    palette: [
      transactionTypeColorCssVar("saving", 6),
      transactionTypeColorCssVar("saving", 5),
      transactionTypeColorCssVar("saving", 4),
      transactionTypeColorCssVar("saving", 3),
      transactionTypeColorCssVar("saving", 2),
      transactionTypeColorCssVar("saving", 1),
    ],
  },
  transfer: {
    main: transactionTypeColorCssVar("transfer", 6),
    header: transactionTypeColorCssVar("transfer", 7),
    palette: [
      transactionTypeColorCssVar("transfer", 6),
      transactionTypeColorCssVar("transfer", 5),
      transactionTypeColorCssVar("transfer", 4),
      transactionTypeColorCssVar("transfer", 3),
      transactionTypeColorCssVar("transfer", 2),
      transactionTypeColorCssVar("transfer", 1),
    ],
  },
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseAmountValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function buildMonthRange(year: number, month: number) {
  const monthStart = String(month).padStart(2, "0");
  const start = `${year}-${monthStart}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = String(nextMonth).padStart(2, "0");
  const end = `${nextYear}-${nextMonthStart}-01`;
  return { start, end };
}

function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  const roundedValue = roundMoney(value);
  if (Math.abs(roundedValue) < deviationTolerance) {
    return formatter.format(0);
  }

  const absolute = formatter.format(Math.abs(roundedValue));
  return `${roundedValue > 0 ? "+" : "-"}${absolute}`;
}

function buildSafeCurrencyFormatter(
  intlLocale: string,
  currencyCode: string,
  showCents: boolean,
  fallbackFormatter: Intl.NumberFormat,
) {
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  } catch {
    return fallbackFormatter;
  }
}

function sortCategories(a: CategoryRow, b: CategoryRow, locale: "es" | "en") {
  const typeDiff = typeOrder[a.type] - typeOrder[b.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const sortOrderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sortOrderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sortOrderA !== sortOrderB) {
    return sortOrderA - sortOrderB;
  }

  return localeCompareByName(a.name, b.name, locale);
}

function clampToPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 100) {
    return 100;
  }

  return value;
}

function getDeviationColor(type: TransactionType, deviation: number) {
  if (Math.abs(deviation) < deviationTolerance) {
    return "#64748b";
  }

  if (type === "income") {
    return deviation > 0 ? "#087f5b" : "#c92a2a";
  }

  return deviation > 0 ? "#c92a2a" : "#087f5b";
}

export default function DashboardPage() {
  const { supabase, workspace } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const monthOptions = useMemo(() => buildMonthOptions(intlLocale), [intlLocale]);
  const typeLabels = useMemo<Record<TransactionType, string>>(
    () => ({
      income: mapTransactionTypeLabel("income", t, { plural: true }),
      expense: mapTransactionTypeLabel("expense", t, { plural: true }),
      saving: mapTransactionTypeLabel("saving", t, { plural: true }),
      transfer: t("transactions.transfer"),
    }),
    [t],
  );
  const paymentMethodTypeLabels = useMemo<Record<PaymentMethodType, string>>(
    () => ({
      cash: mapPaymentMethodTypeLabel("cash", t),
      debit_card: mapPaymentMethodTypeLabel("debit_card", t),
      credit_card: mapPaymentMethodTypeLabel("credit_card", t),
      bank_transfer: mapPaymentMethodTypeLabel("bank_transfer", t),
      other: mapPaymentMethodTypeLabel("other", t),
    }),
    [t],
  );

  const now = useMemo(() => new Date(), []);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemLiteRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<TransactionLiteRow[]>([]);
  const [allTransactionsImpact, setAllTransactionsImpact] = useState<Map<string, number>>(new Map());
  const [paymentMethodRows, setPaymentMethodRows] = useState<PaymentMethodBalanceRow[]>([]);
  const [linkedWorkspaceSummaries, setLinkedWorkspaceSummaries] = useState<
    LinkedWorkspaceSummaryRow[]
  >([]);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }, [currencyCode, intlLocale, showCents]);

  const percentageFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, [intlLocale]);

  const compactFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [intlLocale]);

  const compactCurrencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [currencyCode, intlLocale]);

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

  const loadBaseData = useCallback(async () => {
    const [categoriesResponse, paymentMethodsResponse, settingsResponse] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("payment_methods")
        .select("id, name, type, is_active, include_in_balance, current_balance")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("start_year, currency_code, show_cents")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
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

    setIsBootstrapping(false);
  }, [locale, supabase, t, workspace.id]);

  const loadSummaryData = useCallback(async () => {
    const { start, end } = buildMonthRange(selectedYear, selectedMonth);
    const periodResponsePromise = supabase
      .from("budget_periods")
      .select("id")
      .eq("workspace_id", workspace.id)
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
        .eq("workspace_id", workspace.id)
        .or(transactionFilter)
    );

    const historicalFilter = [
      `effective_date.lt.${end}`,
      `and(effective_date.is.null,transaction_date.lt.${end})`,
    ].join(",");

    const historicalTransactionsPromise = supabase
      .from("transactions")
      .select("amount, type, payment_method_id, transaction_date, effective_date, direction")
      .eq("workspace_id", workspace.id)
      .or(historicalFilter);

    const linkedWorkspaceSummaryPromise = supabase.rpc("list_linked_workspace_summaries", {
      p_source_workspace_id: workspace.id,
      p_year: selectedYear,
      p_month: selectedMonth,
    });

    const [
      periodResponse,
      transactionsResponse,
      historicalTransactionsResponse,
      linkedWorkspaceSummaryPromiseResponse,
    ] = await Promise.all([
      periodResponsePromise,
      transactionsResponsePromise,
      historicalTransactionsPromise,
      linkedWorkspaceSummaryPromise,
    ]);

    const linkedWorkspaceSummaryResponse = linkedWorkspaceSummaryPromiseResponse;

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
          // In a transfer, we have two records.
          // The OUT record decreases balance, the IN record increases it.
          // This is why we DON'T exclude transfers from historical calculation,
          // because we need them to calculate the current balance correctly.
          signedAmount = row.direction === "in" ? parsedAmount : -parsedAmount;
        }
        const previousAmount = impactMap.get(row.payment_method_id) ?? 0;
        impactMap.set(row.payment_method_id, roundMoney(previousAmount + signedAmount));
      }
      setAllTransactionsImpact(impactMap);
    }

    if (linkedWorkspaceSummaryResponse.error) {
      notifications.show({
        color: "red",
        title: t("dashboard.notifications.loadExternalSummariesError"),
        message: linkedWorkspaceSummaryResponse.error.message,
      });
      setLinkedWorkspaceSummaries([]);
    } else {
      setLinkedWorkspaceSummaries(
        (linkedWorkspaceSummaryResponse.data ?? []) as LinkedWorkspaceSummaryRow[],
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
  }, [selectedMonth, selectedYear, supabase, t, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSummaryData();
  }, [isBootstrapping, loadSummaryData]);

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

    const categoryIdsWithData = new Set<string>([
      ...budgetByCategoryId.keys(),
      ...realByCategoryId.keys(),
    ]);

    const visibleCategories = categories
      .filter((category) => category.is_active || categoryIdsWithData.has(category.id))
      .sort((a, b) => sortCategories(a, b, locale));

    for (const category of visibleCategories) {
      const budgetAmount = roundMoney(budgetByCategoryId.get(category.id) ?? 0);
      const realAmount = roundMoney(realByCategoryId.get(category.id) ?? 0);
      const deviation = roundMoney(realAmount - budgetAmount);
      const executionPercent =
        Math.abs(budgetAmount) < 0.005 ? null : (realAmount / budgetAmount) * 100;

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
      totalsByType[type].deviation = roundMoney(
        totalsByType[type].real - totalsByType[type].budget,
      );
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
      const slices: DonutSlice[] = topRows.map((row, index) => ({
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

  const financialSummary = useMemo(() => {
    const monthImpactByMethodId = new Map<string, number>();

    for (const row of transactionRows) {
      if (!row.payment_method_id) {
        continue;
      }

      const parsedAmount = parseAmountValue(row.amount);
      const signedAmount = row.type === "income" ? parsedAmount : -parsedAmount;
      const previousAmount = monthImpactByMethodId.get(row.payment_method_id) ?? 0;
      monthImpactByMethodId.set(
        row.payment_method_id,
        roundMoney(previousAmount + signedAmount),
      );
    }

    const activeIncludedRows: FinancialMethodRow[] = paymentMethodRows
      .filter((row) => row.is_active && row.include_in_balance)
      .map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        currentBalance: roundMoney((row.current_balance ?? 0) + (allTransactionsImpact.get(row.id) ?? 0)),
        monthImpact: roundMoney(monthImpactByMethodId.get(row.id) ?? 0),
      }))
      .sort((a, b) => {
        if (b.currentBalance !== a.currentBalance) {
          return b.currentBalance - a.currentBalance;
        }

        return localeCompareByName(a.name, b.name, locale);
      });

    const totalBalance = roundMoney(
      activeIncludedRows.reduce((sum, row) => sum + row.currentBalance, 0),
    );
    const totalMonthImpact = roundMoney(
      activeIncludedRows.reduce((sum, row) => sum + row.monthImpact, 0),
    );
    const excludedActiveCount = paymentMethodRows.filter(
      (row) => row.is_active && !row.include_in_balance,
    ).length;
    const inactiveCount = paymentMethodRows.filter((row) => !row.is_active).length;

    return {
      activeIncludedRows,
      totalBalance,
      totalMonthImpact,
      excludedActiveCount,
      inactiveCount,
    };
  }, [allTransactionsImpact, locale, paymentMethodRows, transactionRows]);

  const normalizedLinkedWorkspaceSummaries = useMemo(() => {
    return linkedWorkspaceSummaries.map((row) => {
      const incomeTotal = roundMoney(parseAmountValue(row.income_total));
      const expenseTotal = roundMoney(parseAmountValue(row.expense_total));
      const savingTotal = roundMoney(parseAmountValue(row.saving_total));
      const balanceTotal = roundMoney(parseAmountValue(row.balance_total));

      return {
        ...row,
        incomeTotal,
        expenseTotal,
        savingTotal,
        balanceTotal,
      };
    });
  }, [linkedWorkspaceSummaries]);

  const linkedWorkspaceSummariesByCurrency = useMemo(() => {
    const summariesByCurrency = new Map<string, typeof normalizedLinkedWorkspaceSummaries>();

    for (const row of normalizedLinkedWorkspaceSummaries) {
      const currencyKey = (row.target_currency_code ?? "N/A").toUpperCase();
      const existingRows = summariesByCurrency.get(currencyKey);
      if (existingRows) {
        existingRows.push(row);
      } else {
        summariesByCurrency.set(currencyKey, [row]);
      }
    }

    return Array.from(summariesByCurrency.entries())
      .sort(([currencyA], [currencyB]) => currencyA.localeCompare(currencyB, intlLocale))
      .map(([currencyCode, rows]) => ({
        currencyCode,
        rows: [...rows].sort((a, b) =>
          localeCompareByName(a.target_workspace_name, b.target_workspace_name, locale),
        ),
      }));
  }, [intlLocale, locale, normalizedLinkedWorkspaceSummaries]);

  const linkedWorkspaceCurrencyFormatters = useMemo(() => {
    const formattersByCode = new Map<string, Intl.NumberFormat>();

    for (const group of linkedWorkspaceSummariesByCurrency) {
      formattersByCode.set(
        group.currencyCode,
        buildSafeCurrencyFormatter(intlLocale, group.currencyCode, showCents, currencyFormatter),
      );
    }

    return formattersByCode;
  }, [currencyFormatter, intlLocale, linkedWorkspaceSummariesByCurrency, showCents]);

  const shouldShowLinkedWorkspaceSummary = useMemo(() => {
    return normalizedLinkedWorkspaceSummaries.length > 0;
  }, [normalizedLinkedWorkspaceSummaries]);

  const selectedPeriodLabel = `${monthLabelFromOptions(
    selectedMonth,
    monthOptions,
    t("common.messages.month"),
  )} ${selectedYear}`;
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const isNarrowMobile = useMediaQuery("(max-width: 33.99em)");
  const isTablet = useMediaQuery("(min-width: 48em) and (max-width: 74.99em)");

  const kpiColumns = isMobile ? (isNarrowMobile ? 1 : 2) : 2;
  const distributionColumns = isMobile ? 1 : isTablet ? 1 : 3;
  const isDesktop = !isMobile && !isTablet;
  const cardPadding = isMobile ? "xs" : "sm";
  const tableHorizontalSpacing = isMobile ? "xs" : "sm";
  const tableVerticalSpacing = isMobile ? 5 : 6;
  const executionBarWidth = isMobile ? "100%" : isTablet ? 88 : 96;
  const donutSize = isMobile ? 76 : isTablet ? 84 : 96;
  const donutThickness = isMobile ? 9 : 11;
  const compactSummaryDonutSize = isNarrowMobile ? 80 : 96;
  const compactSummaryDonutThickness = isNarrowMobile ? 10 : 12;
  const tableColumnWidths = isMobile
    ? {
        category: "38%",
        real: "16%",
        execution: "24%",
        deviation: "22%",
      }
    : isTablet
      ? {
          category: "33%",
          real: "17%",
          budget: "17%",
          execution: "20%",
          deviation: "13%",
        }
      : {
          category: "35%",
          real: "17%",
          budget: "17%",
          execution: "18%",
          deviation: "13%",
        };

  const paymentMethodDrilldownHref = useCallback(
    (paymentMethodId: string) =>
      buildTransactionsDrilldownHref({
        workspaceSlug: workspace.slug,
        year: selectedYear,
        month: selectedMonth,
        paymentMethodId,
      }),
    [selectedMonth, selectedYear, workspace.slug],
  );

  const categoryDrilldownHref = useCallback(
    (type: TransactionType, categoryId: string) =>
      buildTransactionsDrilldownHref({
        workspaceSlug: workspace.slug,
        year: selectedYear,
        month: selectedMonth,
        type,
        categoryId,
      }),
    [selectedMonth, selectedYear, workspace.slug],
  );

  const financialMethodsCard = (
    <Paper
      withBorder
      radius="sm"
      p={isMobile ? "xs" : "sm"}
      bg="#ffffff"
      style={{ borderColor: "#d6dde7" }}
    >
      <Stack gap={isMobile ? "xs" : "sm"}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap={6}>
          <Stack gap={2}>
            <Text size="xs" fw={700} c="#475467">
              {t("dashboard.financialMethods")}
            </Text>
            <Text fw={800} c={financialSummary.totalBalance >= 0 ? "#087f5b" : "#c92a2a"}>
              {t("dashboard.totalBalance")}: {currencyFormatter.format(financialSummary.totalBalance)}
            </Text>
            <Text size="xs" fw={700} c={financialSummary.totalMonthImpact >= 0 ? "#087f5b" : "#c92a2a"}>
              {t("dashboard.monthImpact")}: {formatSignedCurrency(financialSummary.totalMonthImpact, currencyFormatter)}
            </Text>
            <Text size="xs" c="#667085">
              {t("dashboard.activeInBalance", undefined, {
                count: financialSummary.activeIncludedRows.length,
              })}
            </Text>
          </Stack>
        </Group>

        {financialSummary.activeIncludedRows.length === 0 ? (
          <Text size="xs" c="#667085">
            {t("dashboard.noActiveMethodsInMainBalance")}
          </Text>
        ) : (
          <Stack gap={6}>
            {financialSummary.activeIncludedRows.map((row) => (
              <UnstyledButton
                key={row.id}
                component={Link}
                href={paymentMethodDrilldownHref(row.id)}
                className="dashboard-clickable-item"
                style={{
                  display: "block",
                  borderRadius: 8,
                  border: "1px solid #e4e7ec",
                  backgroundColor: "#f8fafc",
                  padding: isMobile ? "6px 8px" : "6px 10px",
                }}
              >
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text size="sm" fw={700} c="#1f2937" truncate>
                      {row.name}
                    </Text>
                    <Text size="xs" c="#667085">
                      {paymentMethodTypeLabels[row.type]} · {t("dashboard.viewMovements")}
                    </Text>
                  </Stack>
                  <Stack gap={0} style={{ minWidth: 0, textAlign: "right" }}>
                    <Text
                      size="sm"
                      fw={800}
                      c={row.currentBalance >= 0 ? "#087f5b" : "#c92a2a"}
                    >
                      {currencyFormatter.format(row.currentBalance)}
                    </Text>
                    <Text
                      size="10px"
                      fw={700}
                      c={row.monthImpact >= 0 ? "#087f5b" : "#c92a2a"}
                    >
                      {t("dashboard.monthlyMovementLabel")}: {formatSignedCurrency(row.monthImpact, currencyFormatter)}
                    </Text>
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {financialSummary.excludedActiveCount > 0 || financialSummary.inactiveCount > 0 ? (
          <Text size="xs" c="#98a2b3">
            {t("dashboard.outOfBalanceSummary", undefined, {
              excluded: financialSummary.excludedActiveCount,
              inactive: financialSummary.inactiveCount,
            })}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );

  const balancePeriodCard = (
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="#ffffff">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="#475467">
          {t("dashboard.periodBalance")}
        </Text>
        <Text fw={800} c={metrics.balanceReal >= 0 ? "#0ca678" : "#e03131"}>
          {currencyFormatter.format(metrics.balanceReal)}
        </Text>
        <Text size="xs" c="#667085">
          {t("dashboard.budgetAbbrev")}: {currencyFormatter.format(metrics.balanceBudget)}
        </Text>
        <Text size="xs" c={metrics.balanceDelta >= 0 ? "#087f5b" : "#c92a2a"}>
          {t("dashboard.delta")}: {formatSignedCurrency(metrics.balanceDelta, currencyFormatter)}
        </Text>
      </Stack>
    </Paper>
  );

  const savingsPeriodCard = (
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="#ffffff">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="#475467">
          {t("dashboard.periodSavings")}
        </Text>
        <Text fw={800} c="#2b8aaf">
          {currencyFormatter.format(metrics.totalsByType.saving.real)}
        </Text>
        <Text size="xs" c="#667085">
          {t("dashboard.budgetAbbrev")}: {currencyFormatter.format(metrics.totalsByType.saving.budget)}
        </Text>
        <Text size="xs" c="#667085">
          {t("dashboard.ratio")}:{" "}
          {savingsVsIncome === null
            ? t("dashboard.notApplicable")
            : t("dashboard.incomeRatio", undefined, { value: percentageFormatter.format(savingsVsIncome) })}
        </Text>
      </Stack>
    </Paper>
  );

  return (
    <Stack gap={isMobile ? "xs" : "sm"} pos="relative">
      <LoadingOverlay visible={isBootstrapping || isLoadingSummary} />

      <Paper
        radius="sm"
        p={isMobile ? "xs" : "sm"}
        style={{
          border: "1px solid #d6dde7",
          backgroundColor: "#ffffff",
        }}
      >
        <Group justify="space-between" align={isMobile ? "flex-start" : "end"} wrap="wrap" gap="xs">
          <Stack gap={1}>
            <Title order={2} component="h1" size="h3" c="#1f2937">
              {t("dashboard.financialDashboard")}
            </Title>
            <Text fw={700} size="md" c="#344054">
              {selectedPeriodLabel}
            </Text>
            <Text size="xs" c="#667085">
              {t("dashboard.workspaceCurrency", undefined, {
                workspaceName: workspace.name,
                currencyCode,
              })}
            </Text>
          </Stack>
          <Group gap={6} align="center" wrap="wrap">
            <Button
              component={Link}
              href={`/app/${workspace.slug}/insights`}
              variant="light"
              color="indigo"
              size="xs"
            >
              {t("dashboard.viewInsights")}
            </Button>
            <Menu shadow="md" width={220} position="bottom-end">
              <Menu.Target>
                <UnstyledButton
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid #d0d5dd",
                    backgroundColor: "#f8fafc",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#344054",
                    cursor: "pointer",
                  }}
                >
                  {selectedPeriodLabel}
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>{t("dashboard.month")}</Menu.Label>
                {monthOptions.map((option) => {
                  const monthValue = Number(option.value);
                  const isSelected = monthValue === selectedMonth;

                  return (
                    <Menu.Item
                      key={`month-${option.value}`}
                      onClick={() => {
                        if (isSelected) {
                          return;
                        }

                        setIsLoadingSummary(true);
                        setSelectedMonth(monthValue);
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="xs">{option.label}</Text>
                        {isSelected ? (
                          <Badge variant="light" color="blue" size="xs">
                            {t("dashboard.current")}
                          </Badge>
                        ) : null}
                      </Group>
                    </Menu.Item>
                  );
                })}

                <Menu.Divider />
                <Menu.Label>{t("dashboard.year")}</Menu.Label>
                {yearOptions.map((option) => {
                  const yearValue = Number(option.value);
                  const isSelected = yearValue === selectedYear;

                  return (
                    <Menu.Item
                      key={`year-${option.value}`}
                      onClick={() => {
                        if (isSelected) {
                          return;
                        }

                        setIsLoadingSummary(true);
                        setSelectedYear(yearValue);
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="xs">{option.label}</Text>
                        {isSelected ? (
                          <Badge variant="light" color="blue" size="xs">
                            {t("dashboard.current")}
                          </Badge>
                        ) : null}
                      </Group>
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Paper>

      {isMobile ? (
        <Paper
          p="xs"
          radius="sm"
          style={{
            border: "1px solid #d6dde7",
            backgroundColor: "#ffffff",
          }}
        >
          <SimpleGrid cols={3} spacing={8}>
            {dashboardVisibleTypes.map((type) => {
              const realValue = roundMoney(Math.max(0, metrics.totalsByType[type].real));
              const budgetValue = roundMoney(Math.max(0, metrics.totalsByType[type].budget));
              const theme = compactSummaryTheme[type];
              const hasBudget = budgetValue > deviationTolerance;
              const ratio = hasBudget ? Math.min(realValue / budgetValue, 1) : 0;
              const progressValue = clampToPercent(ratio * 100);
              const sections = hasBudget
                ? progressValue > 0
                  ? [{ value: progressValue, color: theme.color }]
                  : []
                : [{ value: 100, color: compactSummaryNeutralColor }];

              return (
                <Paper
                  key={`compact-summary-${type}`}
                  radius="sm"
                  p={6}
                  style={{
                    border: "1px solid #e4e7ec",
                    backgroundColor: "#f8fafc",
                    minWidth: 0,
                  }}
                >
                  <Stack gap={4} align="center">
                    <RingProgress
                      size={compactSummaryDonutSize}
                      thickness={compactSummaryDonutThickness}
                      roundCaps
                      rootColor={compactSummaryBaseColor}
                      sections={sections}
                      label={
                        <Text
                          size={isNarrowMobile ? "9px" : "10px"}
                          fw={800}
                          ta="center"
                          c="#1f2937"
                        >
                          {compactCurrencyFormatter.format(realValue)}
                        </Text>
                      }
                    />
                    <Text
                      size={isNarrowMobile ? "9px" : "10px"}
                      fw={700}
                      c={theme.textColor}
                      ta="center"
                    >
                      {typeLabels[type]}
                    </Text>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Paper>
      ) : null}

      {isDesktop ? (
        <Grid gap="sm" align="stretch">
          <Grid.Col span={6}>{financialMethodsCard}</Grid.Col>
          <Grid.Col span={6}>
            <Stack gap="sm" h="100%">
              {balancePeriodCard}
              {savingsPeriodCard}
            </Stack>
          </Grid.Col>
        </Grid>
      ) : (
        <>
          {financialMethodsCard}
          <SimpleGrid cols={kpiColumns} spacing={isMobile ? "xs" : "sm"}>
            {balancePeriodCard}
            {savingsPeriodCard}
          </SimpleGrid>
        </>
      )}

      {shouldShowLinkedWorkspaceSummary ? (
        <Paper
          p={isMobile ? "xs" : "sm"}
          radius="sm"
          style={{
            border: "1px dashed #9ec5fe",
            backgroundColor: "#f5f9ff",
          }}
        >
          <Stack gap={isMobile ? 6 : "xs"}>
            <Group justify="space-between" align="center" wrap="wrap" gap={6}>
              <Stack gap={1}>
                <Text size="xs" fw={800} c="#1d4ed8">
                  {t("dashboard.linkedWorkspacesExternalSummary")}
                </Text>
                <Text size="xs" c="#475467">
                  {t("dashboard.linkedWorkspacesExternalSummaryDescription")}
                </Text>
              </Stack>
              <Badge variant="light" color="blue">
                {t("dashboard.linkedCount", undefined, {
                  count: normalizedLinkedWorkspaceSummaries.length,
                })}
              </Badge>
            </Group>

            <Text size="xs" c="#475467">
              {t("dashboard.linkedWorkspacesNoConversion")}
            </Text>

            <Stack gap={6}>
              {linkedWorkspaceSummariesByCurrency.map((group) => {
                const groupCurrencyFormatter =
                  linkedWorkspaceCurrencyFormatters.get(group.currencyCode) ?? currencyFormatter;

                return (
                  <Stack key={group.currencyCode} gap={6}>
                    <Text size="xs" fw={700} c="#475467">
                      — {group.currencyCode} —
                    </Text>

                    {group.rows.map((row) => (
                      <Paper
                        key={row.link_id}
                        withBorder
                        radius="sm"
                        p={isMobile ? "xs" : "sm"}
                        bg="#ffffff"
                      >
                        <Stack gap={4}>
                          <Group justify="space-between" align="center" wrap="wrap" gap={6}>
                            <Text size="sm" fw={700} c="#1f2937">
                              {row.target_workspace_name}
                            </Text>
                            <Badge variant="light" color="gray">
                              {row.target_currency_code} · {row.visibility_mode}
                            </Badge>
                          </Group>
                          <SimpleGrid cols={isMobile ? 2 : 4} spacing={isMobile ? 6 : "xs"}>
                            <Text size="xs" c="#344054">
                              {t("dashboard.incomeLabel")}: {groupCurrencyFormatter.format(row.incomeTotal)}
                            </Text>
                            <Text size="xs" c="#344054">
                              {t("dashboard.expenseLabel")}: {groupCurrencyFormatter.format(row.expenseTotal)}
                            </Text>
                            <Text size="xs" c="#344054">
                              {t("dashboard.savingLabel")}: {groupCurrencyFormatter.format(row.savingTotal)}
                            </Text>
                            <Text size="xs" fw={700} c={row.balanceTotal >= 0 ? "#087f5b" : "#c92a2a"}>
                              {t("dashboard.balanceLabel")}: {groupCurrencyFormatter.format(row.balanceTotal)}
                            </Text>
                          </SimpleGrid>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Stack gap={isMobile ? "xs" : "sm"}>
        {summaryRows.map(({ type, rows }) => {
          const totals = metrics.totalsByType[type];
          const totalExecutionPercent =
            Math.abs(totals.budget) < 0.005 ? null : (totals.real / totals.budget) * 100;

          return (
            <Paper
              key={type}
              radius="sm"
              style={{
                border: "1px solid #d6dde7",
                backgroundColor: "#ffffff",
              }}
            >
              <Box
                px={isMobile ? "xs" : "sm"}
                py={6}
                style={{
                  backgroundColor: "#f8fafc",
                  borderBottom: "1px solid #d6dde7",
                }}
              >
                <Group justify="space-between" wrap={isMobile ? "wrap" : "nowrap"} gap={6}>
                  <Text size="xs" fw={800} c={typeTheme[type].header}>
                    {typeLabels[type]}
                  </Text>
                  <Text size="xs" c="#667085">
                    {isMobile
                      ? t("dashboard.realBudgetCompact", undefined, {
                          real: compactFormatter.format(totals.real),
                          budget: compactFormatter.format(totals.budget),
                        })
                      : t("dashboard.realBudgetFull", undefined, {
                          real: currencyFormatter.format(totals.real),
                          budget: currencyFormatter.format(totals.budget),
                        })}
                  </Text>
                </Group>
              </Box>

              <Table
                horizontalSpacing={tableHorizontalSpacing}
                verticalSpacing={tableVerticalSpacing}
                style={{ color: "#1f2937", tableLayout: "fixed", width: "100%" }}
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ color: "#475467", width: tableColumnWidths.category }}>
                      {t("dashboard.category")}
                    </Table.Th>
                    <Table.Th style={{ color: "#475467", textAlign: "right", width: tableColumnWidths.real }}>
                      {t("dashboard.real")}
                    </Table.Th>
                    {!isMobile ? (
                      <Table.Th
                        style={{ color: "#475467", textAlign: "right", width: tableColumnWidths.budget }}
                      >
                        {t("dashboard.budgetAbbrevWithDot")}
                      </Table.Th>
                    ) : null}
                    <Table.Th
                      style={{
                        color: "#475467",
                        textAlign: isMobile ? "left" : "right",
                        width: tableColumnWidths.execution,
                      }}
                    >
                      {t("dashboard.executionAbbrev")}
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "#475467",
                        textAlign: "right",
                        width: tableColumnWidths.deviation,
                      }}
                    >
                      {t("dashboard.deviation")}
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={isMobile ? 4 : 5}>
                        <Text size="xs" c="#98a2b3">
                          {t("dashboard.noCategoriesForType")}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    rows.map((row) => {
                      const deviationColor = getDeviationColor(type, row.deviation);

                      return (
                        <Table.Tr key={row.categoryId}>
                          <Table.Td>
                            <Group gap={6} wrap={isMobile ? "wrap" : "nowrap"}>
                              <Text
                                component={Link}
                                href={categoryDrilldownHref(type, row.categoryId)}
                                size="xs"
                                c="#1f2937"
                                lineClamp={isMobile ? 2 : 1}
                                style={{ textDecoration: "none" }}
                              >
                                {row.categoryName}
                              </Text>
                              {!isMobile && !row.categoryIsActive ? (
                                <Text size="xs" c="#98a2b3">
                                  {t("dashboard.inactive")}
                                </Text>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ textAlign: isMobile ? "left" : "right" }}>
                            <Text size="xs" c="#1f2937">
                              {compactFormatter.format(row.realAmount)}
                            </Text>
                          </Table.Td>
                          {!isMobile ? (
                            <Table.Td style={{ textAlign: "right" }}>
                              <Text size="xs" c="#475467">
                                {compactFormatter.format(row.budgetAmount)}
                              </Text>
                            </Table.Td>
                          ) : null}
                          <Table.Td style={{ textAlign: "right" }}>
                            <Box
                              style={{
                                width: executionBarWidth,
                                marginLeft: isMobile ? 0 : "auto",
                              }}
                            >
                              <ProgressCell
                                type={type}
                                value={row.executionPercent}
                                percentageFormatter={percentageFormatter}
                                compact={isMobile}
                              />
                            </Box>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Text size="xs" c={deviationColor} fw={700}>
                              {formatSignedCurrency(row.deviation, compactFormatter)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                  )}

                  <Table.Tr
                    style={{
                      backgroundColor: "#f3f7ff",
                      borderTop: "1px solid #d0d9e7",
                    }}
                  >
                    <Table.Td>
                      <Text size="xs" fw={800} c="#344054">
                        {t("dashboard.totalUpper")}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: isMobile ? "left" : "right" }}>
                      <Text size="xs" fw={800} c="#344054">
                        {compactFormatter.format(totals.real)}
                      </Text>
                    </Table.Td>
                    {!isMobile ? (
                      <Table.Td style={{ textAlign: "right" }}>
                        <Text size="xs" fw={800} c="#344054">
                          {compactFormatter.format(totals.budget)}
                        </Text>
                      </Table.Td>
                    ) : null}
                    <Table.Td style={{ textAlign: "right" }}>
                      <Box
                        style={{
                          width: executionBarWidth,
                          marginLeft: isMobile ? 0 : "auto",
                        }}
                      >
                        <ProgressCell
                          type={type}
                          value={totalExecutionPercent}
                          percentageFormatter={percentageFormatter}
                          compact={isMobile}
                        />
                      </Box>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="xs" fw={800} c={getDeviationColor(type, totals.deviation)}>
                        {formatSignedCurrency(totals.deviation, compactFormatter)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Paper>
          );
        })}
      </Stack>

      {!isMobile ? (
        <Paper
          p={cardPadding}
          radius="sm"
          style={{
            border: "1px solid #d6dde7",
            backgroundColor: "#ffffff",
          }}
        >
          <Stack gap={isMobile ? 6 : "xs"}>
            <Text size="xs" fw={800} c="#344054">
              {t("dashboard.realDistributionByType")}
            </Text>

            <SimpleGrid cols={distributionColumns} spacing={isMobile ? 6 : "xs"}>
              {dashboardVisibleTypes.map((type) => {
                const donut = donutData[type];
                const hasData = donut.slices.length > 0;

              return (
                <Paper
                  key={type}
                  p={isMobile ? 6 : "xs"}
                  radius="sm"
                  style={{
                    border: "1px solid #e4e7ec",
                    backgroundColor: "#fbfcff",
                    minHeight: hasData ? (isMobile ? 96 : 86) : isMobile ? 76 : 64,
                  }}
                >
                  <Box
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile ? "1fr" : "120px minmax(0, 1fr)",
                      gap: isMobile ? 8 : 10,
                      alignItems: "center",
                    }}
                  >
                    <Box
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <RingProgress
                        size={isMobile ? donutSize : 86}
                        thickness={donutThickness}
                        roundCaps
                        sections={
                          hasData
                            ? donut.slices.map((slice) => ({
                                value: clampToPercent(slice.value),
                                color: slice.color,
                              }))
                            : [{ value: 100, color: "#e4e7ec" }]
                        }
                        label={
                          <Text size={isMobile ? "9px" : "10px"} c="#344054" ta="center" fw={700}>
                            {compactCurrencyFormatter.format(donut.total)}
                          </Text>
                        }
                      />
                    </Box>

                    <Stack gap={4} style={{ minWidth: 0 }}>
                      <Text size="xs" fw={700} c={typeTheme[type].main}>
                        {typeLabels[type]}
                      </Text>
                      {!hasData ? (
                        <Text size={isMobile ? "11px" : "xs"} c="#98a2b3">
                          {t("dashboard.noRealDataInPeriod")}
                        </Text>
                      ) : (
                        donut.slices.map((slice) => (
                          <Group key={`${type}-${slice.label}`} justify="space-between" gap={6} wrap="nowrap">
                            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                              <Box h={8} w={8} style={{ borderRadius: 2, backgroundColor: slice.color }} />
                              <Text size={isMobile ? "11px" : "xs"} c="#344054" lineClamp={1}>
                                {slice.label}
                              </Text>
                            </Group>
                            <Text
                              size={isMobile ? "11px" : "xs"}
                              c="#344054"
                              fw={700}
                              style={{ textAlign: "right", whiteSpace: "nowrap" }}
                            >
                              {compactCurrencyFormatter.format(slice.amount)}
                            </Text>
                          </Group>
                        ))
                      )}
                    </Stack>
                  </Box>
                </Paper>
              );
              })}
            </SimpleGrid>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
