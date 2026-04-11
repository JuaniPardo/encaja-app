"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
  Title,
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
  "category_id" | "type" | "amount" | "transaction_date" | "effective_date"
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

const typeColors: Record<TransactionType, string> = {
  income: "teal",
  expense: "pink",
  saving: "indigo",
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

function deviationColor(type: TransactionType, deviation: number) {
  if (Math.abs(deviation) < 0.005) {
    return "gray.7";
  }

  if (type === "income") {
    return deviation > 0 ? "teal.7" : "pink.7";
  }

  return deviation > 0 ? "pink.7" : "teal.7";
}

function deviationHint(type: TransactionType, deviation: number) {
  if (Math.abs(deviation) < 0.005) {
    return "En línea";
  }

  if (type === "income") {
    return deviation > 0 ? "Por encima de lo esperado" : "Por debajo de lo esperado";
  }

  return deviation > 0 ? "Sobre presupuesto" : "Bajo presupuesto";
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
      .select("category_id, type, amount, transaction_date, effective_date")
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

      const summaryRow: CategorySummaryRow = {
        categoryId: category.id,
        categoryName: category.name,
        categoryIsActive: category.is_active,
        budgetAmount,
        realAmount,
        deviation,
        executionPercent,
      };

      groupedRows[category.type].push(summaryRow);
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
  }, [budgetItems, categories, transactionRows]);

  const hasVisibleRows =
    metrics.groupedRows.income.length > 0 ||
    metrics.groupedRows.expense.length > 0 ||
    metrics.groupedRows.saving.length > 0;

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isBootstrapping || isLoadingSummary} />

      <Stack gap={2}>
        <Title order={2}>Resumen mensual</Title>
        <Text c="dimmed" size="sm">
          Compará ejecución real contra presupuesto por período, tipo y categoría.
        </Text>
      </Stack>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between" align="end">
          <Group align="end">
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

          <Text size="sm" c="dimmed">
            Mostrando {monthLabel(selectedMonth)} {selectedYear}
          </Text>
        </Group>
      </Paper>

      <Group grow align="stretch">
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            Balance real
          </Text>
          <Text mt={4} fw={800} size="xl" c={metrics.balanceReal >= 0 ? "teal.7" : "pink.7"}>
            {currencyFormatter.format(metrics.balanceReal)}
          </Text>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            Balance presupuestado
          </Text>
          <Text mt={4} fw={800} size="xl" c={metrics.balanceBudget >= 0 ? "teal.7" : "pink.7"}>
            {currencyFormatter.format(metrics.balanceBudget)}
          </Text>
        </Paper>

        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            Diferencia (real - presupuesto)
          </Text>
          <Text mt={4} fw={800} size="xl" c={metrics.balanceDelta >= 0 ? "teal.7" : "pink.7"}>
            {formatSignedCurrency(metrics.balanceDelta, currencyFormatter)}
          </Text>
        </Paper>
      </Group>

      <Alert
        color={
          Math.abs(metrics.balanceDelta) < 0.005
            ? "blue"
            : metrics.balanceDelta > 0
              ? "teal"
              : "pink"
        }
        variant="light"
      >
        {Math.abs(metrics.balanceDelta) < 0.005
          ? "El balance real está en línea con el presupuesto del período."
          : metrics.balanceDelta > 0
            ? "Tu balance real está por encima de lo presupuestado para este período."
            : "Tu balance real quedó por debajo de lo presupuestado para este período."}
      </Alert>

      <Group grow align="stretch">
        {(Object.keys(metrics.totalsByType) as TransactionType[]).map((type) => (
          <Paper key={type} withBorder radius="md" p="md">
            <Stack gap={4}>
              <Text fw={700} c={`${typeColors[type]}.7`}>
                {typeLabels[type]}
              </Text>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Presupuesto
                </Text>
                <Text fw={600}>{currencyFormatter.format(metrics.totalsByType[type].budget)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Real
                </Text>
                <Text fw={600}>{currencyFormatter.format(metrics.totalsByType[type].real)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Desvío
                </Text>
                <Text fw={700} c={deviationColor(type, metrics.totalsByType[type].deviation)}>
                  {formatSignedCurrency(metrics.totalsByType[type].deviation, currencyFormatter)}
                </Text>
              </Group>
            </Stack>
          </Paper>
        ))}
      </Group>

      {!hasVisibleRows ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            No hay categorías ni movimientos para este workspace. Creá categorías y cargá
            presupuesto/transacciones para empezar a analizar el período.
          </Text>
        </Paper>
      ) : (
        (Object.keys(metrics.groupedRows) as TransactionType[]).map((type) => (
          <Paper key={type} withBorder radius="md" p="md">
            <Stack gap="sm">
              <Title order={4} c={`${typeColors[type]}.7`}>
                {typeLabels[type]} por categoría
              </Title>

              {metrics.groupedRows[type].length === 0 ? (
                <Text size="sm" c="dimmed">
                  No hay categorías visibles de este tipo para el período seleccionado.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={860}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Categoría</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Presupuesto</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Real</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>Desvío</Table.Th>
                        <Table.Th style={{ textAlign: "right" }}>% ejecución</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {metrics.groupedRows[type].map((row) => (
                        <Table.Tr key={row.categoryId}>
                          <Table.Td>
                            <Group gap={6}>
                              <Text>{row.categoryName}</Text>
                              {!row.categoryIsActive ? (
                                <Text size="xs" c="dimmed">
                                  (inactiva)
                                </Text>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {currencyFormatter.format(row.budgetAmount)}
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {currencyFormatter.format(row.realAmount)}
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <Text fw={700} c={deviationColor(type, row.deviation)}>
                              {formatSignedCurrency(row.deviation, currencyFormatter)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {deviationHint(type, row.deviation)}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {row.executionPercent === null
                              ? "N/A"
                              : `${percentageFormatter.format(row.executionPercent)}%`}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Paper>
        ))
      )}
    </Stack>
  );
}
