"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Grid,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  Progress,
  RingProgress,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code"
>;
type BudgetPeriodIdRow = Pick<Database["public"]["Tables"]["budget_periods"]["Row"], "id">;
type BudgetItemLiteRow = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "category_id" | "amount"
>;
type TransactionLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "amount" | "transaction_date" | "effective_date"
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
  if (Math.abs(roundedValue) < 0.005) {
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

function getExecutionScale(value: number | null) {
  if (value === null) {
    return {
      bar: "#cbd5e1",
      track: "#e2e8f0",
      text: "#64748b",
    };
  }

  if (value > 100) {
    return {
      bar: "#e03131",
      track: "#ffe3e3",
      text: "#c92a2a",
    };
  }

  if (value >= 80) {
    return {
      bar: "#0ca678",
      track: "#d3f9d8",
      text: "#087f5b",
    };
  }

  return {
    bar: "#94a3b8",
    track: "#e2e8f0",
    text: "#475569",
  };
}

function getDeviationColor(type: TransactionType, deviation: number) {
  if (Math.abs(deviation) < 0.005) {
    return "#64748b";
  }

  const isPositive = type === "income" ? deviation > 0 : deviation < 0;
  return isPositive ? "#087f5b" : "#c92a2a";
}

export default function DashboardPage() {
  const { supabase, workspace } = useWorkspace();

  const now = useMemo(() => new Date(), []);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemLiteRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<TransactionLiteRow[]>([]);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currencyCode]);

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
    const [categoriesResponse, settingsResponse] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("start_year, currency_code")
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
    } else {
      const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
      setStartYear(settings?.start_year ?? new Date().getFullYear());
      setCurrencyCode(settings?.currency_code ?? "ARS");
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
      .select("category_id, amount, transaction_date, effective_date")
      .eq("workspace_id", workspace.id)
      .or(transactionFilter);

    const [periodResponse, transactionsResponse] = await Promise.all([
      periodResponsePromise,
      transactionsResponsePromise,
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

  const monthProgress = useMemo(() => {
    const periodStart = new Date(selectedYear, selectedMonth - 1, 1);
    const periodEnd = new Date(selectedYear, selectedMonth, 0);

    if (now < periodStart) {
      return 0;
    }

    if (now > periodEnd) {
      return 100;
    }

    return clampToPercent((now.getDate() / periodEnd.getDate()) * 100);
  }, [now, selectedMonth, selectedYear]);

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

  const comparisonBars = useMemo(() => {
    return [
      {
        key: "income",
        label: "Ingreso",
        budget: metrics.totalsByType.income.budget,
        real: metrics.totalsByType.income.real,
        color: typeTheme.income.main,
      },
      {
        key: "expense",
        label: "Gasto",
        budget: metrics.totalsByType.expense.budget,
        real: metrics.totalsByType.expense.real,
        color: typeTheme.expense.main,
      },
      {
        key: "saving",
        label: "Ahorro",
        budget: metrics.totalsByType.saving.budget,
        real: metrics.totalsByType.saving.real,
        color: typeTheme.saving.main,
      },
      {
        key: "balance",
        label: "Balance",
        budget: Math.max(0, metrics.balanceBudget),
        real: Math.max(0, metrics.balanceReal),
        color: "#cdd3dc",
      },
    ];
  }, [
    metrics.balanceBudget,
    metrics.balanceReal,
    metrics.totalsByType.expense.budget,
    metrics.totalsByType.expense.real,
    metrics.totalsByType.income.budget,
    metrics.totalsByType.income.real,
    metrics.totalsByType.saving.budget,
    metrics.totalsByType.saving.real,
  ]);

  const maxComparisonValue = useMemo(() => {
    const maxValue = comparisonBars.reduce((max, item) => {
      return Math.max(max, item.budget, item.real);
    }, 0);

    return maxValue <= 0 ? 1 : maxValue;
  }, [comparisonBars]);

  const issueRows = useMemo(() => {
    const rows: Array<{
      type: TransactionType;
      categoryName: string;
      deviation: number;
      executionPercent: number | null;
    }> = [];

    for (const type of Object.keys(metrics.groupedRows) as TransactionType[]) {
      for (const row of metrics.groupedRows[type]) {
        const hasExecutionAlert = row.executionPercent !== null && row.executionPercent > 100;
        const hasDeviationAlert = type === "income" ? row.deviation < 0 : row.deviation > 0;

        if (!hasExecutionAlert && !hasDeviationAlert) {
          continue;
        }

        rows.push({
          type,
          categoryName: row.categoryName,
          deviation: row.deviation,
          executionPercent: row.executionPercent,
        });
      }
    }

    return rows.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  }, [metrics.groupedRows]);

  const selectedPeriodLabel = `${monthLabel(selectedMonth)} ${selectedYear}`;
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const isNarrowMobile = useMediaQuery("(max-width: 33.99em)");
  const isTablet = useMediaQuery("(min-width: 48em) and (max-width: 74.99em)");

  const kpiColumns = isMobile ? (isNarrowMobile ? 1 : 2) : isTablet ? 2 : 3;
  const cardPadding = isMobile ? "xs" : "sm";
  const tableHorizontalSpacing = isMobile ? "xs" : "sm";
  const tableVerticalSpacing = isMobile ? 5 : 6;
  const progressBarSize = isMobile ? 6 : 8;
  const executionBarWidth = isMobile ? "100%" : isTablet ? 88 : 96;
  const donutSize = isMobile ? 76 : isTablet ? 84 : 96;
  const donutThickness = isMobile ? 9 : 11;
  const comparisonHeight = isMobile ? 64 : isTablet ? 74 : 86;
  const comparisonBarWidth = isMobile ? 8 : 10;
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
          {!isMobile ? (
            <Badge variant="light" color="gray">
              Lectura rápida
            </Badge>
          ) : null}
        </Group>
      </Paper>

      <Grid gap="sm" align="stretch">
        <Grid.Col span={{ base: 12, sm: 5, lg: 4 }}>
          <Paper
            radius="sm"
            p={isMobile ? "xs" : "sm"}
            style={{
              border: "1px solid #d6dde7",
              backgroundColor: "#f7f9fc",
            }}
          >
            <Stack gap="xs">
              <Text size="xs" fw={700} c="#475467" style={{ textTransform: "uppercase" }}>
                Controles
              </Text>
              <Group grow gap="xs" wrap={isMobile ? "wrap" : "nowrap"}>
                <NativeSelect
                  label="Año"
                  size={isMobile ? "xs" : "sm"}
                  data={yearOptions}
                  value={String(selectedYear)}
                  onChange={(event) => {
                    setIsLoadingSummary(true);
                    setSelectedYear(Number(event.currentTarget.value));
                  }}
                />
                <NativeSelect
                  label="Mes"
                  size={isMobile ? "xs" : "sm"}
                  data={monthOptions}
                  value={String(selectedMonth)}
                  onChange={(event) => {
                    setIsLoadingSummary(true);
                    setSelectedMonth(Number(event.currentTarget.value));
                  }}
                />
              </Group>
              <Text size="xs" c="#667085">
                Analizando: {selectedPeriodLabel}
              </Text>
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 7, lg: 8 }}>
          <SimpleGrid cols={kpiColumns} spacing={isMobile ? "xs" : "sm"}>
            <Paper withBorder radius="sm" p="xs" bg="#ffffff" style={{ order: isMobile ? 2 : 1 }}>
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

            <Paper withBorder radius="sm" p="xs" bg="#ffffff" style={{ order: isMobile ? 3 : 2 }}>
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

            <Paper withBorder radius="sm" p="xs" bg="#ffffff" style={{ order: isMobile ? 1 : 3 }}>
              <Stack gap={4}>
                <Text size="xs" fw={700} c="#475467">
                  Estado operativo
                </Text>
                <Text fw={800} c={issueRows.length > 0 ? "#c92a2a" : "#087f5b"}>
                  {issueRows.length} categoría{issueRows.length === 1 ? "" : "s"} en alerta
                </Text>
                <Text size="xs" c="#667085">
                  Transcurrido: {percentageFormatter.format(monthProgress)}%
                </Text>
                <Progress
                  value={monthProgress}
                  color="#0ea5e9"
                  radius="xl"
                  size={progressBarSize}
                />
              </Stack>
            </Paper>
          </SimpleGrid>
        </Grid.Col>
      </Grid>

      <Grid gap="sm" align="start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap={isMobile ? "xs" : "sm"}>
            {summaryRows.map(({ type, rows }) => {
              const totals = metrics.totalsByType[type];
              const totalExecutionPercent =
                Math.abs(totals.budget) < 0.005 ? null : (totals.real / totals.budget) * 100;
              const totalExecutionScale = getExecutionScale(totalExecutionPercent);

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
                        <Table.Th
                          style={{ color: "#475467", textAlign: "right", width: tableColumnWidths.real }}
                        >
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
                          const executionScale = getExecutionScale(row.executionPercent);
                          const deviationColor = getDeviationColor(type, row.deviation);

                          return (
                            <Table.Tr key={row.categoryId}>
                              <Table.Td>
                                <Group gap={6} wrap="nowrap">
                                  <Text size="xs" c="#1f2937" lineClamp={isMobile ? 2 : 1}>
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
                                {row.executionPercent === null ? (
                                  <Text size="xs" c={executionScale.text}>
                                    N/A
                                  </Text>
                                ) : (
                                  <Stack gap={3} align={isMobile ? "stretch" : "flex-end"}>
                                    <Text size="xs" fw={700} c={executionScale.text}>
                                      {percentageFormatter.format(row.executionPercent)}%
                                    </Text>
                                    <Progress
                                      value={clampToPercent(row.executionPercent)}
                                      color={executionScale.bar}
                                      radius="xl"
                                      size={progressBarSize}
                                      style={{ width: executionBarWidth }}
                                      styles={{ root: { backgroundColor: executionScale.track } }}
                                    />
                                  </Stack>
                                )}
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
                          {totalExecutionPercent === null ? (
                            <Text size="xs" fw={800} c={totalExecutionScale.text}>
                              N/A
                            </Text>
                          ) : (
                            <Stack gap={3} align={isMobile ? "stretch" : "flex-end"}>
                              <Text size="xs" fw={800} c={totalExecutionScale.text}>
                                {percentageFormatter.format(totalExecutionPercent)}%
                              </Text>
                              <Progress
                                value={clampToPercent(totalExecutionPercent)}
                                color={totalExecutionScale.bar}
                                radius="xl"
                                size={progressBarSize}
                                style={{ width: executionBarWidth }}
                                styles={{ root: { backgroundColor: totalExecutionScale.track } }}
                              />
                            </Stack>
                          )}
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
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap={isMobile ? "xs" : "sm"}>
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

                {(Object.keys(typeLabels) as TransactionType[]).map((type) => {
                  const donut = donutData[type];

                  return (
                    <Paper
                      key={type}
                      p={isMobile ? 6 : "xs"}
                      radius="sm"
                      style={{
                        border: "1px solid #e4e7ec",
                        backgroundColor: "#fbfcff",
                      }}
                    >
                      <Group gap="xs" align="center" wrap="nowrap">
                        <RingProgress
                          size={donutSize}
                          thickness={donutThickness}
                          roundCaps
                          sections={
                            donut.slices.length === 0
                              ? [{ value: 100, color: "#e4e7ec" }]
                              : donut.slices.map((slice) => ({
                                  value: clampToPercent(slice.value),
                                  color: slice.color,
                                }))
                          }
                          label={
                            <Text size={isMobile ? "9px" : "10px"} c="#344054" ta="center" fw={700}>
                              {compactFormatter.format(donut.total)}
                            </Text>
                          }
                        />

                        <Stack gap={4} style={{ flex: 1 }}>
                          <Text size="xs" fw={700} c={typeTheme[type].main}>
                            {typeLabels[type]}
                          </Text>
                          {donut.slices.length === 0 ? (
                            <Text size={isMobile ? "11px" : "xs"} c="#98a2b3">
                              Sin datos reales en el período.
                            </Text>
                          ) : (
                            donut.slices.map((slice) => (
                              <Group key={`${type}-${slice.label}`} justify="space-between" gap={6}>
                                <Group gap={6} wrap="nowrap">
                                  <Box
                                    h={8}
                                    w={8}
                                    style={{ borderRadius: 2, backgroundColor: slice.color }}
                                  />
                                  <Text size={isMobile ? "11px" : "xs"} c="#344054" lineClamp={1}>
                                    {slice.label}
                                  </Text>
                                </Group>
                                <Text size={isMobile ? "11px" : "xs"} c="#344054" fw={600}>
                                  {percentageFormatter.format(slice.value)}%
                                </Text>
                              </Group>
                            ))
                          )}
                        </Stack>
                      </Group>
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>

            <Paper
              p={cardPadding}
              radius="sm"
              style={{
                border: "1px solid #d6dde7",
                backgroundColor: "#ffffff",
              }}
            >
              <Stack gap="xs">
                <Text size="xs" fw={800} c="#344054">
                  Registro vs Presupuesto
                </Text>

                <Group align="end" gap={isMobile ? "xs" : "sm"} wrap="nowrap">
                  {comparisonBars.map((item) => (
                    <Stack key={item.key} gap={4} align="center" style={{ flex: 1 }}>
                      <Group gap={4} align="end" justify="center" wrap="nowrap" h={comparisonHeight}>
                        <Box
                          style={{
                            width: comparisonBarWidth,
                            height: `${(item.budget / maxComparisonValue) * 100}%`,
                            minHeight: 4,
                            backgroundColor: "#98a2b3",
                            borderRadius: 3,
                          }}
                        />
                        <Box
                          style={{
                            width: comparisonBarWidth,
                            height: `${(item.real / maxComparisonValue) * 100}%`,
                            minHeight: 4,
                            backgroundColor: item.color,
                            borderRadius: 3,
                          }}
                        />
                      </Group>
                      <Text size="xs" c="#344054">
                        {item.label}
                      </Text>
                    </Stack>
                  ))}
                </Group>

                <Group gap={isMobile ? "sm" : "md"} wrap={isMobile ? "wrap" : "nowrap"}>
                  <Group gap={6}>
                    <Box h={8} w={8} style={{ backgroundColor: "#98a2b3", borderRadius: 2 }} />
                    <Text size="xs" c="#475467">
                      Presupuesto
                    </Text>
                  </Group>
                  <Group gap={6}>
                    <Box h={8} w={8} style={{ backgroundColor: "#344054", borderRadius: 2 }} />
                    <Text size="xs" c="#475467">
                      Registro
                    </Text>
                  </Group>
                </Group>
              </Stack>
            </Paper>

            <Paper
              p={cardPadding}
              radius="sm"
              style={{
                border: "1px solid #d6dde7",
                backgroundColor: issueRows.length > 0 ? "#fff5f5" : "#f4fef8",
              }}
            >
              <Stack gap={4}>
                <Text size="xs" fw={800} c="#344054">
                  Problemas detectados
                </Text>
                <Text size="sm" fw={800} c={issueRows.length > 0 ? "#c92a2a" : "#087f5b"}>
                  {issueRows.length === 0 ? "Sin alertas críticas" : `${issueRows.length} alertas`}
                </Text>
                <Text size="xs" c="#667085">
                  {issueRows.length === 0
                    ? "No hay categorías fuera de rango para este período."
                    : `${typeLabels[issueRows[0].type]} · ${issueRows[0].categoryName} · ${formatSignedCurrency(issueRows[0].deviation, currencyFormatter)}`}
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
