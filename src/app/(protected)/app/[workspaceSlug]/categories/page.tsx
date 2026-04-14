"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  ActionIcon,
  Button,
  Group,
  LoadingOverlay,
  Menu,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useForm, useWatch } from "react-hook-form";

import {
  categoryExpenseBehaviorOptions,
  createCategoryFormSchema,
  type CategoryFormInputValues,
  type CategoryFormValues,
} from "@/features/categories/schema";
import { localeCompareByName, mapTransactionTypeLabel } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { transactionTypeColorCssVar } from "@/features/transactions/type-colors";
import { canManageCategories } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, ExpenseBehavior, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type CategoryUsageLiteRow = Pick<Database["public"]["Tables"]["transactions"]["Row"], "category_id">;

type TypeFilter = TransactionType | "all";
type StatusFilter = "all" | "active" | "inactive";
type GroupedCategoryRows = {
  type: TransactionType;
  label: string;
  rows: CategoryRow[];
};

const categoryTypeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
};

const categoryTypeSectionOrder: TransactionType[] = ["income", "expense", "saving"];

const categoryGroupBackgroundColor: Record<TransactionType, string> = {
  expense: transactionTypeColorCssVar("expense", 0),
  income: transactionTypeColorCssVar("income", 0),
  saving: transactionTypeColorCssVar("saving", 0),
};

const categoryGroupHeaderColor: Record<TransactionType, string> = {
  expense: transactionTypeColorCssVar("expense", 6),
  income: transactionTypeColorCssVar("income", 6),
  saving: transactionTypeColorCssVar("saving", 6),
};

const categoryGroupBorderColor: Record<TransactionType, string> = {
  expense: transactionTypeColorCssVar("expense", 4),
  income: transactionTypeColorCssVar("income", 4),
  saving: transactionTypeColorCssVar("saving", 4),
};

function normalizeSearchText(value: string, locale: "es" | "en") {
  return value.trim().toLocaleLowerCase(locale === "en" ? "en" : "es");
}

function sortCategories(a: CategoryRow, b: CategoryRow, locale: "es" | "en") {
  const typeDiff = categoryTypeOrder[a.type] - categoryTypeOrder[b.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return localeCompareByName(a.name, b.name, locale);
}

function toCategoryDefaults(row?: CategoryRow): CategoryFormValues {
  if (!row) {
    return {
      name: "",
      type: "expense",
      expenseBehavior: "variable",
      sortOrder: null,
    };
  }

  return {
    name: row.name,
    type: row.type,
    expenseBehavior: row.type === "expense" ? (row.expense_behavior ?? "variable") : null,
    sortOrder: row.sort_order,
  };
}

function DotsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function EditIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function ToggleActiveIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2v10" />
      <path d="M18.36 5.64a9 9 0 1 1-12.72 0" />
    </svg>
  );
}

export default function CategoriesPage() {
  const { supabase, workspace, user } = useWorkspace();
  const { locale, t } = useI18n();
  const canManageStructure = canManageCategories(workspace.role);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [usageByCategoryId, setUsageByCategoryId] = useState<Record<string, number>>({});
  const [hasUsageData, setHasUsageData] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const roleLabel = t(`common.role.${workspace.role}`, workspace.role);
  const categoryTypeLabels = useMemo<Record<TransactionType, string>>(
    () => ({
      income: mapTransactionTypeLabel("income", t),
      expense: mapTransactionTypeLabel("expense", t),
      saving: mapTransactionTypeLabel("saving", t),
    }),
    [t],
  );
  const categoryTypeSectionLabels = useMemo<Record<TransactionType, string>>(
    () => ({
      expense: mapTransactionTypeLabel("expense", t, { plural: true }),
      income: mapTransactionTypeLabel("income", t, { plural: true }),
      saving: mapTransactionTypeLabel("saving", t, { plural: true }),
    }),
    [t],
  );
  const categoryTypeSelectData = useMemo(
    () => [
      { value: "income", label: mapTransactionTypeLabel("income", t) },
      { value: "expense", label: mapTransactionTypeLabel("expense", t) },
      { value: "saving", label: mapTransactionTypeLabel("saving", t) },
    ],
    [t],
  );
  const categoryExpenseBehaviorLabels = useMemo<Record<ExpenseBehavior, string>>(
    () => ({
      fixed: t("common.domain.expenseBehavior.fixed"),
      variable: t("common.domain.expenseBehavior.variable"),
    }),
    [t],
  );
  const categoryExpenseBehaviorSelectData = useMemo(
    () =>
      categoryExpenseBehaviorOptions.map((value) => ({
        value,
        label: categoryExpenseBehaviorLabels[value],
      })),
    [categoryExpenseBehaviorLabels],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormInputValues, unknown, CategoryFormValues>({
    resolver: zodResolver(
      createCategoryFormSchema({
        integerNumber: t("common.validation.integerNumber"),
        nonNegative: t("common.validation.nonNegative"),
        requiredName: t("common.validation.requiredName"),
        maxNameLength: t("common.validation.maxName80"),
        requiredExpenseBehavior: t("common.forms.category.requiredExpenseBehavior"),
      }),
    ),
    defaultValues: toCategoryDefaults(),
  });
  const selectedType = useWatch({ control, name: "type" });

  const loadRows = useCallback(async () => {
    setIsLoading(true);

    const [categoriesResponse, usageResponse] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("transactions")
        .select("category_id")
        .eq("workspace_id", workspace.id),
    ]);
    setIsLoading(false);

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("categories.notifications.loadError"),
        message: categoriesResponse.error.message,
      });
      setRows([]);
      setUsageByCategoryId({});
      return;
    }

    const sorted = [...categoriesResponse.data].sort((a, b) => sortCategories(a, b, locale));
    const usageCounter: Record<string, number> = {};

    if (usageResponse.error) {
      setHasUsageData(false);
    } else {
      const usageRows = (usageResponse.data ?? []) as CategoryUsageLiteRow[];
      for (const usageRow of usageRows) {
        usageCounter[usageRow.category_id] = (usageCounter[usageRow.category_id] ?? 0) + 1;
      }
      setHasUsageData(true);
    }

    setRows(sorted);
    setUsageByCategoryId(usageCounter);
  }, [locale, supabase, t, workspace.id]);

  const showPermissionDenied = useCallback(() => {
    notifications.show({
      color: "red",
      title: t("categories.notifications.permissionDeniedTitle"),
      message: t("categories.notifications.permissionDeniedMessage"),
    });
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  function openCreateModal() {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(null);
    reset(toCategoryDefaults());
    setIsModalOpen(true);
  }

  function openEditModal(row: CategoryRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(row);
    reset(toCategoryDefaults(row));
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    reset(toCategoryDefaults());
  }

  const normalizedSearchFilter = useMemo(
    () => normalizeSearchText(searchFilter, locale),
    [locale, searchFilter],
  );

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const passesType = typeFilter === "all" ? true : row.type === typeFilter;
      const passesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? row.is_active
            : !row.is_active;
      const passesSearch =
        normalizedSearchFilter === ""
          ? true
          : `${row.name} ${categoryTypeLabels[row.type]} ${
              row.is_active ? t("categories.status.active") : t("categories.status.inactive")
            } ${
              row.type === "expense"
                ? categoryExpenseBehaviorLabels[row.expense_behavior ?? "variable"]
                : ""
            }`
              .toLocaleLowerCase(locale === "en" ? "en" : "es")
              .includes(normalizedSearchFilter);

      return passesType && passesStatus && passesSearch;
    });
  }, [
    categoryExpenseBehaviorLabels,
    categoryTypeLabels,
    locale,
    normalizedSearchFilter,
    rows,
    statusFilter,
    t,
    typeFilter,
  ]);

  const groupedRows = useMemo<GroupedCategoryRows[]>(() => {
    const grouped: Record<TransactionType, CategoryRow[]> = {
      income: [],
      expense: [],
      saving: [],
    };

    for (const row of visibleRows) {
      grouped[row.type].push(row);
    }

    return categoryTypeSectionOrder
      .map((type) => ({
        type,
        label: categoryTypeSectionLabels[type],
        rows: grouped[type],
      }))
      .filter((group) => group.rows.length > 0);
  }, [categoryTypeSectionLabels, visibleRows]);

  const activeFiltersCount =
    Number(typeFilter !== "all") +
    Number(statusFilter !== "all") +
    Number(normalizedSearchFilter !== "");
  const categoryDrilldownHref = useCallback(
    (type: TransactionType, categoryId: string) =>
      buildTransactionsDrilldownHref({
        workspaceSlug: workspace.slug,
        type,
        categoryId,
      }),
    [workspace.slug],
  );

  const onSubmit = handleSubmit(async (values) => {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    const expenseBehavior = values.type === "expense" ? values.expenseBehavior : null;
    const payload = {
      name: values.name.trim(),
      type: values.type,
      expense_behavior: expenseBehavior,
      sort_order: values.sortOrder,
      updated_at: new Date().toISOString(),
    };

    if (editingRow) {
      const updateResponse = await supabase
        .from("categories")
        .update(payload)
        .eq("id", editingRow.id)
        .eq("workspace_id", workspace.id);

      if (updateResponse.error) {
        notifications.show({
          color: "red",
          title: t("categories.notifications.saveError"),
          message: updateResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("categories.notifications.updatedTitle"),
        message: t("categories.notifications.updatedMessage"),
      });
    } else {
      const insertResponse = await supabase.from("categories").insert({
        workspace_id: workspace.id,
        name: payload.name,
        type: payload.type,
        expense_behavior: payload.expense_behavior,
        sort_order: payload.sort_order,
        is_active: true,
        created_by: user.id,
      });

      if (insertResponse.error) {
        const isDuplicatedName = insertResponse.error.code === "23505";
        notifications.show({
          color: "red",
          title: t("categories.notifications.createError"),
          message: isDuplicatedName
            ? t("categories.notifications.duplicateName")
            : insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "cyan",
        title: t("categories.notifications.createdTitle"),
        message: t("categories.notifications.createdMessage"),
      });
    }

    closeModal();
    await loadRows();
  });

  async function toggleActive(row: CategoryRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    const response = await supabase
      .from("categories")
      .update({
        is_active: !row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("workspace_id", workspace.id);

    if (response.error) {
      notifications.show({
        color: "red",
        title: t("categories.notifications.toggleError"),
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "cyan",
      title: row.is_active
        ? t("categories.notifications.deactivatedTitle")
        : t("categories.notifications.activatedTitle"),
      message: t("categories.notifications.statusUpdatedMessage"),
    });

    setIsLoading(true);
    await loadRows();
  }

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Group justify="space-between" align="end" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={2} component="h1">{t("categories.title")}</Title>
          <Text c="dimmed" size="sm">
            {t("categories.subtitle")}
          </Text>
        </Stack>

        <Button
          onClick={openCreateModal}
          disabled={!canManageStructure}
          fullWidth={isMobile}
          radius="md"
          styles={{ root: { boxShadow: "none", border: "none" } }}
        >
          {t("categories.new")}
        </Button>
      </Group>

      {!canManageStructure ? (
        <Alert color="yellow" variant="light" title={t("categories.readOnlyTitle")}>
          {t("categories.readOnlyMessage", undefined, { role: roleLabel })}
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group align="end" wrap="wrap" gap="xs">
            <NativeSelect
              label={t("categories.filters.type")}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
              data={[
                { value: "all", label: t("categories.filters.all") },
                ...categoryTypeSelectData,
              ]}
              style={{ minWidth: 140 }}
            />

            <NativeSelect
              label={t("categories.filters.status")}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
              data={[
                { value: "all", label: t("categories.filters.all") },
                { value: "active", label: t("categories.filters.active") },
                { value: "inactive", label: t("categories.filters.inactive") },
              ]}
              style={{ minWidth: 140 }}
            />

            <TextInput
              label={t("categories.filters.search")}
              placeholder={t("categories.filters.searchPlaceholder")}
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.currentTarget.value)}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            />
          </Group>

          <Text size="xs" c="dimmed">
            {t("categories.summary", undefined, {
              count: visibleRows.length,
              pluralSuffix: visibleRows.length === 1 ? "" : "s",
              filtersText:
                activeFiltersCount > 0
                  ? t("categories.activeFiltersText", undefined, {
                      count: activeFiltersCount,
                      pluralSuffix: activeFiltersCount === 1 ? "" : "s",
                    })
                  : "",
            })}
          </Text>
        </Stack>
      </Paper>

      {groupedRows.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            {t("categories.emptyState")}
          </Text>
        </Paper>
      ) : (
        <Stack gap="md">
          {groupedRows.map((group) => {
            const activeRows = group.rows.filter((row) => row.is_active).length;
            const groupBackground = categoryGroupBackgroundColor[group.type];
            const groupHeaderColor = categoryGroupHeaderColor[group.type];
            const groupBorderColor = categoryGroupBorderColor[group.type];

            return (
              <Paper
                key={group.type}
                withBorder
                radius="md"
                p="sm"
                style={{
                  backgroundColor: groupBackground,
                  borderLeft: `3px solid ${groupBorderColor}`,
                }}
              >
                <Stack gap="xs">
                  <Stack gap={1}>
                    <Text
                      size="xs"
                      fw={800}
                      tt="uppercase"
                      style={{ letterSpacing: "0.04em", lineHeight: 1.2, color: groupHeaderColor }}
                    >
                      {group.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t("categories.groupSummary", undefined, {
                        total: group.rows.length,
                        totalPluralSuffix: group.rows.length === 1 ? "" : "s",
                        active: activeRows,
                        activePluralSuffix: activeRows === 1 ? "" : "s",
                      })}
                    </Text>
                  </Stack>

                  <Stack gap={6}>
                    {group.rows.map((row) => {
                      const usageCount = usageByCategoryId[row.id] ?? 0;
                      const usageLabel =
                        usageCount === 0
                          ? t("categories.usage.none")
                          : t("categories.usage.count", undefined, {
                              count: usageCount,
                              pluralSuffix: usageCount === 1 ? "" : "s",
                            });

                      return (
                        <Paper key={row.id} withBorder radius={8} p={isMobile ? "xs" : "sm"}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
                            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                              <Text fw={600} size="sm" lineClamp={1} style={{ lineHeight: 1.2 }}>
                                {row.name}
                              </Text>

                              {hasUsageData ? (
                                <Text size="11px" c="dimmed" lineClamp={1}>
                                  {usageLabel}
                                </Text>
                              ) : null}

                              {hasUsageData && usageCount > 0 ? (
                                <Button
                                  component={Link}
                                  href={categoryDrilldownHref(row.type, row.id)}
                                  variant="subtle"
                                  color="gray"
                                  size="compact-xs"
                                  px={0}
                                  justify="flex-start"
                                >
                                  {t("categories.viewMovements")}
                                </Button>
                              ) : null}

                              <Text
                                size="10px"
                                c={row.is_active ? "gray.6" : "gray.7"}
                                fw={500}
                                tt="uppercase"
                                style={{ letterSpacing: "0.03em" }}
                              >
                                {row.is_active
                                  ? t("categories.status.active")
                                  : t("categories.status.inactive")}
                              </Text>

                              {row.type === "expense" ? (
                                <Text
                                  size="10px"
                                  c="gray.7"
                                  fw={500}
                                  tt="uppercase"
                                  style={{ letterSpacing: "0.03em" }}
                                >
                                  {categoryExpenseBehaviorLabels[row.expense_behavior ?? "variable"]}
                                </Text>
                              ) : null}
                            </Stack>

                            <Menu position="bottom-end" withArrow>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label={t("categories.actionsFor", undefined, { name: row.name })}
                                >
                                  <DotsIcon />
                                </ActionIcon>
                              </Menu.Target>

                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<EditIcon size={13} />}
                                  disabled={!canManageStructure}
                                  onClick={() => openEditModal(row)}
                                >
                                  {t("categories.edit")}
                                </Menu.Item>
                                <Menu.Item
                                  color={row.is_active ? "gray" : "cyan"}
                                  leftSection={<ToggleActiveIcon size={13} />}
                                  disabled={!canManageStructure}
                                  onClick={() => void toggleActive(row)}
                                >
                                  {row.is_active ? t("categories.deactivate") : t("categories.activate")}
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      )}

      <Modal
        opened={isModalOpen}
        onClose={closeModal}
        title={editingRow ? t("categories.edit") : t("categories.new")}
        fullScreen={isMobile}
      >
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label={t("categories.form.name")}
              placeholder={t("categories.form.namePlaceholder")}
              autoFocus
              disabled={!canManageStructure}
              error={errors.name?.message}
              {...register("name")}
            />

            <NativeSelect
              label={t("categories.filters.type")}
              data={categoryTypeSelectData}
              disabled={!canManageStructure}
              error={errors.type?.message}
              {...register("type")}
            />

            {selectedType === "expense" ? (
              <NativeSelect
                label={t("categories.form.expenseBehavior")}
                description={t("categories.form.expenseBehaviorDescription")}
                data={categoryExpenseBehaviorSelectData}
                disabled={!canManageStructure}
                error={errors.expenseBehavior?.message}
                {...register("expenseBehavior")}
              />
            ) : null}

            <Paper withBorder radius="md" p="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={600}>
                  {t("categories.form.optionalConfiguration")}
                </Text>
                <TextInput
                  label={t("categories.form.sortOrder")}
                  description={t("categories.form.sortOrderDescription")}
                  placeholder="0"
                  type="number"
                  disabled={!canManageStructure}
                  error={errors.sortOrder?.message}
                  {...register("sortOrder")}
                />
              </Stack>
            </Paper>

            <Group justify="flex-end" mt="sm">
              <Button
                type="button"
                variant="light"
                color="gray"
                onClick={closeModal}
              >
                {t("common.actions.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={!canManageStructure}>
                {editingRow ? t("common.actions.save") : t("common.actions.create")}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
