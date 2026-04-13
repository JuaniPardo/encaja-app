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
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { ProgressCell } from "@/features/dashboard/progress-cell";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { useWorkspace } from "@/features/workspace/workspace-provider";
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
  "category_id" | "amount" | "transaction_date" | "effective_date" | "type" | "payment_method_id"
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
};

const deviationTolerance = 0.005;

const monthOptions = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
] as const;

const typeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
};

const typeLabels: Record<TransactionType, string> = {
  income: "Ingresos",
  expense: "Gastos",
  saving: "Ahorro",
};

const compactSummaryTheme: Record<
  TransactionType,
  {
    color: string;
    label: string;
    textColor: string;
  }
> = {
  income: {
    color: "var(--mantine-color-teal-6)",
    label: "Ingresos",
    textColor: "var(--mantine-color-teal-7)",
  },
  expense: {
    color: "var(--mantine-color-pink-6)",
    label: "Gastos",
    textColor: "var(--mantine-color-pink-7)",
  },
  saving: {
    color: "var(--mantine-color-indigo-5)",
    label: "Ahorro",
    textColor: "var(--mantine-color-indigo-7)",
  },
};

const compactSummaryBaseColor = "var(--mantine-color-gray-3)";
const compactSummaryNeutralColor = "var(--mantine-color-gray-5)";

const paymentMethodTypeLabels: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  debit_card: "Tarjeta débito",
  credit_card: "Tarjeta crédito",
  bank_transfer: "Transferencia",
  other: "Otro",
};

const typeTheme: Record<
  TransactionType,
  {
    main: string;
    header: string;
    palette: string[];
  }
> = {
  income: {
    main: "#00a552",
    header: "#00863f",
    palette: ["#00a552", "#00bf60", "#40cd85", "#74daaa", "#a7e8ce", "#d7f5e8"],
  },
  expense: {
    main: "#e60062",
    header: "#c10052",
    palette: ["#e60062", "#ff2f84", "#ff63a3", "#ff95c1", "#ffc4dc", "#ffe0ef"],
  },
  saving: {
    main: "#00a0d6",
    header: "#007faa",
    palette: ["#00a0d6", "#00b8f2", "#44c8f5", "#79d9f8", "#ade9fb", "#dbf5fe"],
  },
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePaymentMethodBalance(type: PaymentMethodType, value: unknown) {
  const parsed = parseAmountValue(value);
  if (Math.abs(parsed) < deviationTolerance) {
    return 0;
  }

  if (type === "credit_card") {
    return -Math.abs(parsed);
  }

  return parsed;
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

function monthLabel(month: number) {
  return monthOptions.find((option) => Number(option.value) === month)?.label ?? `Mes ${month}`;
}

function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  const roundedValue = roundMoney(value);
  if (Math.abs(roundedValue) < deviationTolerance) {
    return formatter.format(0);
  }

  const absolute = formatter.format(Math.abs(roundedValue));
  return `${roundedValue > 0 ? "+" : "-"}${absolute}`;
}

function sortCategories(a: CategoryRow, b: CategoryRow) {
  const typeDiff = typeOrder[a.type] - typeOrder[b.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const sortOrderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sortOrderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sortOrderA !== sortOrderB) {
    return sortOrderA - sortOrderB;
  }

  return a.name.localeCompare(b.name, "es");
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

  const now = useMemo(() => new Date(), []);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemLiteRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<TransactionLiteRow[]>([]);
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
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }, [currencyCode, showCents]);

  const percentageFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }, []);

  const compactFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, []);

  const compactCurrencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }, [currencyCode]);

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
        title: "No pudimos cargar categorías",
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const sortedCategories = [...categoriesResponse.data].sort(sortCategories);
      setCategories(sortedCategories);
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar settings",
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
        title: "No pudimos cargar medios financieros",
        message: paymentMethodsResponse.error.message,
      });
      setPaymentMethodRows([]);
    } else {
      setPaymentMethodRows((paymentMethodsResponse.data ?? []) as PaymentMethodBalanceRow[]);
    }

    setIsBootstrapping(false);
  }, [supabase, workspace.id]);

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

    const transactionsResponsePromise = supabase
      .from("transactions")
      .select("category_id, amount, transaction_date, effective_date, type, payment_method_id")
      .eq("workspace_id", workspace.id)
      .or(transactionFilter);

    const linkedWorkspaceSummaryPromise = supabase.rpc("list_linked_workspace_summaries", {
      p_source_workspace_id: workspace.id,
      p_year: selectedYear,
      p_month: selectedMonth,
    });

    const [periodResponse, transactionsResponse, linkedWorkspaceSummaryResponse] = await Promise.all([
      periodResponsePromise,
      transactionsResponsePromise,
      linkedWorkspaceSummaryPromise,
    ]);

    if (transactionsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar transacciones del período",
        message: transactionsResponse.error.message,
      });
      setTransactionRows([]);
    } else {
      setTransactionRows((transactionsResponse.data ?? []) as TransactionLiteRow[]);
    }

    if (linkedWorkspaceSummaryResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar resúmenes externos",
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
        title: "No pudimos cargar el período presupuestario",
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
        title: "No pudimos cargar presupuesto del período",
        message: budgetItemsResponse.error.message,
      });
      setBudgetItems([]);
    } else {
      setBudgetItems((budgetItemsResponse.data ?? []) as BudgetItemLiteRow[]);
    }

    setIsLoadingSummary(false);
  }, [selectedMonth, selectedYear, supabase, workspace.id]);

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
    };

    const totalsByType: TotalsByType = {
      income: { budget: 0, real: 0, deviation: 0 },
      expense: { budget: 0, real: 0, deviation: 0 },
      saving: { budget: 0, real: 0, deviation: 0 },
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
      .sort(sortCategories);

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
  }, [budgetItems, categories, transactionRows]);

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
          label: "Otras categorías",
          amount: restAmount,
          value: (restAmount / total) * 100,
          color: "#b0b4bb",
        });
      }

      data[type] = { total: roundMoney(total), slices };
    }

    return data;
  }, [metrics.groupedRows]);

  const summaryRows = useMemo(() => {
    return (Object.keys(metrics.groupedRows) as TransactionType[]).map((type) => ({
      type,
      rows: metrics.groupedRows[type],
    }));
  }, [metrics.groupedRows]);

  const financialSummary = useMemo(() => {
    const transactionImpactByMethodId = new Map<string, number>();

    for (const row of transactionRows) {
      if (!row.payment_method_id) {
        continue;
      }

      const parsedAmount = parseAmountValue(row.amount);
      const signedAmount = row.type === "income" ? parsedAmount : -parsedAmount;
      const previousAmount = transactionImpactByMethodId.get(row.payment_method_id) ?? 0;
      transactionImpactByMethodId.set(
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
        currentBalance: (() => {
          const manualBalance = normalizePaymentMethodBalance(row.type, row.current_balance);
          if (Math.abs(manualBalance) >= deviationTolerance) {
            return manualBalance;
          }

          return roundMoney(transactionImpactByMethodId.get(row.id) ?? 0);
        })(),
      }))
      .sort((a, b) => {
        if (b.currentBalance !== a.currentBalance) {
          return b.currentBalance - a.currentBalance;
        }

        return a.name.localeCompare(b.name, "es");
      });

    const totalBalance = roundMoney(
      activeIncludedRows.reduce((sum, row) => sum + row.currentBalance, 0),
    );
    const positiveCount = activeIncludedRows.filter((row) => row.currentBalance > 0).length;
    const negativeCount = activeIncludedRows.filter((row) => row.currentBalance < 0).length;
    const excludedActiveCount = paymentMethodRows.filter(
      (row) => row.is_active && !row.include_in_balance,
    ).length;
    const inactiveCount = paymentMethodRows.filter((row) => !row.is_active).length;

    return {
      activeIncludedRows,
      totalBalance,
      positiveCount,
      negativeCount,
      excludedActiveCount,
      inactiveCount,
    };
  }, [paymentMethodRows, transactionRows]);

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

  const linkedWorkspaceTotals = useMemo(() => {
    return normalizedLinkedWorkspaceSummaries.reduce(
      (totals, row) => ({
        incomeTotal: roundMoney(totals.incomeTotal + row.incomeTotal),
        expenseTotal: roundMoney(totals.expenseTotal + row.expenseTotal),
        savingTotal: roundMoney(totals.savingTotal + row.savingTotal),
        balanceTotal: roundMoney(totals.balanceTotal + row.balanceTotal),
      }),
      {
        incomeTotal: 0,
        expenseTotal: 0,
        savingTotal: 0,
        balanceTotal: 0,
      },
    );
  }, [normalizedLinkedWorkspaceSummaries]);

  const selectedPeriodLabel = `${monthLabel(selectedMonth)} ${selectedYear}`;
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
        category: "30%",
        real: "15%",
        budget: "15%",
        execution: "24%",
        deviation: "16%",
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
              Medios financieros
            </Text>
            <Text fw={800} c={financialSummary.totalBalance >= 0 ? "#087f5b" : "#c92a2a"}>
              Balance total: {currencyFormatter.format(financialSummary.totalBalance)}
            </Text>
            <Text size="xs" c="#667085">
              {financialSummary.activeIncludedRows.length} activos en balance
            </Text>
          </Stack>
          <Group gap={6} wrap="wrap">
            <Badge color="teal" variant={financialSummary.positiveCount > 0 ? "light" : "outline"}>
              {financialSummary.positiveCount} positivos
            </Badge>
            <Badge color="red" variant={financialSummary.negativeCount > 0 ? "light" : "outline"}>
              {financialSummary.negativeCount} negativos
            </Badge>
          </Group>
        </Group>

        {financialSummary.activeIncludedRows.length === 0 ? (
          <Text size="xs" c="#667085">
            No hay medios activos incluidos en el balance principal.
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
                      {paymentMethodTypeLabels[row.type]} · Ver movimientos
                    </Text>
                  </Stack>
                  <Text
                    size="sm"
                    fw={800}
                    c={row.currentBalance >= 0 ? "#087f5b" : "#c92a2a"}
                  >
                    {currencyFormatter.format(row.currentBalance)}
                  </Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {financialSummary.excludedActiveCount > 0 || financialSummary.inactiveCount > 0 ? (
          <Text size="xs" c="#98a2b3">
            Fuera del balance: {financialSummary.excludedActiveCount} activos excluidos y{" "}
            {financialSummary.inactiveCount} inactivos.
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );

  const balancePeriodCard = (
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="#ffffff">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="#475467">
          Balance período
        </Text>
        <Text fw={800} c={metrics.balanceReal >= 0 ? "#0ca678" : "#e03131"}>
          {currencyFormatter.format(metrics.balanceReal)}
        </Text>
        <Text size="xs" c="#667085">
          Presup: {currencyFormatter.format(metrics.balanceBudget)}
        </Text>
        <Text size="xs" c={metrics.balanceDelta >= 0 ? "#087f5b" : "#c92a2a"}>
          Delta: {formatSignedCurrency(metrics.balanceDelta, currencyFormatter)}
        </Text>
      </Stack>
    </Paper>
  );

  const savingsPeriodCard = (
    <Paper withBorder radius="sm" p={isDesktop ? "sm" : "xs"} bg="#ffffff">
      <Stack gap={4}>
        <Text size="xs" fw={700} c="#475467">
          Ahorro período
        </Text>
        <Text fw={800} c="#2b8aaf">
          {currencyFormatter.format(metrics.totalsByType.saving.real)}
        </Text>
        <Text size="xs" c="#667085">
          Presup: {currencyFormatter.format(metrics.totalsByType.saving.budget)}
        </Text>
        <Text size="xs" c="#667085">
          Ratio:{" "}
          {savingsVsIncome === null
            ? "N/A"
            : `${percentageFormatter.format(savingsVsIncome)}% de ingresos`}
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
            <Text size="xs" fw={700} c="#667085" style={{ textTransform: "uppercase" }}>
              Tablero financiero
            </Text>
            <Text fw={800} size="lg" c="#1f2937">
              {selectedPeriodLabel}
            </Text>
            <Text size="xs" c="#667085">
              Workspace: {workspace.name} · Moneda: {currencyCode}
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
              Ver insights
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
                <Menu.Label>Mes</Menu.Label>
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
                            Actual
                          </Badge>
                        ) : null}
                      </Group>
                    </Menu.Item>
                  );
                })}

                <Menu.Divider />
                <Menu.Label>Año</Menu.Label>
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
                            Actual
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
            {(Object.keys(compactSummaryTheme) as TransactionType[]).map((type) => {
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
                      {theme.label}
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
                Resumen externo de workspaces vinculados
              </Text>
              <Text size="xs" c="#475467">
                Vista agregada externa del período. No modifica transacciones, categorías ni
                presupuesto de este workspace.
              </Text>
            </Stack>
            <Badge variant="light" color="blue">
              {normalizedLinkedWorkspaceSummaries.length} vinculados
            </Badge>
          </Group>

          {normalizedLinkedWorkspaceSummaries.length === 0 ? (
            <Text size="xs" c="#667085">
              No hay workspaces vinculados activos para mostrar en este período.
            </Text>
          ) : (
            <>
              <SimpleGrid cols={isMobile ? 2 : 4} spacing={isMobile ? 6 : "xs"}>
                <Paper withBorder radius="sm" p={isMobile ? 6 : "xs"}>
                  <Stack gap={2}>
                    <Text size="xs" c="#475467">
                      Ingresos externos
                    </Text>
                    <Text size="sm" fw={800} c="#087f5b">
                      {currencyFormatter.format(linkedWorkspaceTotals.incomeTotal)}
                    </Text>
                  </Stack>
                </Paper>
                <Paper withBorder radius="sm" p={isMobile ? 6 : "xs"}>
                  <Stack gap={2}>
                    <Text size="xs" c="#475467">
                      Gastos externos
                    </Text>
                    <Text size="sm" fw={800} c="#c92a2a">
                      {currencyFormatter.format(linkedWorkspaceTotals.expenseTotal)}
                    </Text>
                  </Stack>
                </Paper>
                <Paper withBorder radius="sm" p={isMobile ? 6 : "xs"}>
                  <Stack gap={2}>
                    <Text size="xs" c="#475467">
                      Ahorro externo
                    </Text>
                    <Text size="sm" fw={800} c="#1c7ed6">
                      {currencyFormatter.format(linkedWorkspaceTotals.savingTotal)}
                    </Text>
                  </Stack>
                </Paper>
                <Paper withBorder radius="sm" p={isMobile ? 6 : "xs"}>
                  <Stack gap={2}>
                    <Text size="xs" c="#475467">
                      Balance externo
                    </Text>
                    <Text
                      size="sm"
                      fw={800}
                      c={linkedWorkspaceTotals.balanceTotal >= 0 ? "#087f5b" : "#c92a2a"}
                    >
                      {currencyFormatter.format(linkedWorkspaceTotals.balanceTotal)}
                    </Text>
                  </Stack>
                </Paper>
              </SimpleGrid>

              <Stack gap={6}>
                {normalizedLinkedWorkspaceSummaries.map((row) => (
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
                          Ingresos: {currencyFormatter.format(row.incomeTotal)}
                        </Text>
                        <Text size="xs" c="#344054">
                          Gastos: {currencyFormatter.format(row.expenseTotal)}
                        </Text>
                        <Text size="xs" c="#344054">
                          Ahorro: {currencyFormatter.format(row.savingTotal)}
                        </Text>
                        <Text
                          size="xs"
                          fw={700}
                          c={row.balanceTotal >= 0 ? "#087f5b" : "#c92a2a"}
                        >
                          Balance: {currencyFormatter.format(row.balanceTotal)}
                        </Text>
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </Paper>

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
                      ? `Real ${compactFormatter.format(totals.real)} · Presup ${compactFormatter.format(totals.budget)}`
                      : `Real: ${currencyFormatter.format(totals.real)} · Presup: ${currencyFormatter.format(totals.budget)}`}
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
                      Categoría
                    </Table.Th>
                    <Table.Th style={{ color: "#475467", textAlign: "right", width: tableColumnWidths.real }}>
                      Real
                    </Table.Th>
                    <Table.Th
                      style={{ color: "#475467", textAlign: "right", width: tableColumnWidths.budget }}
                    >
                      Presup.
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "#475467",
                        textAlign: isMobile ? "left" : "right",
                        width: tableColumnWidths.execution,
                      }}
                    >
                      % Compl.
                    </Table.Th>
                    <Table.Th
                      style={{
                        color: "#475467",
                        textAlign: "right",
                        width: tableColumnWidths.deviation,
                      }}
                    >
                      Desvío
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text size="xs" c="#98a2b3">
                          Sin categorías con datos para este tipo.
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
                                  inactiva
                                </Text>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ textAlign: isMobile ? "left" : "right" }}>
                            <Text size="xs" c="#1f2937">
                              {compactFormatter.format(row.realAmount)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right" }}>
                            <Text size="xs" c="#475467">
                              {compactFormatter.format(row.budgetAmount)}
                            </Text>
                          </Table.Td>
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
                        TOTAL
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: isMobile ? "left" : "right" }}>
                      <Text size="xs" fw={800} c="#344054">
                        {compactFormatter.format(totals.real)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: "right" }}>
                      <Text size="xs" fw={800} c="#344054">
                        {compactFormatter.format(totals.budget)}
                      </Text>
                    </Table.Td>
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
              Distribución real por tipo
            </Text>

            <SimpleGrid cols={distributionColumns} spacing={isMobile ? 6 : "xs"}>
              {(Object.keys(typeLabels) as TransactionType[]).map((type) => {
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
                          Sin datos reales en el período.
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
