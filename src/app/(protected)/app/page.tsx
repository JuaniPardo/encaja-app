"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isBootstrapping || isLoadingSummary} />

      <Paper
        radius="sm"
        p="sm"
        style={{
          border: "1px solid #1f252d",
          backgroundColor: "#0a0d11",
        }}
      >
        <Stack gap="sm">
          <Box
            px="sm"
            py={6}
            style={{
              backgroundColor: "#00863f",
              border: "1px solid #00a552",
            }}
          >
            <Text fw={800} c="#e8fff1" size="sm">
              TABLERO
            </Text>
          </Box>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm">
            <Paper withBorder radius="sm" p="xs" bg="#151a20" c="#e6e9ef">
              <Stack gap={6}>
                <Text size="xs" fw={700} c="#c8ced8">
                  Año y Mes Seleccionado
                </Text>
                <Group grow>
                  <NativeSelect
                    label="Año"
                    data={yearOptions}
                    value={String(selectedYear)}
                    onChange={(event) => {
                      setIsLoadingSummary(true);
                      setSelectedYear(Number(event.currentTarget.value));
                    }}
                  />
                  <NativeSelect
                    label="Mes"
                    data={monthOptions}
                    value={String(selectedMonth)}
                    onChange={(event) => {
                      setIsLoadingSummary(true);
                      setSelectedMonth(Number(event.currentTarget.value));
                    }}
                  />
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder radius="sm" p="xs" bg="#151a20">
              <Stack gap={6}>
                <Text size="xs" fw={700} c="#c8ced8">
                  Transcurrido
                </Text>
                <Text fw={700} c="#f6f7f9">
                  {percentageFormatter.format(monthProgress)}%
                </Text>
                <Progress value={monthProgress} color="#00b8f2" radius="xs" />
              </Stack>
            </Paper>

            <Paper withBorder radius="sm" p="xs" bg="#151a20">
              <Stack gap={4}>
                <Text size="xs" fw={700} c="#c8ced8">
                  Balance período
                </Text>
                <Text fw={800} c={metrics.balanceReal >= 0 ? "#5de08f" : "#ff6f9f"}>
                  {currencyFormatter.format(metrics.balanceReal)}
                </Text>
                <Text size="xs" c="#b7bdc7">
                  Presup: {currencyFormatter.format(metrics.balanceBudget)}
                </Text>
                <Text size="xs" c={metrics.balanceDelta >= 0 ? "#8de7b0" : "#ff9dbc"}>
                  Delta: {formatSignedCurrency(metrics.balanceDelta, currencyFormatter)}
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder radius="sm" p="xs" bg="#151a20">
              <Stack gap={4}>
                <Text size="xs" fw={700} c="#c8ced8">
                  Ahorro período
                </Text>
                <Text fw={800} c="#5cc8ee">
                  {currencyFormatter.format(metrics.totalsByType.saving.real)}
                </Text>
                <Text size="xs" c="#b7bdc7">
                  Presup: {currencyFormatter.format(metrics.totalsByType.saving.budget)}
                </Text>
                <Text size="xs" c="#b7bdc7">
                  Ratio:{" "}
                  {savingsVsIncome === null
                    ? "N/A"
                    : `${percentageFormatter.format(savingsVsIncome)}% de ingresos`}
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder radius="sm" p="xs" bg="#151a20">
              <Stack gap={4}>
                <Text size="xs" fw={700} c="#c8ced8">
                  Período
                </Text>
                <Text fw={700} c="#f6f7f9">
                  {monthLabel(selectedMonth)} {selectedYear}
                </Text>
                <Text size="xs" c="#b7bdc7">
                  Moneda: {currencyCode}
                </Text>
                <Text size="xs" c="#b7bdc7">
                  Workspace: {workspace.name}
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          <Box
            px="sm"
            py={6}
            style={{
              borderTop: "1px solid #202730",
              borderBottom: "1px solid #202730",
              backgroundColor: "#11161d",
            }}
          >
            <Text size="xs" c="#c8ced8" fw={700}>
              Datos - {monthLabel(selectedMonth)} {selectedYear}
            </Text>
          </Box>

          <Grid gap="sm">
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack gap="sm">
                {summaryRows.map(({ type, rows }) => (
                  <Paper
                    key={type}
                    radius="sm"
                    style={{
                      border: "1px solid #232a34",
                      backgroundColor: "#11161d",
                    }}
                  >
                    <Box
                      px="sm"
                      py={6}
                      style={{
                        backgroundColor: typeTheme[type].header,
                        borderBottom: "1px solid #232a34",
                      }}
                    >
                      <Text size="xs" fw={800} c="#f6f8fb">
                        {typeLabels[type]}
                      </Text>
                    </Box>

                    <Table.ScrollContainer minWidth={560}>
                      <Table
                        horizontalSpacing="sm"
                        verticalSpacing={7}
                        style={{ color: "#e6ebf2" }}
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th style={{ color: "#aeb5c0" }}>Categoría</Table.Th>
                            <Table.Th style={{ color: "#aeb5c0", textAlign: "right" }}>
                              Registro
                            </Table.Th>
                            <Table.Th style={{ color: "#aeb5c0", textAlign: "right" }}>
                              Presup.
                            </Table.Th>
                            <Table.Th style={{ color: "#aeb5c0", textAlign: "right" }}>
                              % Compl.
                            </Table.Th>
                            <Table.Th style={{ color: "#aeb5c0", textAlign: "right" }}>
                              Resta
                            </Table.Th>
                            <Table.Th style={{ color: "#aeb5c0", textAlign: "right" }}>
                              Excede
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {rows.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={6}>
                                <Text size="xs" c="#8d96a3">
                                  Sin categorías con datos para este tipo.
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ) : (
                            rows.map((row) => {
                              const remaining = Math.max(0, row.budgetAmount - row.realAmount);
                              const excess = Math.max(0, row.realAmount - row.budgetAmount);

                              return (
                                <Table.Tr key={row.categoryId}>
                                  <Table.Td>
                                    <Group gap={6} wrap="nowrap">
                                      <Text size="sm" c="#e9edf4">
                                        {row.categoryName}
                                      </Text>
                                      {!row.categoryIsActive ? (
                                        <Text size="xs" c="#9099a6">
                                          inactiva
                                        </Text>
                                      ) : null}
                                    </Group>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <Text size="sm" c="#e9edf4">
                                      {currencyFormatter.format(row.realAmount)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <Text size="sm" c="#cfd6e1">
                                      {currencyFormatter.format(row.budgetAmount)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <Text
                                      size="sm"
                                      c={
                                        row.executionPercent === null
                                          ? "#9099a6"
                                          : row.executionPercent > 100
                                            ? "#ff97be"
                                            : "#7ee8a8"
                                      }
                                    >
                                      {row.executionPercent === null
                                        ? "N/A"
                                        : `${percentageFormatter.format(row.executionPercent)}%`}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <Text size="sm" c="#cfd6e1">
                                      {remaining > 0
                                        ? currencyFormatter.format(remaining)
                                        : currencyFormatter.format(0)}
                                    </Text>
                                  </Table.Td>
                                  <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <Text
                                      size="sm"
                                      c={excess > 0 ? "#ff97be" : "#8d96a3"}
                                      fw={excess > 0 ? 700 : 400}
                                    >
                                      {excess > 0
                                        ? currencyFormatter.format(excess)
                                        : currencyFormatter.format(0)}
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              );
                            })
                          )}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Paper>
                ))}
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Grid gap="sm">
                {(Object.keys(typeLabels) as TransactionType[]).map((type) => {
                  const donut = donutData[type];

                  return (
                    <Grid.Col key={type} span={{ base: 12, sm: 6 }}>
                      <Paper
                        h="100%"
                        p="sm"
                        radius="sm"
                        style={{
                          border: "1px solid #232a34",
                          backgroundColor: "#11161d",
                        }}
                      >
                        <Stack gap="xs">
                          <Text size="xs" fw={800} c={typeTheme[type].main}>
                            {typeLabels[type]} - Categorías (Registro)
                          </Text>

                          <Group gap="sm" align="center" wrap="nowrap">
                            <RingProgress
                              size={130}
                              thickness={14}
                              roundCaps
                              sections={
                                donut.slices.length === 0
                                  ? [{ value: 100, color: "#2a313d" }]
                                  : donut.slices.map((slice) => ({
                                      value: clampToPercent(slice.value),
                                      color: slice.color,
                                    }))
                              }
                              label={
                                <Text size="xs" c="#f2f4f7" ta="center" fw={700}>
                                  {currencyFormatter.format(donut.total)}
                                </Text>
                              }
                            />

                            <Stack gap={6} style={{ flex: 1 }}>
                              {donut.slices.length === 0 ? (
                                <Text size="xs" c="#8d96a3">
                                  Sin datos reales en el período.
                                </Text>
                              ) : (
                                donut.slices.map((slice) => (
                                  <Group key={`${type}-${slice.label}`} justify="space-between" gap="xs">
                                    <Group gap={6} wrap="nowrap">
                                      <Box
                                        h={8}
                                        w={8}
                                        style={{ borderRadius: 2, backgroundColor: slice.color }}
                                      />
                                      <Text size="xs" c="#d9dee7">
                                        {slice.label}
                                      </Text>
                                    </Group>
                                    <Text size="xs" c="#d9dee7">
                                      {percentageFormatter.format(slice.value)}%
                                    </Text>
                                  </Group>
                                ))
                              )}
                            </Stack>
                          </Group>
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  );
                })}

                <Grid.Col span={{ base: 12 }}>
                  <Paper
                    p="sm"
                    radius="sm"
                    style={{
                      border: "1px solid #232a34",
                      backgroundColor: "#11161d",
                    }}
                  >
                    <Stack gap="sm">
                      <Text size="xs" fw={800} c="#cfd6e1">
                        Registro vs Presupuesto
                      </Text>

                      <Group align="end" gap="md" wrap="nowrap">
                        {comparisonBars.map((item) => (
                          <Stack key={item.key} gap={4} align="center" style={{ flex: 1 }}>
                            <Group
                              gap={4}
                              align="end"
                              justify="center"
                              wrap="nowrap"
                              h={120}
                              style={{ width: "100%" }}
                            >
                              <Box
                                style={{
                                  width: 14,
                                  height: `${(item.budget / maxComparisonValue) * 100}%`,
                                  minHeight: 4,
                                  backgroundColor: "#8c93a0",
                                }}
                              />
                              <Box
                                style={{
                                  width: 14,
                                  height: `${(item.real / maxComparisonValue) * 100}%`,
                                  minHeight: 4,
                                  backgroundColor: item.color,
                                }}
                              />
                            </Group>
                            <Text size="xs" c="#d9dee7">
                              {item.label}
                            </Text>
                          </Stack>
                        ))}
                      </Group>

                      <Group gap="md">
                        <Group gap={6}>
                          <Box h={8} w={8} style={{ backgroundColor: "#8c93a0", borderRadius: 2 }} />
                          <Text size="xs" c="#c8ced8">
                            Presupuesto
                          </Text>
                        </Group>
                        <Group gap={6}>
                          <Box h={8} w={8} style={{ backgroundColor: "#d9dee7", borderRadius: 2 }} />
                          <Text size="xs" c="#c8ced8">
                            Registro
                          </Text>
                        </Group>
                      </Group>
                    </Stack>
                  </Paper>
                </Grid.Col>
              </Grid>
            </Grid.Col>
          </Grid>
        </Stack>
      </Paper>
    </Stack>
  );
}
