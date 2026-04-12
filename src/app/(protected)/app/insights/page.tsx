"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Group,
  LoadingOverlay,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type BudgetPeriodIdRow = Pick<Database["public"]["Tables"]["budget_periods"]["Row"], "id">;
type BudgetItemLiteRow = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "category_id" | "amount"
>;
type TransactionLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "amount" | "type" | "transaction_date" | "effective_date"
>;
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "currency_code" | "show_cents"
>;

type TabValue = "current" | "closed";

type PeriodRef = {
  year: number;
  month: number;
};

type CategorySpendRow = {
  categoryId: string;
  categoryName: string;
  amount: number;
  sharePercent: number;
};

type BudgetPaceStatus = "exceeded" | "risk" | "inline";

type BudgetPaceRow = {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  currentAmount: number;
  projectedAmount: number;
  status: BudgetPaceStatus;
};

type ClosedComparisonRow = {
  categoryId: string;
  categoryName: string;
  closedAmount: number;
  previousAmount: number;
  deltaAmount: number;
  deltaPercent: number | null;
};

type TotalsByType = Record<TransactionType, number>;

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

const deviationTolerance = 0.005;

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

function monthLabel(month: number) {
  return monthOptions.find((option) => Number(option.value) === month)?.label ?? `Mes ${month}`;
}

function periodLabel(period: PeriodRef) {
  return `${monthLabel(period.month)} ${period.year}`;
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

function buildPreviousPeriod(year: number, month: number): PeriodRef {
  if (month === 1) {
    return {
      year: year - 1,
      month: 12,
    };
  }

  return {
    year,
    month: month - 1,
  };
}

function buildTransactionPeriodFilter(start: string, end: string) {
  return [
    `and(effective_date.gte.${start},effective_date.lt.${end})`,
    `and(effective_date.is.null,transaction_date.gte.${start},transaction_date.lt.${end})`,
  ].join(",");
}

function getDatePeriodKey(dateValue: string) {
  return dateValue.slice(0, 7);
}

function getPeriodKey(period: PeriodRef) {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
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

function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  const rounded = roundMoney(value);
  if (Math.abs(rounded) < deviationTolerance) {
    return formatter.format(0);
  }

  const absolute = formatter.format(Math.abs(rounded));
  return `${rounded > 0 ? "+" : "-"}${absolute}`;
}

function formatSignedPercent(value: number, formatter: Intl.NumberFormat) {
  if (!Number.isFinite(value) || Math.abs(value) < deviationTolerance) {
    return "0%";
  }

  const absolute = formatter.format(Math.abs(value));
  return `${value > 0 ? "+" : "-"}${absolute}%`;
}

function getRoundedPercentLabel(value: number) {
  return `${Math.round(value)}%`;
}

function getPaceMainMessage(status: BudgetPaceStatus, hasBudget: boolean) {
  if (!hasBudget) {
    return "Todavía no tiene presupuesto definido";
  }

  if (status === "exceeded") {
    return "Te excediste en tu presupuesto";
  }

  if (status === "risk") {
    return "Podrías excederte si mantenés este ritmo";
  }

  return "Viene en línea con tu presupuesto";
}

export default function InsightsPage() {
  const { supabase, workspace } = useWorkspace();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const now = useMemo(() => new Date(), []);
  const currentPeriod = useMemo<PeriodRef>(
    () => ({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    }),
    [now],
  );
  const closedPeriod = useMemo(
    () => buildPreviousPeriod(currentPeriod.year, currentPeriod.month),
    [currentPeriod.month, currentPeriod.year],
  );
  const comparisonPeriod = useMemo(
    () => buildPreviousPeriod(closedPeriod.year, closedPeriod.month),
    [closedPeriod.month, closedPeriod.year],
  );

  const [activeTab, setActiveTab] = useState<TabValue>("current");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItemLiteRow[]>([]);
  const [currentTransactions, setCurrentTransactions] = useState<TransactionLiteRow[]>([]);
  const [historicalTransactions, setHistoricalTransactions] = useState<TransactionLiteRow[]>([]);
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const loadInsightsData = useCallback(async () => {
    setIsLoading(true);

    const currentRange = buildMonthRange(currentPeriod.year, currentPeriod.month);
    const comparisonRange = buildMonthRange(comparisonPeriod.year, comparisonPeriod.month);
    const closedRange = buildMonthRange(closedPeriod.year, closedPeriod.month);

    const [
      categoriesResponse,
      settingsResponse,
      periodResponse,
      currentTransactionsResponse,
      historicalTransactionsResponse,
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("currency_code, show_cents")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
      supabase
        .from("budget_periods")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("year", currentPeriod.year)
        .eq("month", currentPeriod.month)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("category_id, amount, type, transaction_date, effective_date")
        .eq("workspace_id", workspace.id)
        .or(buildTransactionPeriodFilter(currentRange.start, currentRange.end)),
      supabase
        .from("transactions")
        .select("category_id, amount, type, transaction_date, effective_date")
        .eq("workspace_id", workspace.id)
        .or(buildTransactionPeriodFilter(comparisonRange.start, closedRange.end)),
    ]);

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar categorías",
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const sortedCategories = [...(categoriesResponse.data ?? [])].sort(sortCategories);
      setCategories(sortedCategories);
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar settings",
        message: settingsResponse.error.message,
      });
      setCurrencyCode("ARS");
      setShowCents(false);
    } else {
      const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
      setCurrencyCode(settings?.currency_code ?? "ARS");
      setShowCents(settings?.show_cents ?? false);
    }

    if (currentTransactionsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar transacciones del mes actual",
        message: currentTransactionsResponse.error.message,
      });
      setCurrentTransactions([]);
    } else {
      setCurrentTransactions((currentTransactionsResponse.data ?? []) as TransactionLiteRow[]);
    }

    if (historicalTransactionsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar transacciones históricas",
        message: historicalTransactionsResponse.error.message,
      });
      setHistoricalTransactions([]);
    } else {
      setHistoricalTransactions((historicalTransactionsResponse.data ?? []) as TransactionLiteRow[]);
    }

    if (periodResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar el presupuesto del mes actual",
        message: periodResponse.error.message,
      });
      setBudgetItems([]);
      setIsLoading(false);
      return;
    }

    const period = periodResponse.data as BudgetPeriodIdRow | null;
    if (!period) {
      setBudgetItems([]);
      setIsLoading(false);
      return;
    }

    const budgetItemsResponse = await supabase
      .from("budget_items")
      .select("category_id, amount")
      .eq("budget_period_id", period.id);

    if (budgetItemsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar ítems de presupuesto",
        message: budgetItemsResponse.error.message,
      });
      setBudgetItems([]);
    } else {
      setBudgetItems((budgetItemsResponse.data ?? []) as BudgetItemLiteRow[]);
    }

    setIsLoading(false);
  }, [
    closedPeriod.month,
    closedPeriod.year,
    comparisonPeriod.month,
    comparisonPeriod.year,
    currentPeriod.month,
    currentPeriod.year,
    supabase,
    workspace.id,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInsightsData();
  }, [loadInsightsData]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const currentMonthData = useMemo(() => {
    const expenseByCategoryId = new Map<string, number>();
    const budgetByCategoryId = new Map<string, number>();
    let totalExpense = 0;

    for (const row of currentTransactions) {
      if (row.type !== "expense") {
        continue;
      }

      const amount = parseAmountValue(row.amount);
      if (Math.abs(amount) < deviationTolerance) {
        continue;
      }

      totalExpense += amount;
      expenseByCategoryId.set(row.category_id, (expenseByCategoryId.get(row.category_id) ?? 0) + amount);
    }

    for (const item of budgetItems) {
      const category = categoryById.get(item.category_id);
      if (!category || category.type !== "expense") {
        continue;
      }

      const amount = parseAmountValue(item.amount);
      budgetByCategoryId.set(item.category_id, (budgetByCategoryId.get(item.category_id) ?? 0) + amount);
    }

    const topCategories: CategorySpendRow[] = Array.from(expenseByCategoryId.entries())
      .map(([categoryId, amount]) => ({
        categoryId,
        categoryName: categoryById.get(categoryId)?.name ?? "Categoría sin nombre",
        amount: roundMoney(amount),
        sharePercent: totalExpense > deviationTolerance ? (amount / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const daysInMonth = new Date(currentPeriod.year, currentPeriod.month, 0).getDate();
    const elapsedDays = Math.max(1, Math.min(now.getDate(), daysInMonth));
    const progressPercent = clampToPercent((elapsedDays / daysInMonth) * 100);

    const categoryIdsWithData = new Set<string>([
      ...expenseByCategoryId.keys(),
      ...budgetByCategoryId.keys(),
    ]);

    const paceRows: BudgetPaceRow[] = [];

    for (const categoryId of categoryIdsWithData) {
      const category = categoryById.get(categoryId);
      if (!category || category.type !== "expense") {
        continue;
      }

      const budgetAmount = roundMoney(budgetByCategoryId.get(categoryId) ?? 0);
      const currentAmount = roundMoney(expenseByCategoryId.get(categoryId) ?? 0);

      if (Math.abs(budgetAmount) < deviationTolerance && Math.abs(currentAmount) < deviationTolerance) {
        continue;
      }

      const projectedAmount = roundMoney((currentAmount / elapsedDays) * daysInMonth);

      let status: BudgetPaceStatus;
      if (budgetAmount <= deviationTolerance) {
        status = currentAmount > deviationTolerance ? "exceeded" : "inline";
      } else if (currentAmount - budgetAmount > deviationTolerance) {
        status = "exceeded";
      } else if (projectedAmount - budgetAmount > deviationTolerance) {
        status = "risk";
      } else {
        status = "inline";
      }

      paceRows.push({
        categoryId,
        categoryName: category.name,
        budgetAmount,
        currentAmount,
        projectedAmount,
        status,
      });
    }

    const statusPriority: Record<BudgetPaceStatus, number> = {
      exceeded: 0,
      risk: 1,
      inline: 2,
    };

    paceRows.sort((a, b) => {
      const statusDiff = statusPriority[a.status] - statusPriority[b.status];
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return b.currentAmount - a.currentAmount;
    });

    return {
      elapsedDays,
      daysInMonth,
      progressPercent,
      totalExpense: roundMoney(totalExpense),
      topCategories,
      paceRows: paceRows.slice(0, 3),
    };
  }, [budgetItems, categoryById, currentPeriod.month, currentPeriod.year, currentTransactions, now]);

  const currentInsights = useMemo(() => {
    const messages: string[] = [];

    const topCategory = currentMonthData.topCategories[0];
    if (topCategory && currentMonthData.totalExpense > deviationTolerance) {
      messages.push(
        `Hasta ahora, ${topCategory.categoryName} representa ${percentageFormatter.format(topCategory.sharePercent)}% de tus gastos.`,
      );
    }

    const exceededRow = currentMonthData.paceRows.find((row) => row.status === "exceeded");
    if (exceededRow) {
      if (exceededRow.budgetAmount <= deviationTolerance) {
        messages.push(
          `${exceededRow.categoryName} ya acumula gasto sin presupuesto cargado este mes.`,
        );
      } else {
        messages.push(`Ya superaste tu presupuesto en ${exceededRow.categoryName}.`);
      }
    }

    const riskRow = currentMonthData.paceRows.find((row) => row.status === "risk");
    if (riskRow) {
      messages.push(`Podrías excederte en ${riskRow.categoryName} si mantenés este ritmo.`);
    }

    if (messages.length === 0) {
      messages.push("Todavía no hay señales fuertes en este mes. Cuando haya más movimiento, vas a ver insights acá.");
    }

    return messages.slice(0, 3);
  }, [currentMonthData.paceRows, currentMonthData.topCategories, currentMonthData.totalExpense, percentageFormatter]);

  const closedMonthData = useMemo(() => {
    const closedKey = getPeriodKey(closedPeriod);
    const previousKey = getPeriodKey(comparisonPeriod);

    const closedExpenseByCategoryId = new Map<string, number>();
    const previousExpenseByCategoryId = new Map<string, number>();

    const closedTotals: TotalsByType = {
      income: 0,
      expense: 0,
      saving: 0,
    };

    const previousTotals: TotalsByType = {
      income: 0,
      expense: 0,
      saving: 0,
    };

    for (const row of historicalTransactions) {
      const periodKey = getDatePeriodKey(row.effective_date ?? row.transaction_date);
      const amount = parseAmountValue(row.amount);

      if (periodKey === closedKey) {
        closedTotals[row.type] += amount;

        if (row.type === "expense") {
          closedExpenseByCategoryId.set(
            row.category_id,
            (closedExpenseByCategoryId.get(row.category_id) ?? 0) + amount,
          );
        }
        continue;
      }

      if (periodKey === previousKey) {
        previousTotals[row.type] += amount;

        if (row.type === "expense") {
          previousExpenseByCategoryId.set(
            row.category_id,
            (previousExpenseByCategoryId.get(row.category_id) ?? 0) + amount,
          );
        }
      }
    }

    const topClosedCategories: CategorySpendRow[] = Array.from(closedExpenseByCategoryId.entries())
      .map(([categoryId, amount]) => ({
        categoryId,
        categoryName: categoryById.get(categoryId)?.name ?? "Categoría sin nombre",
        amount: roundMoney(amount),
        sharePercent:
          closedTotals.expense > deviationTolerance ? (amount / closedTotals.expense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    const comparisonRows: ClosedComparisonRow[] = Array.from(
      new Set([...closedExpenseByCategoryId.keys(), ...previousExpenseByCategoryId.keys()]),
    ).map((categoryId) => {
      const closedAmount = roundMoney(closedExpenseByCategoryId.get(categoryId) ?? 0);
      const previousAmount = roundMoney(previousExpenseByCategoryId.get(categoryId) ?? 0);
      const deltaAmount = roundMoney(closedAmount - previousAmount);
      const deltaPercent =
        Math.abs(previousAmount) < deviationTolerance ? null : (deltaAmount / previousAmount) * 100;

      return {
        categoryId,
        categoryName: categoryById.get(categoryId)?.name ?? "Categoría sin nombre",
        closedAmount,
        previousAmount,
        deltaAmount,
        deltaPercent,
      };
    });

    const increases = comparisonRows
      .filter((row) => row.deltaAmount > deviationTolerance)
      .sort((a, b) => b.deltaAmount - a.deltaAmount)
      .slice(0, 3);

    const reductions = comparisonRows
      .filter((row) => row.deltaAmount < -deviationTolerance)
      .sort((a, b) => a.deltaAmount - b.deltaAmount)
      .slice(0, 3);

    return {
      closedTotals: {
        income: roundMoney(closedTotals.income),
        expense: roundMoney(closedTotals.expense),
        saving: roundMoney(closedTotals.saving),
      },
      previousTotals: {
        income: roundMoney(previousTotals.income),
        expense: roundMoney(previousTotals.expense),
        saving: roundMoney(previousTotals.saving),
      },
      topClosedCategories,
      increases,
      reductions,
    };
  }, [categoryById, closedPeriod, comparisonPeriod, historicalTransactions]);

  const closedInsights = useMemo(() => {
    const messages: string[] = [];

    const totalDelta = roundMoney(
      closedMonthData.closedTotals.expense - closedMonthData.previousTotals.expense,
    );

    if (Math.abs(totalDelta) > deviationTolerance) {
      const direction = totalDelta > 0 ? "más" : "menos";
      messages.push(
        `Gastaste ${currencyFormatter.format(Math.abs(totalDelta))} ${direction} que en ${periodLabel(comparisonPeriod)}.`,
      );
    }

    const topCategory = closedMonthData.topClosedCategories[0];
    if (topCategory) {
      messages.push(
        `${topCategory.categoryName} fue tu mayor categoría de gasto en ${periodLabel(closedPeriod)}.`,
      );
    }

    const topIncrease = closedMonthData.increases[0];
    if (topIncrease) {
      if (topIncrease.deltaPercent === null) {
        messages.push(
          `${topIncrease.categoryName} subió respecto al mes anterior (${currencyFormatter.format(topIncrease.deltaAmount)}).`,
        );
      } else {
        messages.push(
          `${topIncrease.categoryName} aumentó ${percentageFormatter.format(Math.abs(topIncrease.deltaPercent))}% respecto al mes anterior.`,
        );
      }
    } else {
      const topReduction = closedMonthData.reductions[0];
      if (topReduction) {
        if (topReduction.deltaPercent === null) {
          messages.push(
            `Reduciste ${topReduction.categoryName} en ${currencyFormatter.format(Math.abs(topReduction.deltaAmount))}.`,
          );
        } else {
          messages.push(
            `Reduciste ${topReduction.categoryName} en ${percentageFormatter.format(Math.abs(topReduction.deltaPercent))}% respecto al mes anterior.`,
          );
        }
      }
    }

    if (messages.length === 0) {
      messages.push("Todavía no hay suficiente historial para comparar el último mes cerrado.");
    }

    return messages.slice(0, 3);
  }, [
    closedMonthData.closedTotals.expense,
    closedMonthData.increases,
    closedMonthData.previousTotals.expense,
    closedMonthData.reductions,
    closedMonthData.topClosedCategories,
    closedPeriod,
    comparisonPeriod,
    currencyFormatter,
    percentageFormatter,
  ]);

  const drilldownHref = useCallback((period: PeriodRef, categoryId: string) => {
    const params = new URLSearchParams({
      year: String(period.year),
      month: String(period.month),
      categoryId,
      type: "expense",
    });

    return `/app/transactions?${params.toString()}`;
  }, []);

  const currentMonthBadge = periodLabel(currentPeriod);
  const closedMonthBadge = periodLabel(closedPeriod);
  const comparisonMonthBadge = periodLabel(comparisonPeriod);

  const closedBalance = roundMoney(
    closedMonthData.closedTotals.income -
      closedMonthData.closedTotals.expense -
      closedMonthData.closedTotals.saving,
  );
  const remainingDays = Math.max(currentMonthData.daysInMonth - currentMonthData.elapsedDays, 0);

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Stack gap={2}>
        <Title order={2}>Insights</Title>
        <Text c="dimmed" size="sm">
          Vista analítica para entender tu ritmo del mes y comparar cómo cerró el período anterior.
        </Text>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab((value as TabValue) ?? "current")}
        variant="outline"
      >
        <Tabs.List>
          <Tabs.Tab value="current">Este mes</Tabs.Tab>
          <Tabs.Tab value="closed">Mes cerrado</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="current" pt="sm">
          <Stack gap="sm">
            <Stack gap={6}>
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Text fw={700}>Estado del período actual</Text>
                <Badge color="gray" variant="light">
                  {currentMonthBadge}
                </Badge>
              </Group>

              <Text fw={700}>
                Día {currentMonthData.elapsedDays} de {currentMonthData.daysInMonth}
              </Text>
              <Progress value={currentMonthData.progressPercent} color="teal" size="sm" />
              <Text size="sm">
                Gastaste {currencyFormatter.format(currentMonthData.totalExpense)} hasta hoy.
              </Text>
              <Text size="sm" c="dimmed">
                Quedan {remainingDays} días para ajustar el ritmo.
              </Text>
            </Stack>

            <Stack gap={6}>
              <Text fw={700}>Señales principales</Text>
              {currentInsights.map((message) => (
                <Text key={message} size="sm">
                  • {message}
                </Text>
              ))}
            </Stack>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text fw={700}>Top categorías actuales</Text>

                {currentMonthData.topCategories.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Todavía no hay gastos suficientes para destacar categorías.
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {currentMonthData.topCategories.map((row) => (
                      <Paper key={row.categoryId} withBorder radius="sm" p="xs">
                        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                          <Stack gap={1} style={{ flex: 1, minWidth: 180 }}>
                            <Text fw={600} size="sm">
                              {row.categoryName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {getRoundedPercentLabel(row.sharePercent)} de tu gasto hasta ahora
                            </Text>
                          </Stack>

                          <Group gap="xs">
                            <Text fw={700}>{currencyFormatter.format(row.amount)}</Text>
                            <Button
                              component={Link}
                              href={drilldownHref(currentPeriod, row.categoryId)}
                              size="xs"
                              variant="subtle"
                              color="gray"
                            >
                              Ver detalle
                            </Button>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text fw={700}>Presupuesto vs ritmo</Text>

                {currentMonthData.paceRows.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No hay categorías con señales de ritmo para este mes.
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {currentMonthData.paceRows.map((row) => {
                      const hasBudget = row.budgetAmount > deviationTolerance;
                      const paceMessage = getPaceMainMessage(row.status, hasBudget);
                      const mainDelta =
                        hasBudget && row.status === "risk"
                          ? row.projectedAmount - row.budgetAmount
                          : row.currentAmount - row.budgetAmount;
                      const deltaColor =
                        row.status === "exceeded"
                          ? "pink.7"
                          : row.status === "risk"
                            ? "yellow.8"
                            : "teal.7";

                      return (
                        <Paper key={row.categoryId} withBorder radius="sm" p="xs">
                          <Stack gap={4}>
                            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                              <Text fw={600} size="sm">
                                {row.categoryName}
                              </Text>
                              <Button
                                component={Link}
                                href={drilldownHref(currentPeriod, row.categoryId)}
                                size="compact-xs"
                                variant="subtle"
                                color="gray"
                              >
                                Ver transacciones
                              </Button>
                            </Group>

                            <Text size="sm" fw={600}>
                              {paceMessage}
                            </Text>
                            <Text
                              fw={800}
                              c={deltaColor}
                              style={{
                                fontSize: isMobile ? "1.25rem" : "1.45rem",
                                lineHeight: 1,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatSignedCurrency(mainDelta, currencyFormatter)}
                            </Text>

                            {hasBudget ? (
                              <Text size="sm" c="dimmed">
                                Llevás {currencyFormatter.format(row.currentAmount)} de{" "}
                                {currencyFormatter.format(row.budgetAmount)}.
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">
                                Llevás {currencyFormatter.format(row.currentAmount)} y todavía no tiene
                                presupuesto definido para este mes.
                              </Text>
                            )}

                            <Text size="xs" c="dimmed">
                              Proyección: {currencyFormatter.format(row.projectedAmount)}
                            </Text>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="closed" pt="sm">
          <Stack gap="sm">
            <Paper withBorder radius="md" p="sm">
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap" gap="xs">
                  <Text fw={700}>Resumen del último mes cerrado</Text>
                  <Badge color="gray" variant="light">
                    {closedMonthBadge}
                  </Badge>
                </Group>

                <SimpleGrid cols={isMobile ? 2 : 4} spacing="xs">
                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      Ingresos
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedMonthData.closedTotals.income)}</Text>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      Gastos
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedMonthData.closedTotals.expense)}</Text>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      Ahorro
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedMonthData.closedTotals.saving)}</Text>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      Balance
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedBalance)}</Text>
                  </Paper>
                </SimpleGrid>

                <Text size="xs" c="dimmed">
                  Comparado con {comparisonMonthBadge}: {formatSignedCurrency(closedMonthData.closedTotals.expense - closedMonthData.previousTotals.expense, currencyFormatter)} en gastos totales.
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text fw={700}>Top categorías del mes cerrado</Text>

                {closedMonthData.topClosedCategories.length === 0 ? (
                  <Stack gap={5}>
                    <Text size="sm">
                      Todavía no hay suficiente información para analizar este período.
                    </Text>
                    <Text size="sm" c="dimmed">
                      Cuando completes un mes, vas a poder ver:
                    </Text>
                    <Text size="sm" c="dimmed">
                      • tus principales categorías de gasto
                    </Text>
                    <Text size="sm" c="dimmed">
                      • qué aumentó o bajó respecto al mes anterior
                    </Text>
                    <Text size="sm" c="dimmed">
                      • cómo evoluciona tu dinero mes a mes
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap={6}>
                    {closedMonthData.topClosedCategories.map((row) => (
                      <Paper key={row.categoryId} withBorder radius="sm" p="xs">
                        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                          <Stack gap={1} style={{ flex: 1, minWidth: 180 }}>
                            <Text fw={600} size="sm">
                              {row.categoryName}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {percentageFormatter.format(row.sharePercent)}% de los gastos del mes cerrado
                            </Text>
                          </Stack>

                          <Group gap="xs">
                            <Text fw={700}>{currencyFormatter.format(row.amount)}</Text>
                            <Button
                              component={Link}
                              href={drilldownHref(closedPeriod, row.categoryId)}
                              size="xs"
                              variant="subtle"
                              color="gray"
                            >
                              Ver detalle
                            </Button>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text fw={700}>Comparación vs mes anterior</Text>
                <Text size="xs" c="dimmed">
                  {closedMonthBadge} comparado contra {comparisonMonthBadge}
                </Text>

                <SimpleGrid cols={isMobile ? 1 : 2} spacing="xs">
                  <Paper withBorder radius="sm" p="xs">
                    <Stack gap={6}>
                      <Group justify="space-between" align="center">
                        <Text fw={600} size="sm">
                          Mayores aumentos
                        </Text>
                        <Badge color="pink" variant="light">
                          {closedMonthData.increases.length}
                        </Badge>
                      </Group>

                      {closedMonthData.increases.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          No hubo aumentos relevantes.
                        </Text>
                      ) : (
                        <Stack gap={6}>
                          {closedMonthData.increases.map((row) => (
                            <Stack key={row.categoryId} gap={2}>
                              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                                <Text size="sm" fw={600}>
                                  {row.categoryName}
                                </Text>
                                <Text size="sm" fw={700} c="pink.7">
                                  {formatSignedCurrency(row.deltaAmount, currencyFormatter)}
                                </Text>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {row.deltaPercent === null
                                  ? "Sin gasto comparable en el mes anterior"
                                  : `Variación: ${formatSignedPercent(row.deltaPercent, percentageFormatter)}`}
                              </Text>
                              <Button
                                component={Link}
                                href={drilldownHref(closedPeriod, row.categoryId)}
                                size="compact-xs"
                                variant="subtle"
                                color="gray"
                                px={0}
                                justify="flex-start"
                              >
                                Ver transacciones
                              </Button>
                              <Divider />
                            </Stack>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Stack gap={6}>
                      <Group justify="space-between" align="center">
                        <Text fw={600} size="sm">
                          Mayores reducciones
                        </Text>
                        <Badge color="teal" variant="light">
                          {closedMonthData.reductions.length}
                        </Badge>
                      </Group>

                      {closedMonthData.reductions.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          No hubo reducciones relevantes.
                        </Text>
                      ) : (
                        <Stack gap={6}>
                          {closedMonthData.reductions.map((row) => (
                            <Stack key={row.categoryId} gap={2}>
                              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                                <Text size="sm" fw={600}>
                                  {row.categoryName}
                                </Text>
                                <Text size="sm" fw={700} c="teal.7">
                                  {formatSignedCurrency(row.deltaAmount, currencyFormatter)}
                                </Text>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {row.deltaPercent === null
                                  ? "Sin gasto comparable en el mes anterior"
                                  : `Variación: ${formatSignedPercent(row.deltaPercent, percentageFormatter)}`}
                              </Text>
                              <Button
                                component={Link}
                                href={drilldownHref(closedPeriod, row.categoryId)}
                                size="compact-xs"
                                variant="subtle"
                                color="gray"
                                px={0}
                                justify="flex-start"
                              >
                                Ver transacciones
                              </Button>
                              <Divider />
                            </Stack>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Stack gap={6}>
                <Text fw={700}>Conclusiones del mes cerrado</Text>
                {closedInsights.map((message) => (
                  <Text key={message} size="sm">
                    {message}
                  </Text>
                ))}
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
