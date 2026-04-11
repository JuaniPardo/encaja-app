"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Grid,
  Group,
  LoadingOverlay,
  Menu,
  Paper,
  Progress,
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

type SemanticStatus = "problem" | "positive" | "neutral";

type CategorySemantic = {
  status: SemanticStatus;
  detail: string;
};

type OperationalInsightRow = {
  type: TransactionType;
  categoryName: string;
  deviation: number;
  semantic: CategorySemantic;
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

function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function getCategorySemantic(type: TransactionType, deviation: number): CategorySemantic {
  if (Math.abs(deviation) < deviationTolerance) {
    if (type === "expense") {
      return {
        status: "neutral",
        detail: "Gasto en presupuesto",
      };
    }

    if (type === "saving") {
      return {
        status: "neutral",
        detail: "Ahorro en objetivo",
      };
    }

    return {
      status: "neutral",
      detail: "Ingreso en presupuesto",
    };
  }

  if (type === "income") {
    return deviation > 0
      ? {
          status: "positive",
          detail: "Ingreso por encima del presupuesto",
        }
      : {
          status: "problem",
          detail: "Ingreso por debajo del presupuesto",
        };
  }

  if (type === "expense") {
    return deviation > 0
      ? {
          status: "problem",
          detail: "Gasto por encima del presupuesto",
        }
      : {
          status: "positive",
          detail: "Gasto por debajo del presupuesto",
        };
  }

  return deviation > 0
    ? {
        status: "positive",
        detail: "Ahorro por encima del objetivo",
      }
    : {
        status: "problem",
        detail: "Ahorro por debajo del objetivo",
      };
}

function getSemanticColor(status: SemanticStatus) {
  if (status === "problem") {
    return "#c92a2a";
  }

  if (status === "positive") {
    return "#087f5b";
  }

  return "#64748b";
}

function getProblemTypePriority(type: TransactionType) {
  if (type === "expense") {
    return 3;
  }

  if (type === "saving") {
    return 2;
  }

  return 1;
}

function getPositiveTypePriority(type: TransactionType) {
  if (type === "income") {
    return 3;
  }

  if (type === "saving") {
    return 2;
  }

  return 1;
}

function getDeviationColor(type: TransactionType, deviation: number) {
  return getSemanticColor(getCategorySemantic(type, deviation).status);
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

  const operationalInsights = useMemo(() => {
    const problemRows: OperationalInsightRow[] = [];
    const positiveRows: OperationalInsightRow[] = [];

    for (const type of Object.keys(metrics.groupedRows) as TransactionType[]) {
      for (const row of metrics.groupedRows[type]) {
        const hasOperationalSignal =
          Math.abs(row.budgetAmount) >= deviationTolerance ||
          Math.abs(row.realAmount) >= deviationTolerance;

        if (!hasOperationalSignal) {
          continue;
        }

        const semantic = getCategorySemantic(type, row.deviation);
        const insight: OperationalInsightRow = {
          type,
          categoryName: row.categoryName,
          deviation: row.deviation,
          semantic,
        };

        const isProblem = type === "expense" && row.deviation > deviationTolerance;
        if (isProblem) {
          problemRows.push(insight);
          continue;
        }

        const isPositive = type === "income" && row.deviation > deviationTolerance;
        if (isPositive) {
          positiveRows.push(insight);
          continue;
        }
      }
    }

    problemRows.sort((a, b) => {
      const priorityDiff = getProblemTypePriority(b.type) - getProblemTypePriority(a.type);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return Math.abs(b.deviation) - Math.abs(a.deviation);
    });

    positiveRows.sort((a, b) => {
      const priorityDiff = getPositiveTypePriority(b.type) - getPositiveTypePriority(a.type);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return Math.abs(b.deviation) - Math.abs(a.deviation);
    });

    return {
      problemRows,
      positiveRows,
    };
  }, [metrics.groupedRows]);

  const problemCount = operationalInsights.problemRows.length;
  const positiveCount = operationalInsights.positiveRows.length;
  const topProblemRows = operationalInsights.problemRows.slice(0, 3);
  const topPositiveRows = operationalInsights.positiveRows.slice(0, 3);

  const operationalHeadline = useMemo(() => {
    if (problemCount === 0 && positiveCount === 0) {
      return "Sin desvíos relevantes";
    }

    if (problemCount > 0 && positiveCount > 0) {
      return `${problemCount} ${pluralize(problemCount, "problema", "problemas")} · ${positiveCount} ${pluralize(positiveCount, "destacado", "destacados")}`;
    }

    if (problemCount > 0) {
      return `${problemCount} ${pluralize(problemCount, "problema detectado", "problemas detectados")}`;
    }

    return `${positiveCount} ${pluralize(positiveCount, "destacado", "destacados")}`;
  }, [positiveCount, problemCount]);

  const operationalHeadlineColor =
    problemCount > 0 ? "#c92a2a" : positiveCount > 0 ? "#087f5b" : "#475467";

  const selectedPeriodLabel = `${monthLabel(selectedMonth)} ${selectedYear}`;
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const isNarrowMobile = useMediaQuery("(max-width: 33.99em)");
  const isTablet = useMediaQuery("(min-width: 48em) and (max-width: 74.99em)");

  const kpiColumns = isMobile ? (isNarrowMobile ? 1 : 2) : 2;
  const cardPadding = isMobile ? "xs" : "sm";
  const tableHorizontalSpacing = isMobile ? "xs" : "sm";
  const tableVerticalSpacing = isMobile ? 5 : 6;
  const monthProgressSize = isMobile ? 6 : 8;
  const executionBarWidth = isMobile ? "100%" : isTablet ? 88 : 96;
  const donutSize = isMobile ? 76 : isTablet ? 84 : 96;
  const donutThickness = isMobile ? 9 : 11;
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
          <Group gap={6} align="center" wrap="wrap">
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

      <Paper
        withBorder
        radius="sm"
        p={isMobile ? "xs" : "sm"}
        bg="#ffffff"
        style={{ borderColor: "#d6dde7" }}
      >
        <Stack gap={6}>
          <Text size="xs" fw={700} c="#475467">
            Estado operativo
          </Text>
          <Text fw={800} c={operationalHeadlineColor}>
            {operationalHeadline}
          </Text>
          <Group gap={6} wrap="wrap">
            <Badge color="red" variant={problemCount > 0 ? "light" : "outline"} size="sm">
              {problemCount} {pluralize(problemCount, "problema", "problemas")}
            </Badge>
            <Badge color="teal" variant={positiveCount > 0 ? "light" : "outline"} size="sm">
              {positiveCount} en buen desempeño
            </Badge>
          </Group>
          <Text size="xs" c="#667085">
            Transcurrido: {percentageFormatter.format(monthProgress)}%
          </Text>
          <Progress value={monthProgress} color="#0ea5e9" radius="xl" size={monthProgressSize} />
        </Stack>
      </Paper>

      <Grid gap="sm" align="stretch">
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Paper
            p={isMobile ? "sm" : "md"}
            radius="sm"
            style={{
              border: "1px solid #d6dde7",
              backgroundColor: problemCount > 0 ? "#fff5f5" : "#f8fafc",
            }}
          >
            <Stack gap={isMobile ? "sm" : "md"}>
              <Text size="xs" fw={800} c="#344054">
                Problemas detectados
              </Text>
              <Text size="sm" fw={800} c={problemCount > 0 ? "#c92a2a" : "#475467"}>
                {problemCount === 0
                  ? "Sin problemas críticos"
                  : `${problemCount} ${pluralize(problemCount, "categoría en alerta", "categorías en alerta")}`}
              </Text>
              {topProblemRows.length === 0 ? (
                <Text size="xs" c="#667085">
                  No hay desvíos operativos que requieran atención en este período.
                </Text>
              ) : (
                <Stack gap="xs">
                  {topProblemRows.map((row, index) => (
                    <Box
                      key={`${row.type}-${row.categoryName}-${index}`}
                      className="dashboard-clickable-item"
                      p={isMobile ? "xs" : "sm"}
                      style={{
                        border: "1px solid #ffd9d9",
                        backgroundColor: "#fffafa",
                        borderRadius: 8,
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                        <Stack gap={1} style={{ flex: 1 }}>
                          <Text size="xs" fw={700} c="#344054">
                            {row.semantic.detail}
                          </Text>
                          <Text size="xs" c="#667085">
                            {typeLabels[row.type]} · {row.categoryName}
                          </Text>
                        </Stack>
                        <Text size={isMobile ? "sm" : "md"} fw={900} c="#c92a2a">
                          {formatSignedCurrency(row.deviation, currencyFormatter)}
                        </Text>
                      </Group>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Paper
            p={isMobile ? "sm" : "md"}
            radius="sm"
            style={{
              border: "1px solid #d6dde7",
              backgroundColor: positiveCount > 0 ? "#f1fff6" : "#f8fafc",
            }}
          >
            <Stack gap={isMobile ? "sm" : "md"}>
              <Text size="xs" fw={800} c="#344054">
                Buen desempeño
              </Text>
              <Text size="sm" fw={800} c={positiveCount > 0 ? "#087f5b" : "#475467"}>
                {positiveCount === 0
                  ? "Sin destacados por ahora"
                  : `${positiveCount} ${pluralize(positiveCount, "categoría destacada", "categorías destacadas")}`}
              </Text>
              {topPositiveRows.length === 0 ? (
                <Text size="xs" c="#667085">
                  Todavía no hay señales positivas por encima del plan para destacar.
                </Text>
              ) : (
                <Stack gap="xs">
                  {topPositiveRows.map((row, index) => (
                    <Box
                      key={`${row.type}-${row.categoryName}-${index}`}
                      className="dashboard-clickable-item"
                      p={isMobile ? "xs" : "sm"}
                      style={{
                        border: "1px solid #cceede",
                        backgroundColor: "#f6fffa",
                        borderRadius: 8,
                      }}
                    >
                      <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                        <Stack gap={1} style={{ flex: 1 }}>
                          <Text size="xs" fw={700} c="#344054">
                            {row.semantic.detail}
                          </Text>
                          <Text size="xs" c="#667085">
                            {typeLabels[row.type]} · {row.categoryName}
                          </Text>
                        </Stack>
                        <Text size={isMobile ? "sm" : "md"} fw={900} c="#087f5b">
                          {formatSignedCurrency(row.deviation, currencyFormatter)}
                        </Text>
                      </Group>
                    </Box>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={kpiColumns} spacing={isMobile ? "xs" : "sm"}>
        <Paper withBorder radius="sm" p="xs" bg="#ffffff">
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

        <Paper withBorder radius="sm" p="xs" bg="#ffffff">
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
      </SimpleGrid>

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
                        <Table.Tr key={row.categoryId} className="dashboard-clickable-row">
                          <Table.Td>
                            <Group gap={6} wrap={isMobile ? "wrap" : "nowrap"}>
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
                            <Box h={8} w={8} style={{ borderRadius: 2, backgroundColor: slice.color }} />
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
    </Stack>
  );
}
