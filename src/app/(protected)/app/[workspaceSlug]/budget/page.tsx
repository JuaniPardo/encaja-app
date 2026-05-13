"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Badge,
  Button,
  Group,
  LoadingOverlay,
  NativeSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
  buildCategoryLineKey,
  sortSubcategories,
  type CategorySubcategoryRow,
} from "@/features/categories/subcategories";
import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
import {
  buildMonthOptions,
  localeCompareByName,
  mapTransactionTypeLabel,
  monthLabelFromOptions,
} from "@/features/i18n/formatting";
import {
  createBudgetFormSchema,
  type BudgetFormInputValues,
  type BudgetFormValues,
} from "@/features/budget/schema";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import {
  transactionTypeColorShade,
  transactionTypeMantineColor,
} from "@/features/transactions/type-colors";
import { canManageBudgetStructure } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type WorkspaceSettingsRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code" | "show_cents"
>;
type BudgetPeriodIdRow = Pick<Database["public"]["Tables"]["budget_periods"]["Row"], "id">;
type BudgetItemLiteRow = Pick<
  Database["public"]["Tables"]["budget_items"]["Row"],
  "category_id" | "subcategory_id" | "amount"
>;

type BudgetLine = {
  key: string;
  category: CategoryRow;
  subcategory: CategorySubcategoryRow | null;
  index: number;
};

type GroupedCategoryBudget = {
  category: CategoryRow;
  rootLine: BudgetLine;
  subcategoryLines: BudgetLine[];
};

type GroupedCategories = Record<TransactionType, GroupedCategoryBudget[]>;

const typeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
  transfer: 3,
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function buildPreviousPeriod(year: number, month: number) {
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }

  return { year, month: month - 1 };
}

export default function BudgetPage() {
  const { supabase, workspace, user } = useWorkspace();
  const { intlLocale, locale, t } = useI18n();
  const canManageStructure = canManageBudgetStructure(workspace.role);
  const roleLabel = t(`common.role.${workspace.role}`, workspace.role);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
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

  const now = useMemo(() => new Date(), []);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<CategorySubcategoryRow[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [periodHasItems, setPeriodHasItems] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isPeriodLoading, setIsPeriodLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm<BudgetFormInputValues, unknown, BudgetFormValues>({
    resolver: zodResolver(
      createBudgetFormSchema({
        invalidAmount: t("common.validation.invalidAmount"),
        negativeAmount: t("common.validation.nonNegative"),
        invalidCategory: t("common.validation.invalidCategory"),
        invalidSubcategory: t("common.validation.invalidOption"),
      }),
    ),
    defaultValues: {
      items: [],
    },
  });

  const watchedItems = useWatch({
    control,
    name: "items",
  });

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }, [currencyCode, intlLocale, showCents]);

  const groupedCategories = useMemo<GroupedCategories>(() => {
    const grouped: GroupedCategories = {
      income: [],
      expense: [],
      saving: [],
      transfer: [],
    };

    let index = 0;

    categories.forEach((category) => {
      const sortedSubcategories = subcategories
        .filter((subcategory) => subcategory.category_id === category.id)
        .sort((a, b) => sortSubcategories(a, b, locale));

      const rootLine: BudgetLine = {
        key: buildCategoryLineKey(category.id, null),
        category,
        subcategory: null,
        index,
      };
      index += 1;

      const subcategoryLines = sortedSubcategories.map((subcategory) => {
        const line: BudgetLine = {
          key: buildCategoryLineKey(category.id, subcategory.id),
          category,
          subcategory,
          index,
        };
        index += 1;
        return line;
      });

      grouped[category.type].push({
        category,
        rootLine,
        subcategoryLines,
      });
    });

    return grouped;
  }, [categories, locale, subcategories]);

  const budgetLines = useMemo(
    () =>
      (Object.keys(groupedCategories) as TransactionType[])
        .flatMap((type) => groupedCategories[type])
        .flatMap((group) => [group.rootLine, ...group.subcategoryLines])
        .sort((left, right) => left.index - right.index),
    [groupedCategories],
  );

  const totals = useMemo(() => {
    const subtotalByType: Record<TransactionType, number> = {
      income: 0,
      expense: 0,
      saving: 0,
      transfer: 0,
    };

    const typeByCategoryId = new Map(categories.map((category) => [category.id, category.type]));

    for (const item of watchedItems ?? []) {
      if (!item) {
        continue;
      }

      const categoryType = typeByCategoryId.get(item.categoryId);
      if (!categoryType) {
        continue;
      }

      const parsedAmount = parseBudgetAmount(item.amount);
      if (parsedAmount === null) {
        continue;
      }

      subtotalByType[categoryType] += parsedAmount;
    }

    return {
      income: subtotalByType.income,
      expense: subtotalByType.expense,
      saving: subtotalByType.saving,
      assigned: subtotalByType.expense + subtotalByType.saving,
      balance: subtotalByType.income - (subtotalByType.expense + subtotalByType.saving),
    };
  }, [categories, watchedItems]);

  const roundedBalance = roundMoney(totals.balance);
  const isBalanced = Math.abs(roundedBalance) < 0.005;
  const balanceStatus = isBalanced
    ? "balanced"
    : roundedBalance > 0
      ? "remaining"
      : "overassigned";
  const formattedBalanceAbsolute = currencyFormatter.format(Math.abs(roundedBalance));

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
    setIsBootstrapping(true);

    const categoriesResponse = await supabase
      .from("categories")
      .select("id, name, type, is_active, sort_order")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    const subcategoriesResponse = await supabase
      .from("category_subcategories")
      .select("id, workspace_id, category_id, name, is_active, sort_order, created_by, created_at, updated_at")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    const settingsResponse = await supabase
      .from("workspace_settings")
      .select("start_year, currency_code, show_cents")
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.loadActiveCategoriesError"),
        message: categoriesResponse.error.message,
      });
      setCategories([]);
    } else {
      const categoryRows = (categoriesResponse.data ?? []) as CategoryRow[];
      const sortedCategories = [...categoryRows].sort((a: CategoryRow, b: CategoryRow) => {
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
      });

      setCategories(sortedCategories);
    }

    if (subcategoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.loadSubcategoriesError"),
        message: subcategoriesResponse.error.message,
      });
      setSubcategories([]);
    } else {
      setSubcategories((subcategoriesResponse.data ?? []) as CategorySubcategoryRow[]);
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.loadSettingsError"),
        message: settingsResponse.error.message,
      });
      setStartYear(new Date().getFullYear());
      setCurrencyCode("ARS");
      setShowCents(false);
    } else {
      const settingsRow = settingsResponse.data as WorkspaceSettingsRow | null;
      setStartYear(settingsRow?.start_year ?? new Date().getFullYear());
      setCurrencyCode(settingsRow?.currency_code ?? "ARS");
      setShowCents(settingsRow?.show_cents ?? false);
    }

    setIsBootstrapping(false);
  }, [locale, supabase, t, workspace.id]);

  const loadSelectedPeriod = useCallback(async () => {
    setIsPeriodLoading(true);

    const periodResponse = await supabase
      .from("budget_periods")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .maybeSingle();

    if (periodResponse.error) {
      setIsPeriodLoading(false);
      notifications.show({
        color: "red",
        title: t("budget.notifications.loadPeriodError"),
        message: periodResponse.error.message,
      });
      return;
    }

    const periodRow = periodResponse.data as BudgetPeriodIdRow | null;

    if (!periodRow) {
      setPeriodId(null);
      setPeriodHasItems(false);
      reset({
        items: budgetLines.map((line) => ({
          categoryId: line.category.id,
          subcategoryId: line.subcategory?.id ?? null,
          amount: null,
        })),
      });
      setIsPeriodLoading(false);
      return;
    }

    const itemsResponse = await supabase
      .from("budget_items")
      .select("category_id, subcategory_id, amount")
      .eq("budget_period_id", periodRow.id);

    if (itemsResponse.error) {
      setIsPeriodLoading(false);
      notifications.show({
        color: "red",
        title: t("budget.notifications.loadBudgetError"),
        message: itemsResponse.error.message,
      });
      return;
    }

    const periodItems = (itemsResponse.data ?? []) as BudgetItemLiteRow[];
    const amountByCategoryId = new Map(
      periodItems.map((item) => [
        buildCategoryLineKey(item.category_id, item.subcategory_id),
        parseBudgetAmount(item.amount),
      ]),
    );

    reset({
      items: budgetLines.map((line) => ({
        categoryId: line.category.id,
        subcategoryId: line.subcategory?.id ?? null,
        amount: amountByCategoryId.get(line.key) ?? null,
      })),
    });

    setPeriodId(periodRow.id);
    setPeriodHasItems(periodItems.length > 0);
    setIsPeriodLoading(false);
  }, [budgetLines, reset, selectedMonth, selectedYear, supabase, t, workspace.id]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    void loadSelectedPeriod();
  }, [isBootstrapping, loadSelectedPeriod]);

  const ensureBudgetPeriodExists = useCallback(async () => {
    if (periodId) {
      return periodId;
    }

    const insertResponse = await supabase
      .from("budget_periods")
      .insert({
        workspace_id: workspace.id,
        year: selectedYear,
        month: selectedMonth,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (!insertResponse.error) {
      const insertedPeriod = insertResponse.data as BudgetPeriodIdRow;
      setPeriodId(insertedPeriod.id);
      return insertedPeriod.id;
    }

    if (insertResponse.error.code !== "23505") {
      throw insertResponse.error;
    }

    const existingPeriod = await supabase
      .from("budget_periods")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .single();

    if (existingPeriod.error) {
      throw existingPeriod.error;
    }

    const existingPeriodRow = existingPeriod.data as BudgetPeriodIdRow;
    setPeriodId(existingPeriodRow.id);
    return existingPeriodRow.id;
  }, [periodId, selectedMonth, selectedYear, supabase, user.id, workspace.id]);

  const onSubmit = handleSubmit(async (values) => {
    if (!canManageStructure) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.permissionDeniedTitle"),
        message: t("budget.notifications.permissionDeniedMessage"),
      });
      return;
    }

    setIsSaving(true);

    try {
      const targetPeriodId = await ensureBudgetPeriodExists();

      const itemsWithAmount = values.items.reduce<
        Array<{
          budget_period_id: string;
          category_id: string;
          subcategory_id: string | null;
          amount: number;
        }>
      >((accumulator, item) => {
        if (item.amount === null) {
          return accumulator;
        }

        accumulator.push({
          budget_period_id: targetPeriodId,
          category_id: item.categoryId,
          subcategory_id: item.subcategoryId,
          amount: roundMoney(item.amount),
        });

        return accumulator;
      }, []);

      const visibleLineFilters = values.items.map((item) =>
        item.subcategoryId
          ? `and(category_id.eq.${item.categoryId},subcategory_id.eq.${item.subcategoryId})`
          : `and(category_id.eq.${item.categoryId},subcategory_id.is.null)`,
      );

      if (visibleLineFilters.length > 0) {
        const deleteResponse = await supabase
          .from("budget_items")
          .delete()
          .eq("budget_period_id", targetPeriodId)
          .or(visibleLineFilters.join(","));

        if (deleteResponse.error) {
          throw deleteResponse.error;
        }
      }

      if (itemsWithAmount.length > 0) {
        const upsertResponse = await supabase.from("budget_items").upsert(itemsWithAmount, {
          onConflict: "budget_period_id,line_key",
        });

        if (upsertResponse.error) {
          throw upsertResponse.error;
        }
      }

      notifications.show({
        color: "cyan",
        title: t("budget.notifications.savedTitle"),
        message: t("budget.notifications.savedMessage", undefined, {
          monthYear: `${monthLabelFromOptions(
            selectedMonth,
            monthOptions,
            t("common.messages.month"),
          )} ${selectedYear}`,
        }),
      });

      await loadSelectedPeriod();
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.saveError"),
        message: error instanceof Error ? error.message : t("budget.notifications.unexpectedError"),
      });
    } finally {
      setIsSaving(false);
    }
  });

  const copyFromPreviousMonth = async () => {
    if (!canManageStructure) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.permissionDeniedTitle"),
        message: t("budget.notifications.copyPermissionDeniedMessage"),
      });
      return;
    }

    if (periodHasItems) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.copyIneligibleTitle"),
        message: t("budget.notifications.copyIneligibleMessage"),
      });
      return;
    }

    const previous = buildPreviousPeriod(selectedYear, selectedMonth);
    setIsCopying(true);

    try {
      const previousPeriodResponse = await supabase
        .from("budget_periods")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("year", previous.year)
        .eq("month", previous.month)
        .maybeSingle();

      if (previousPeriodResponse.error) {
        throw previousPeriodResponse.error;
      }

      const previousPeriodRow = previousPeriodResponse.data as BudgetPeriodIdRow | null;

      if (!previousPeriodRow) {
        notifications.show({
          color: "yellow",
          title: t("budget.notifications.noPreviousBudgetTitle"),
          message: t("budget.notifications.noPreviousBudgetMessage", undefined, {
            monthYear: `${monthLabelFromOptions(
              previous.month,
              monthOptions,
              t("common.messages.month"),
            )} ${previous.year}`,
          }),
        });
        return;
      }

      const previousItemsResponse = await supabase
        .from("budget_items")
        .select("category_id, subcategory_id, amount")
        .eq("budget_period_id", previousPeriodRow.id);

      if (previousItemsResponse.error) {
        throw previousItemsResponse.error;
      }

      const activeCategoryIds = new Set(categories.map((category) => category.id));
      const activeSubcategoryIds = new Set(subcategories.map((subcategory) => subcategory.id));
      const previousItems = (previousItemsResponse.data ?? []) as BudgetItemLiteRow[];
      const copyRowsSource = previousItems.filter(
        (item) =>
          activeCategoryIds.has(item.category_id) &&
          (item.subcategory_id === null || activeSubcategoryIds.has(item.subcategory_id)),
      );

      if (copyRowsSource.length === 0) {
        notifications.show({
          color: "yellow",
          title: t("budget.notifications.noDataToCopyTitle"),
          message: t("budget.notifications.noDataToCopyActiveCategoriesMessage"),
        });
        return;
      }

      const targetPeriodId = await ensureBudgetPeriodExists();
      const copyRows = copyRowsSource.reduce<
        Array<{
          budget_period_id: string;
          category_id: string;
          subcategory_id: string | null;
          amount: number;
        }>
      >((accumulator, item) => {
        const parsedAmount = parseBudgetAmount(item.amount);
        if (parsedAmount === null) {
          return accumulator;
        }

        accumulator.push({
          budget_period_id: targetPeriodId,
          category_id: item.category_id,
          subcategory_id: item.subcategory_id,
          amount: roundMoney(parsedAmount),
        });

        return accumulator;
      }, []);

      if (copyRows.length === 0) {
        notifications.show({
          color: "yellow",
          title: t("budget.notifications.noDataToCopyTitle"),
          message: t("budget.notifications.noValidAmountsToCopyMessage"),
        });
        return;
      }

      const copyResponse = await supabase.from("budget_items").upsert(copyRows, {
        onConflict: "budget_period_id,line_key",
      });

      if (copyResponse.error) {
        throw copyResponse.error;
      }

      notifications.show({
        color: "cyan",
        title: t("budget.notifications.copiedTitle"),
        message: t("budget.notifications.copiedMessage", undefined, {
          monthYear: `${monthLabelFromOptions(
            previous.month,
            monthOptions,
            t("common.messages.month"),
          )} ${previous.year}`,
        }),
      });

      await loadSelectedPeriod();
    } catch (error) {
      notifications.show({
        color: "red",
        title: t("budget.notifications.copyError"),
        message: error instanceof Error ? error.message : t("budget.notifications.unexpectedError"),
      });
    } finally {
      setIsCopying(false);
    }
  };

  const canCopyFromPrevious =
    canManageStructure && budgetLines.length > 0 && !isPeriodLoading && !isSaving && !periodHasItems;
  const selectedPeriodLabel = `${selectedYear} · ${monthLabelFromOptions(
    selectedMonth,
    monthOptions,
    t("common.messages.month"),
  )}`;
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

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isBootstrapping || isPeriodLoading} />

      <Stack gap={0}>
        <Title order={2} component="h1">{t("budget.title")}</Title>
        <Text size="xs" c="dimmed">
          {t("budget.subtitle")}
        </Text>
      </Stack>

      {!canManageStructure ? (
        <Alert color="yellow" variant="light" py={8}>
          {t("budget.readOnlyMessage", undefined, { role: roleLabel })}
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Text size="xs" c="dimmed" fw={600}>
              {t("budget.editingPeriod")}
            </Text>
            <Badge variant="light" color="blue" size="sm">
              {selectedPeriodLabel}
            </Badge>
          </Group>

          <SimpleGrid cols={isMobile ? 2 : 3} spacing="xs">
            <NativeSelect
              label={t("budget.year")}
              data={yearOptions}
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
              size="xs"
            />
            <NativeSelect
              label={t("budget.month")}
              data={monthOptions}
              value={String(selectedMonth)}
              onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
              size="xs"
            />

            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => void copyFromPreviousMonth()}
              loading={isCopying}
              disabled={!canCopyFromPrevious}
              mt={isMobile ? 0 : "auto"}
            >
              {t("budget.copyPreviousMonth")}
            </Button>
          </SimpleGrid>

          <Text size="xs" c="dimmed">
            {periodHasItems
              ? t("budget.copyDisabledWithExistingData")
              : t("budget.copyHint")}
          </Text>
        </Stack>
      </Paper>

      {categories.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            {t("budget.noActiveCategories")}
          </Text>
        </Paper>
      ) : (
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            {!periodId ? (
              <Alert color="blue" variant="light" py={8}>
                {t("budget.noPeriodYet")}
              </Alert>
            ) : null}

            <Stack gap={2}>
              <Text size="xs" fw={600}>
                {t("budget.editByCategory")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("budget.editByCategoryHint")}
              </Text>
            </Stack>

            {(Object.keys(groupedCategories) as TransactionType[])
              .filter((typeKey) => typeKey !== "transfer")
              .map((typeKey) => (
              <Paper key={typeKey} withBorder radius="md" p="sm">
                <Stack gap="xs">
                  <Group justify="space-between" align="center" wrap="wrap">
                    <Title
                      order={5}
                      c={transactionTypeMantineColor[typeKey]}
                    >
                      {typeLabels[typeKey]}
                    </Title>
                    <Badge
                      variant="light"
                      color={transactionTypeMantineColor[typeKey]}
                      size="sm"
                    >
                      {currencyFormatter.format(totals[typeKey])}
                    </Badge>
                  </Group>
                  {groupedCategories[typeKey].length === 0 ? (
                    <Text size="sm" c="dimmed">
                      {t("budget.noActiveCategoriesForType")}
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {groupedCategories[typeKey].map(({ category, rootLine, subcategoryLines }) => (
                        <Paper key={category.id} withBorder radius="sm" p={isMobile ? 6 : 8}>
                          <Stack gap="xs">
                            <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                              <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                                <Text fw={700} size="sm" lineClamp={1}>
                                  {category.name}
                                </Text>
                                <Button
                                  component={Link}
                                  href={categoryDrilldownHref(typeKey, category.id)}
                                  variant="subtle"
                                  color="gray"
                                  size="compact-xs"
                                  px={0}
                                  justify="flex-start"
                                >
                                  {t("budget.viewMovements")}
                                </Button>
                              </Stack>
                            </Group>

                            <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
                              <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                                <Text fw={600} size="sm" lineClamp={1}>
                                  {t("budget.withoutSubcategory")}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {t("budget.directCategoryHint")}
                                </Text>
                              </Stack>
                              <input
                                type="hidden"
                                {...register(`items.${rootLine.index}.categoryId` as const)}
                              />
                              <input
                                type="hidden"
                                {...register(`items.${rootLine.index}.subcategoryId` as const)}
                              />
                              <Controller
                                name={`items.${rootLine.index}.amount` as const}
                                control={control}
                                render={({ field }) => (
                                  <TextInput
                                    aria-label={t("budget.amountForCategory", undefined, {
                                      categoryName: category.name,
                                    })}
                                    type="text"
                                    inputMode="decimal"
                                    size="sm"
                                    placeholder="0"
                                    value={
                                      typeof field.value === "string"
                                        ? field.value
                                        : typeof field.value === "number"
                                          ? formatBudgetAmount(field.value)
                                          : ""
                                    }
                                    onChange={(event) => {
                                      field.onChange(
                                        sanitizeBudgetTypingValue(event.currentTarget.value),
                                      );
                                    }}
                                    onBlur={(event) => {
                                      const parsed = parseBudgetAmount(event.currentTarget.value);
                                      field.onChange(formatBudgetAmount(parsed ?? 0));
                                      field.onBlur();
                                    }}
                                    onFocus={(event) => {
                                      event.currentTarget.select();
                                    }}
                                    disabled={!canManageStructure}
                                    error={errors.items?.[rootLine.index]?.amount?.message}
                                    rightSection={
                                      <Text size="10px" c="dimmed" fw={500}>
                                        $
                                      </Text>
                                    }
                                    rightSectionWidth={26}
                                    rightSectionPointerEvents="none"
                                    styles={{
                                      input: {
                                        textAlign: "right",
                                        fontVariantNumeric: "tabular-nums",
                                        paddingTop: "0.3rem",
                                        paddingBottom: "0.3rem",
                                      },
                                    }}
                                    style={{ width: isMobile ? 132 : 164 }}
                                  />
                                )}
                              />
                            </Group>

                            {subcategoryLines.length > 0 ? (
                              <Stack gap={6} pl={isMobile ? 10 : 14}>
                                {subcategoryLines.map((line) => (
                                  <Group
                                    key={line.key}
                                    justify="space-between"
                                    align="center"
                                    wrap="nowrap"
                                    gap="xs"
                                  >
                                    <Text size="sm" c="dimmed" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                                      {line.subcategory?.name}
                                    </Text>
                                    <input
                                      type="hidden"
                                      {...register(`items.${line.index}.categoryId` as const)}
                                    />
                                    <input
                                      type="hidden"
                                      {...register(`items.${line.index}.subcategoryId` as const)}
                                    />
                                    <Controller
                                      name={`items.${line.index}.amount` as const}
                                      control={control}
                                      render={({ field }) => (
                                        <TextInput
                                          aria-label={t("budget.amountForSubcategory", undefined, {
                                            categoryName: category.name,
                                            subcategoryName: line.subcategory?.name ?? "",
                                          })}
                                          type="text"
                                          inputMode="decimal"
                                          size="sm"
                                          placeholder="0"
                                          value={
                                            typeof field.value === "string"
                                              ? field.value
                                              : typeof field.value === "number"
                                                ? formatBudgetAmount(field.value)
                                                : ""
                                          }
                                          onChange={(event) => {
                                            field.onChange(
                                              sanitizeBudgetTypingValue(event.currentTarget.value),
                                            );
                                          }}
                                          onBlur={(event) => {
                                            const parsed = parseBudgetAmount(event.currentTarget.value);
                                            field.onChange(formatBudgetAmount(parsed ?? 0));
                                            field.onBlur();
                                          }}
                                          onFocus={(event) => {
                                            event.currentTarget.select();
                                          }}
                                          disabled={!canManageStructure}
                                          error={errors.items?.[line.index]?.amount?.message}
                                          rightSection={
                                            <Text size="10px" c="dimmed" fw={500}>
                                              $
                                            </Text>
                                          }
                                          rightSectionWidth={26}
                                          rightSectionPointerEvents="none"
                                          styles={{
                                            input: {
                                              textAlign: "right",
                                              fontVariantNumeric: "tabular-nums",
                                              paddingTop: "0.3rem",
                                              paddingBottom: "0.3rem",
                                            },
                                          }}
                                          style={{ width: isMobile ? 132 : 164 }}
                                        />
                                      )}
                                    />
                                  </Group>
                                ))}
                              </Stack>
                            ) : null}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            ))}

            <Paper
              withBorder
              radius="lg"
              p="sm"
              style={{
                borderColor:
                  balanceStatus === "balanced"
                    ? "var(--mantine-color-cyan-4)"
                    : balanceStatus === "remaining"
                      ? "var(--mantine-color-yellow-4)"
                      : "var(--mantine-color-pink-4)",
              }}
            >
              <Stack gap="xs">
                <Group justify="space-between" align="center" wrap="wrap">
                  <Stack gap={0}>
                    <Title order={4}>{t("budget.periodResultTitle")}</Title>
                    <Text size="xs" c="dimmed">
                      {t("budget.periodSummary", undefined, {
                        monthYear: `${monthLabelFromOptions(
                          selectedMonth,
                          monthOptions,
                          t("common.messages.month"),
                        )} ${selectedYear}`,
                      })}
                    </Text>
                  </Stack>
                  <Badge
                    color={
                      balanceStatus === "balanced"
                        ? "cyan"
                        : balanceStatus === "remaining"
                          ? "yellow"
                          : "pink"
                    }
                    variant="filled"
                    size="sm"
                  >
                    {balanceStatus === "balanced"
                      ? t("budget.balanceStatus.balanced")
                      : balanceStatus === "remaining"
                        ? t("budget.balanceStatus.remaining")
                        : t("budget.balanceStatus.overassigned")}
                  </Badge>
                </Group>

                <SimpleGrid cols={3} spacing="xs">
                  <Paper withBorder radius="sm" p={6}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {mapTransactionTypeLabel("income", t, { plural: true })}
                    </Text>
                    <Text mt={1} fw={700} size="sm" c={transactionTypeColorShade("income", 7)}>
                      {currencyFormatter.format(totals.income)}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="sm" p={6}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {mapTransactionTypeLabel("expense", t, { plural: true })}
                    </Text>
                    <Text mt={1} fw={700} size="sm" c={transactionTypeColorShade("expense", 7)}>
                      {currencyFormatter.format(totals.expense)}
                    </Text>
                  </Paper>
                  <Paper withBorder radius="sm" p={6}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {mapTransactionTypeLabel("saving", t, { plural: true })}
                    </Text>
                    <Text mt={1} fw={700} size="sm" c={transactionTypeColorShade("saving", 7)}>
                      {currencyFormatter.format(totals.saving)}
                    </Text>
                  </Paper>
                </SimpleGrid>

                <Paper withBorder radius="md" p="xs">
                  <Group justify="space-between" align="center">
                    <Text fw={600} size="sm">
                      {t("budget.assignedTotal")}
                    </Text>
                    <Text fw={700} size="sm">
                      {currencyFormatter.format(totals.assigned)}
                    </Text>
                  </Group>
                </Paper>

                <Paper
                  withBorder
                  radius="md"
                  p="xs"
                  style={{
                    backgroundColor:
                      balanceStatus === "balanced"
                        ? "var(--mantine-color-cyan-0)"
                        : balanceStatus === "remaining"
                          ? "var(--mantine-color-yellow-0)"
                          : "var(--mantine-color-pink-0)",
                  }}
                >
                  <Group justify="space-between" align="center">
                    <Text fw={700} size="sm">
                      {t("budget.finalBalance")}
                    </Text>
                    <Text
                      fw={900}
                      size={isMobile ? "lg" : "xl"}
                      c={
                        balanceStatus === "balanced"
                          ? "cyan.7"
                          : balanceStatus === "remaining"
                            ? "yellow.8"
                            : "pink.7"
                      }
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {currencyFormatter.format(roundedBalance)}
                    </Text>
                  </Group>
                </Paper>

                <Alert
                  mt={1}
                  py={6}
                  color={
                    balanceStatus === "balanced"
                      ? "cyan"
                      : balanceStatus === "remaining"
                        ? "yellow"
                        : "red"
                  }
                  variant={balanceStatus === "overassigned" ? "filled" : "light"}
                >
                  <Text size="xs">
                    {isBalanced
                      ? t("budget.balanceMessage.balanced")
                      : roundedBalance > 0
                        ? t("budget.balanceMessage.remaining", undefined, {
                            amount: formattedBalanceAbsolute,
                          })
                        : t("budget.balanceMessage.overassigned", undefined, {
                            amount: formattedBalanceAbsolute,
                          })}
                  </Text>
                </Alert>
              </Stack>
            </Paper>

            <Paper
              withBorder
              radius="md"
              p="sm"
              style={
                isMobile && isDirty
                  ? {
                      position: "sticky",
                      bottom: 0,
                      zIndex: 20,
                      backgroundColor: "var(--mantine-color-body)",
                      boxShadow: "0 -8px 18px rgba(0, 0, 0, 0.06)",
                      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
                    }
                  : undefined
              }
            >
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  {t("budget.confirmChanges")}
                </Text>
                <Group justify="flex-end" grow={isMobile}>
                  <Button
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => void loadSelectedPeriod()}
                    disabled={isSaving || isCopying}
                  >
                    {t("budget.revert")}
                  </Button>
                  <Button
                    type="submit"
                    loading={isSaving}
                    disabled={!canManageStructure || isCopying}
                    size="sm"
                  >
                    {t("budget.saveBudget")}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
