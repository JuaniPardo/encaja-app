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

import {
  buildMonthOptions,
  localeCompareByName,
  monthLabelFromOptions,
} from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, ExpenseBehavior, TransactionType } from "@/types/database";

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
  expenseBehavior: ExpenseBehavior;
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

function resolveExpenseBehavior(category: CategoryRow): ExpenseBehavior {
  return category.expense_behavior ?? "variable";
}

function getPaceMainMessage(
  status: BudgetPaceStatus,
  hasBudget: boolean,
  expenseBehavior: ExpenseBehavior,
  t: (key: string, fallback?: string, values?: Record<string, string | number>) => string,
) {
  if (!hasBudget) {
    return t("insights.pace.main.noBudget");
  }

  if (status === "exceeded") {
    return t("insights.pace.main.exceeded");
  }

  if (status === "risk") {
    return t("insights.pace.main.risk");
  }

  if (expenseBehavior === "fixed") {
    return t("insights.pace.main.fixedInline");
  }

  return t("insights.pace.main.inline");
}

export default function InsightsPage() {
  const { supabase, workspace } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const isMobile = useMediaQuery("(max-width: 48em)");
  const monthOptions = useMemo(() => buildMonthOptions(intlLocale), [intlLocale]);
  const periodLabel = useCallback(
    (period: PeriodRef) =>
      `${monthLabelFromOptions(period.month, monthOptions, t("common.messages.month"))} ${
        period.year
      }`,
    [monthOptions, t],
  );

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
        title: t("insights.notifications.loadCategoriesError"),
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const sortedCategories = [...(categoriesResponse.data ?? [])].sort((a, b) =>
        sortCategories(a, b, locale),
      );
      setCategories(sortedCategories);
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: t("insights.notifications.loadSettingsError"),
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
        title: t("insights.notifications.loadCurrentTransactionsError"),
        message: currentTransactionsResponse.error.message,
      });
      setCurrentTransactions([]);
    } else {
      setCurrentTransactions((currentTransactionsResponse.data ?? []) as TransactionLiteRow[]);
    }

    if (historicalTransactionsResponse.error) {
      notifications.show({
        color: "red",
        title: t("insights.notifications.loadHistoricalTransactionsError"),
        message: historicalTransactionsResponse.error.message,
      });
      setHistoricalTransactions([]);
    } else {
      setHistoricalTransactions((historicalTransactionsResponse.data ?? []) as TransactionLiteRow[]);
    }

    if (periodResponse.error) {
      notifications.show({
        color: "red",
        title: t("insights.notifications.loadCurrentBudgetError"),
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
        title: t("insights.notifications.loadBudgetItemsError"),
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
    locale,
    supabase,
    t,
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
        categoryName: categoryById.get(categoryId)?.name ?? t("insights.categoryWithoutName"),
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
      const expenseBehavior = resolveExpenseBehavior(category);

      if (Math.abs(budgetAmount) < deviationTolerance && Math.abs(currentAmount) < deviationTolerance) {
        continue;
      }

      const projectedAmount =
        expenseBehavior === "variable"
          ? roundMoney((currentAmount / elapsedDays) * daysInMonth)
          : currentAmount;

      let status: BudgetPaceStatus;
      if (budgetAmount <= deviationTolerance) {
        status = currentAmount > deviationTolerance ? "exceeded" : "inline";
      } else if (currentAmount - budgetAmount > deviationTolerance) {
        status = "exceeded";
      } else if (
        expenseBehavior === "variable" &&
        projectedAmount - budgetAmount > deviationTolerance
      ) {
        status = "risk";
      } else {
        status = "inline";
      }

      paceRows.push({
        categoryId,
        categoryName: category.name,
        expenseBehavior,
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
  }, [budgetItems, categoryById, currentPeriod.month, currentPeriod.year, currentTransactions, now, t]);

  const currentInsights = useMemo(() => {
    const messages: string[] = [];

    const topCategory = currentMonthData.topCategories[0];
    if (topCategory && currentMonthData.totalExpense > deviationTolerance) {
      messages.push(
        t("insights.current.messages.topCategoryShare", undefined, {
          categoryName: topCategory.categoryName,
          sharePercent: percentageFormatter.format(topCategory.sharePercent),
        }),
      );
    }

    const exceededRow = currentMonthData.paceRows.find((row) => row.status === "exceeded");
    if (exceededRow) {
      if (exceededRow.budgetAmount <= deviationTolerance) {
        messages.push(
          t("insights.current.messages.exceededNoBudget", undefined, {
            categoryName: exceededRow.categoryName,
          }),
        );
      } else {
        messages.push(
          t("insights.current.messages.exceeded", undefined, {
            categoryName: exceededRow.categoryName,
          }),
        );
      }
    }

    const riskRow = currentMonthData.paceRows.find((row) => row.status === "risk");
    if (riskRow) {
      messages.push(
        t("insights.current.messages.risk", undefined, {
          categoryName: riskRow.categoryName,
        }),
      );
    }

    if (messages.length === 0) {
      messages.push(t("insights.current.messages.noStrongSignals"));
    }

    return messages.slice(0, 3);
  }, [
    currentMonthData.paceRows,
    currentMonthData.topCategories,
    currentMonthData.totalExpense,
    percentageFormatter,
    t,
  ]);

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
        categoryName: categoryById.get(categoryId)?.name ?? t("insights.categoryWithoutName"),
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
        categoryName: categoryById.get(categoryId)?.name ?? t("insights.categoryWithoutName"),
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
  }, [categoryById, closedPeriod, comparisonPeriod, historicalTransactions, t]);

  const closedInsights = useMemo(() => {
    const messages: string[] = [];

    const totalDelta = roundMoney(
      closedMonthData.closedTotals.expense - closedMonthData.previousTotals.expense,
    );

    if (Math.abs(totalDelta) > deviationTolerance) {
      messages.push(
        t("insights.closed.messages.totalDelta", undefined, {
          amount: currencyFormatter.format(Math.abs(totalDelta)),
          direction:
            totalDelta > 0
              ? t("insights.closed.direction.more")
              : t("insights.closed.direction.less"),
          comparisonPeriod: periodLabel(comparisonPeriod),
        }),
      );
    }

    const topCategory = closedMonthData.topClosedCategories[0];
    if (topCategory) {
      messages.push(
        t("insights.closed.messages.topCategory", undefined, {
          categoryName: topCategory.categoryName,
          closedPeriod: periodLabel(closedPeriod),
        }),
      );
    }

    const topIncrease = closedMonthData.increases[0];
    if (topIncrease) {
      if (topIncrease.deltaPercent === null) {
        messages.push(
          t("insights.closed.messages.topIncreaseAmount", undefined, {
            categoryName: topIncrease.categoryName,
            amount: currencyFormatter.format(topIncrease.deltaAmount),
          }),
        );
      } else {
        messages.push(
          t("insights.closed.messages.topIncreasePercent", undefined, {
            categoryName: topIncrease.categoryName,
            percent: percentageFormatter.format(Math.abs(topIncrease.deltaPercent)),
          }),
        );
      }
    } else {
      const topReduction = closedMonthData.reductions[0];
      if (topReduction) {
        if (topReduction.deltaPercent === null) {
          messages.push(
            t("insights.closed.messages.topReductionAmount", undefined, {
              categoryName: topReduction.categoryName,
              amount: currencyFormatter.format(Math.abs(topReduction.deltaAmount)),
            }),
          );
        } else {
          messages.push(
            t("insights.closed.messages.topReductionPercent", undefined, {
              categoryName: topReduction.categoryName,
              percent: percentageFormatter.format(Math.abs(topReduction.deltaPercent)),
            }),
          );
        }
      }
    }

    if (messages.length === 0) {
      messages.push(t("insights.closed.messages.noHistory"));
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
    periodLabel,
    percentageFormatter,
    t,
  ]);

  const drilldownHref = useCallback((period: PeriodRef, categoryId: string) => {
    return buildTransactionsDrilldownHref({
      workspaceSlug: workspace.slug,
      year: period.year,
      month: period.month,
      categoryId,
      type: "expense",
    });
  }, [workspace.slug]);

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
        <Title order={2}>{t("insights.title")}</Title>
        <Text c="dimmed" size="sm">
          {t("insights.subtitle")}
        </Text>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab((value as TabValue) ?? "current")}
        variant="outline"
      >
        <Tabs.List>
          <Tabs.Tab value="current">{t("insights.tabs.current")}</Tabs.Tab>
          <Tabs.Tab value="closed">{t("insights.tabs.closed")}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="current" pt="sm">
          <Stack gap="sm">
            <Stack gap={6}>
              <Group justify="space-between" wrap="wrap" gap="xs">
                <Text fw={700}>{t("insights.current.periodStatus")}</Text>
                <Badge color="gray" variant="light">
                  {currentMonthBadge}
                </Badge>
              </Group>

              <Text fw={700}>
                {t("insights.current.dayProgress", undefined, {
                  day: currentMonthData.elapsedDays,
                  daysInMonth: currentMonthData.daysInMonth,
                })}
              </Text>
              <Progress value={currentMonthData.progressPercent} color="teal" size="sm" />
              <Text size="sm">
                {t("insights.current.spentUntilToday", undefined, {
                  amount: currencyFormatter.format(currentMonthData.totalExpense),
                })}
              </Text>
              <Text size="sm" c="dimmed">
                {t("insights.current.remainingDays", undefined, { days: remainingDays })}
              </Text>
            </Stack>

            <Stack gap={6}>
              <Text fw={700}>{t("insights.current.mainSignals")}</Text>
              {currentInsights.map((message) => (
                <Text key={message} size="sm">
                  • {message}
                </Text>
              ))}
            </Stack>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text fw={700}>{t("insights.current.topCategories")}</Text>

                {currentMonthData.topCategories.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("insights.current.noTopCategories")}
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
                              {t("insights.current.shareUntilNow", undefined, {
                                percent: getRoundedPercentLabel(row.sharePercent),
                              })}
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
                              {t("insights.current.viewDetail")}
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
                <Text fw={700}>{t("insights.pace.title")}</Text>

                {currentMonthData.paceRows.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("insights.pace.noRows")}
                  </Text>
                ) : (
                  <Stack gap={6}>
                    {currentMonthData.paceRows.map((row) => {
                      const hasBudget = row.budgetAmount > deviationTolerance;
                      const paceMessage = getPaceMainMessage(
                        row.status,
                        hasBudget,
                        row.expenseBehavior,
                        t,
                      );
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
                              <Group gap="xs">
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={row.expenseBehavior === "fixed" ? "gray" : "blue"}
                                >
                                  {row.expenseBehavior === "fixed"
                                    ? t("common.domain.expenseBehavior.fixed")
                                    : t("common.domain.expenseBehavior.variable")}
                                </Badge>
                                <Button
                                  component={Link}
                                  href={drilldownHref(currentPeriod, row.categoryId)}
                                  size="compact-xs"
                                  variant="subtle"
                                  color="gray"
                                >
                                  {t("insights.current.viewTransactions")}
                                </Button>
                              </Group>
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
                                {t("insights.pace.progressWithBudget", undefined, {
                                  currentAmount: currencyFormatter.format(row.currentAmount),
                                  budgetAmount: currencyFormatter.format(row.budgetAmount),
                                })}
                              </Text>
                            ) : (
                              <Text size="xs" c="dimmed">
                                {t("insights.pace.progressWithoutBudget", undefined, {
                                  currentAmount: currencyFormatter.format(row.currentAmount),
                                })}
                              </Text>
                            )}

                            <Text size="xs" c="dimmed">
                              {row.expenseBehavior === "fixed"
                                ? t("insights.pace.fixedProjection")
                                : t("insights.pace.variableProjection", undefined, {
                                    projectedAmount: currencyFormatter.format(row.projectedAmount),
                                  })}
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
                  <Text fw={700}>{t("insights.closed.summaryTitle")}</Text>
                  <Badge color="gray" variant="light">
                    {closedMonthBadge}
                  </Badge>
                </Group>

                <SimpleGrid cols={isMobile ? 2 : 4} spacing="xs">
                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      {t("dashboard.incomeLabel")}
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedMonthData.closedTotals.income)}</Text>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      {t("dashboard.expenseLabel")}
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedMonthData.closedTotals.expense)}</Text>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      {t("dashboard.savingLabel")}
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedMonthData.closedTotals.saving)}</Text>
                  </Paper>

                  <Paper withBorder radius="sm" p="xs">
                    <Text size="xs" c="dimmed">
                      {t("dashboard.balanceLabel")}
                    </Text>
                    <Text fw={700}>{currencyFormatter.format(closedBalance)}</Text>
                  </Paper>
                </SimpleGrid>

                <Text size="xs" c="dimmed">
                  {t("insights.closed.comparedTo", undefined, {
                    comparisonMonth: comparisonMonthBadge,
                    deltaAmount: formatSignedCurrency(
                      closedMonthData.closedTotals.expense - closedMonthData.previousTotals.expense,
                      currencyFormatter,
                    ),
                  })}
                </Text>
              </Stack>
            </Paper>

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text fw={700}>{t("insights.closed.topCategoriesTitle")}</Text>

                {closedMonthData.topClosedCategories.length === 0 ? (
                  <Stack gap={5}>
                    <Text size="sm">
                      {t("insights.closed.emptyState.title")}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t("insights.closed.emptyState.subtitle")}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t("insights.closed.emptyState.item1")}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t("insights.closed.emptyState.item2")}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t("insights.closed.emptyState.item3")}
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
                              {t("insights.closed.expenseShare", undefined, {
                                sharePercent: percentageFormatter.format(row.sharePercent),
                              })}
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
                              {t("insights.current.viewDetail")}
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
                <Text fw={700}>{t("insights.closed.comparisonTitle")}</Text>
                <Text size="xs" c="dimmed">
                  {t("insights.closed.comparisonSubtitle", undefined, {
                    closedMonth: closedMonthBadge,
                    comparisonMonth: comparisonMonthBadge,
                  })}
                </Text>

                <SimpleGrid cols={isMobile ? 1 : 2} spacing="xs">
                  <Paper withBorder radius="sm" p="xs">
                    <Stack gap={6}>
                      <Group justify="space-between" align="center">
                        <Text fw={600} size="sm">
                          {t("insights.closed.increasesTitle")}
                        </Text>
                        <Badge color="pink" variant="light">
                          {closedMonthData.increases.length}
                        </Badge>
                      </Group>

                      {closedMonthData.increases.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          {t("insights.closed.noIncreases")}
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
                                  ? t("insights.closed.noComparableExpense")
                                  : t("insights.closed.variation", undefined, {
                                      value: formatSignedPercent(row.deltaPercent, percentageFormatter),
                                    })}
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
                                {t("insights.current.viewTransactions")}
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
                          {t("insights.closed.reductionsTitle")}
                        </Text>
                        <Badge color="teal" variant="light">
                          {closedMonthData.reductions.length}
                        </Badge>
                      </Group>

                      {closedMonthData.reductions.length === 0 ? (
                        <Text size="xs" c="dimmed">
                          {t("insights.closed.noReductions")}
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
                                  ? t("insights.closed.noComparableExpense")
                                  : t("insights.closed.variation", undefined, {
                                      value: formatSignedPercent(row.deltaPercent, percentageFormatter),
                                    })}
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
                                {t("insights.current.viewTransactions")}
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
                <Text fw={700}>{t("insights.closed.conclusionsTitle")}</Text>
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
