"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Group,
  LoadingOverlay,
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
  sortSubcategories,
} from "@/features/categories/subcategories";
import {
  categoryExpenseBehaviorOptions,
  createCategoryFormSchema,
  type CategoryFormInputValues,
  type CategoryFormValues,
} from "@/features/categories/schema";
import { CategoriesInsight } from "@/features/categories/components/categories-insight";
import {
  CategoriesList,
  type GroupedCategoryRows,
} from "@/features/categories/components/categories-list";
import { localeCompareByName, mapTransactionTypeLabel } from "@/features/i18n/formatting";
import { useI18n } from "@/features/i18n/provider";
import { buildTransactionsDrilldownHref } from "@/features/transactions/drilldown";
import { canManageCategories } from "@/features/workspace/permissions";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { CategorySource, Database, ExpenseBehavior, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type SubcategoryRow = Database["public"]["Tables"]["category_subcategories"]["Row"];
type CategoryUsageLiteRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "category_id" | "subcategory_id"
>;

type TypeFilter = TransactionType | "all";
type StatusFilter = "all" | "active" | "inactive";
type SourceFilter = CategorySource | "all";

const categoryTypeOrder: Record<TransactionType, number> = {
  income: 0,
  expense: 1,
  saving: 2,
  transfer: 3,
};

const categoryTypeSectionOrder: TransactionType[] = ["income", "expense", "saving"];

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
      parentCategoryId: null,
      type: "expense",
      expenseBehavior: "variable",
    };
  }

  return {
    name: row.name,
    parentCategoryId: null,
    type: row.type === "transfer" ? "expense" : row.type,
    expenseBehavior: row.type === "expense" ? (row.expense_behavior ?? "variable") : null,
  };
}

function toSubcategoryDefaults(parentCategoryId?: string, row?: SubcategoryRow): CategoryFormValues {
  return {
    name: row?.name ?? "",
    parentCategoryId: row?.category_id ?? parentCategoryId ?? null,
    type: "expense",
    expenseBehavior: null,
  };
}

export default function CategoriesPage() {
  const { supabase, workspace, user } = useWorkspace();
  const { locale, t } = useI18n();
  const canManageStructure = canManageCategories(workspace.role);
  const isMobile = useMediaQuery("(max-width: 47.99em)");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [subcategoryRows, setSubcategoryRows] = useState<SubcategoryRow[]>([]);
  const [usageByCategoryId, setUsageByCategoryId] = useState<Record<string, number>>({});
  const [usageBySubcategoryId, setUsageBySubcategoryId] = useState<Record<string, number>>({});
  const [hasUsageData, setHasUsageData] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryRow | null>(null);
  const [editingSubcategoryRow, setEditingSubcategoryRow] = useState<SubcategoryRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const roleLabel = t(`common.role.${workspace.role}`, workspace.role);
  const categoryTypeLabels = useMemo<Record<TransactionType, string>>(
    () => ({
      income: mapTransactionTypeLabel("income", t),
      expense: mapTransactionTypeLabel("expense", t),
      saving: mapTransactionTypeLabel("saving", t),
      transfer: mapTransactionTypeLabel("transfer", t),
    }),
    [t],
  );
  const categoryTypeSectionLabels = useMemo<Record<TransactionType, string>>(
    () => ({
      expense: mapTransactionTypeLabel("expense", t, { plural: true }),
      income: mapTransactionTypeLabel("income", t, { plural: true }),
      saving: mapTransactionTypeLabel("saving", t, { plural: true }),
      transfer: mapTransactionTypeLabel("transfer", t, { plural: true }),
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
  const categorySourceLabels = useMemo<Record<CategorySource, string>>(
    () => ({
      system: t("categories.source.system"),
      custom: t("categories.source.custom"),
    }),
    [t],
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
        requiredName: t("common.validation.requiredName"),
        maxNameLength: t("common.validation.maxName80"),
        requiredExpenseBehavior: t("common.forms.category.requiredExpenseBehavior"),
        invalidParentCategory: t("common.validation.invalidOption"),
      }),
    ),
    defaultValues: toCategoryDefaults(),
  });
  const selectedType = useWatch({ control, name: "type" });
  const selectedParentCategoryId = useWatch({ control, name: "parentCategoryId" }) as string | null;
  const categoryById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const isSubcategoryMode = editingSubcategoryRow !== null || selectedParentCategoryId !== null;
  const selectedParentCategory = selectedParentCategoryId
    ? categoryById.get(selectedParentCategoryId) ?? null
    : null;
  const subcategoryParentOptions = useMemo(
    () =>
      rows
        .filter((row) => row.type !== "transfer")
        .map((row) => ({
          value: row.id,
          label: row.is_active ? row.name : `${row.name} (${t("categories.status.inactive")})`,
        })),
    [rows, t],
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);

    const categoriesResponse = await supabase
      .from("categories")
      .select("id, name, type, source, is_active, is_exceptional, sort_order, expense_behavior")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    const subcategoriesResponse = await supabase
      .from("category_subcategories")
      .select("id, workspace_id, category_id, name, is_active, sort_order, created_by, created_at, updated_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    const usageResponse = await supabase
      .from("transactions")
      .select("category_id, subcategory_id")
      .eq("workspace_id", workspace.id);
    setIsLoading(false);

    if (categoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("categories.notifications.loadError"),
        message: categoriesResponse.error.message,
      });
      setRows([]);
      setSubcategoryRows([]);
      setUsageByCategoryId({});
      setUsageBySubcategoryId({});
      return;
    }

    const sorted = ([...(categoriesResponse.data ?? [])] as CategoryRow[]).sort((a, b) =>
      sortCategories(a, b, locale),
    );
    const usageCounter: Record<string, number> = {};
    const subcategoryUsageCounter: Record<string, number> = {};

    if (subcategoriesResponse.error) {
      notifications.show({
        color: "red",
        title: t("categories.notifications.loadSubcategoriesError"),
        message: subcategoriesResponse.error.message,
      });
      setSubcategoryRows([]);
    } else {
      const sortedSubcategoryRows = ([...(subcategoriesResponse.data ?? [])] as SubcategoryRow[]).sort(
        (a, b) => sortSubcategories(a, b, locale),
      );
      setSubcategoryRows(sortedSubcategoryRows);
    }

    if (usageResponse.error) {
      setHasUsageData(false);
    } else {
      const usageRows = (usageResponse.data ?? []) as CategoryUsageLiteRow[];
      for (const usageRow of usageRows) {
        usageCounter[usageRow.category_id] = (usageCounter[usageRow.category_id] ?? 0) + 1;
        if (usageRow.subcategory_id) {
          subcategoryUsageCounter[usageRow.subcategory_id] =
            (subcategoryUsageCounter[usageRow.subcategory_id] ?? 0) + 1;
        }
      }
      setHasUsageData(true);
    }

    setRows(sorted);
    setUsageByCategoryId(usageCounter);
    setUsageBySubcategoryId(subcategoryUsageCounter);
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
    setEditingSubcategoryRow(null);
    reset(toCategoryDefaults());
    setIsModalOpen(true);
  }

  function openCreateSubcategoryModal(parentCategoryId?: string) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(null);
    setEditingSubcategoryRow(null);
    reset(toSubcategoryDefaults(parentCategoryId));
    setIsModalOpen(true);
  }

  function openEditModal(row: CategoryRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(row);
    setEditingSubcategoryRow(null);
    reset(toCategoryDefaults(row));
    setIsModalOpen(true);
  }

  function openEditSubcategoryModal(row: SubcategoryRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    setEditingRow(null);
    setEditingSubcategoryRow(row);
    reset(toSubcategoryDefaults(undefined, row));
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    setEditingSubcategoryRow(null);
    reset(toCategoryDefaults());
  }

  const normalizedSearchFilter = useMemo(
    () => normalizeSearchText(searchFilter, locale),
    [locale, searchFilter],
  );

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const passesType = typeFilter === "all" ? true : row.type === typeFilter;
      const passesSource = sourceFilter === "all" ? true : row.source === sourceFilter;
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
            } ${categorySourceLabels[row.source]} ${
              row.is_exceptional ? t("categories.exceptional.label") : ""
            } ${row.warning_message ?? ""}`
              .toLocaleLowerCase(locale === "en" ? "en" : "es")
              .includes(normalizedSearchFilter);

      return passesType && passesSource && passesStatus && passesSearch;
    });
  }, [
    categoryExpenseBehaviorLabels,
    categorySourceLabels,
    categoryTypeLabels,
    locale,
    normalizedSearchFilter,
    rows,
    sourceFilter,
    statusFilter,
    t,
    typeFilter,
  ]);

  const groupedRows = useMemo<GroupedCategoryRows[]>(() => {
    const grouped: Record<TransactionType, CategoryRow[]> = {
      income: [],
      expense: [],
      saving: [],
      transfer: [],
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
    Number(sourceFilter !== "all") +
    Number(statusFilter !== "all") +
    Number(normalizedSearchFilter !== "");
  const unusedVisibleCount = useMemo(
    () => visibleRows.filter((row) => (usageByCategoryId[row.id] ?? 0) === 0).length,
    [usageByCategoryId, visibleRows],
  );
  const insightMessage = useMemo(() => {
    if (visibleRows.length === 0) {
      return t("categories.insight.empty");
    }

    if (unusedVisibleCount === 0) {
      return t("categories.insight.noUnused");
    }

    return activeFiltersCount > 0
      ? t("categories.insight.filteredUnused", undefined, {
          count: unusedVisibleCount,
          total: visibleRows.length,
        })
      : t("categories.insight.unused", undefined, {
          count: unusedVisibleCount,
        });
  }, [activeFiltersCount, t, unusedVisibleCount, visibleRows.length]);
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

    if (values.parentCategoryId) {
      const parentCategory = categoryById.get(values.parentCategoryId);
      if (!parentCategory) {
        notifications.show({
          color: "red",
          title: t("categories.notifications.createError"),
          message: t("categories.notifications.invalidParentCategory"),
        });
        return;
      }

      if (editingSubcategoryRow) {
        const updateResponse = await supabase
          .from("category_subcategories")
          .update({
            name: values.name.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSubcategoryRow.id)
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
          message: t("categories.notifications.subcategoryUpdatedMessage"),
        });
      } else {
        const insertResponse = await supabase.from("category_subcategories").insert({
          workspace_id: workspace.id,
          category_id: values.parentCategoryId,
          name: values.name.trim(),
          is_active: true,
          created_by: user.id,
        });

        if (insertResponse.error) {
          const isDuplicatedName = insertResponse.error.code === "23505";
          notifications.show({
            color: "red",
            title: t("categories.notifications.createError"),
            message: isDuplicatedName
              ? t("categories.notifications.duplicateSubcategoryName")
              : insertResponse.error.message,
          });
          return;
        }

        notifications.show({
          color: "cyan",
          title: t("categories.notifications.createdTitle"),
          message: t("categories.notifications.subcategoryCreatedMessage", undefined, {
            categoryName: parentCategory.name,
          }),
        });
      }

      closeModal();
      await loadRows();
      return;
    }

    const categoryType =
      editingRow && editingRow.source === "system" ? editingRow.type : values.type;
    const categoryName =
      editingRow && editingRow.source === "system" ? editingRow.name : values.name.trim();
    const expenseBehavior = categoryType === "expense" ? values.expenseBehavior : null;
    const payload = {
      name: categoryName,
      type: categoryType,
      expense_behavior: expenseBehavior,
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
        source: "custom",
        system_category_id: null,
        expense_behavior: payload.expense_behavior,
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

    if (row.is_exceptional) {
      notifications.show({
        color: "yellow",
        title: t("categories.notifications.exceptionalToggleDeniedTitle"),
        message: t("categories.notifications.exceptionalToggleDeniedMessage"),
      });
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

  async function toggleSubcategoryActive(row: SubcategoryRow) {
    if (!canManageStructure) {
      showPermissionDenied();
      return;
    }

    const response = await supabase
      .from("category_subcategories")
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
      message: t("categories.notifications.subcategoryStatusUpdatedMessage"),
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

            <NativeSelect
              label={t("categories.filters.source")}
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.currentTarget.value as SourceFilter)}
              data={[
                { value: "all", label: t("categories.filters.all") },
                { value: "system", label: categorySourceLabels.system },
                { value: "custom", label: categorySourceLabels.custom },
              ]}
              style={{ minWidth: 160 }}
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

      <CategoriesInsight message={insightMessage} />

      {groupedRows.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            {t("categories.emptyState")}
          </Text>
        </Paper>
      ) : (
        <CategoriesList
          canManageStructure={canManageStructure}
          categoryDrilldownHref={categoryDrilldownHref}
          categoryExpenseBehaviorLabels={categoryExpenseBehaviorLabels}
          categorySourceLabels={categorySourceLabels}
          groupedRows={groupedRows}
          hasUsageData={hasUsageData}
          isMobile={Boolean(isMobile)}
          metaLabels={{
            active: t("categories.status.active"),
            exceptional: t("categories.exceptional.label"),
            inactive: t("categories.status.inactive"),
          }}
          onEdit={openEditModal}
          onEditSubcategory={openEditSubcategoryModal}
          onCreateSubcategory={openCreateSubcategoryModal}
          onToggleActive={toggleActive}
          onToggleSubcategoryActive={toggleSubcategoryActive}
          subcategories={subcategoryRows}
          tableLabels={{
            actions: t("categories.table.actions"),
            groupSummary: (total, active) =>
              t("categories.groupSummary", undefined, {
                total,
                totalPluralSuffix: total === 1 ? "" : "s",
                active,
                activePluralSuffix: active === 1 ? "" : "s",
              }),
            movements: t("categories.table.movements"),
            name: t("categories.table.name"),
            status: t("categories.table.status"),
            type: t("categories.table.type"),
          }}
          toggleLabels={{
            activate: t("categories.activate"),
            deactivate: t("categories.deactivate"),
            edit: t("categories.edit"),
          }}
          usageByCategoryId={usageByCategoryId}
          usageBySubcategoryId={usageBySubcategoryId}
          usageLabels={{
            count: (count) =>
              count === 0
                ? t("categories.usage.none")
                : t("categories.usage.count", undefined, {
                    count,
                    pluralSuffix: count === 1 ? "" : "s",
                  }),
            none: t("categories.usage.none"),
            newSubcategory: t("categories.newSubcategory"),
            withoutSubcategory: t("categories.withoutSubcategory"),
            viewMovements: t("categories.viewMovements"),
          }}
        />
      )}

      <Modal
        opened={isModalOpen}
        onClose={closeModal}
        title={
          editingSubcategoryRow
            ? t("categories.editSubcategory")
            : isSubcategoryMode
              ? t("categories.newSubcategory")
              : editingRow
                ? t("categories.edit")
                : t("categories.new")
        }
        fullScreen={isMobile}
      >
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label={t("categories.form.name")}
              placeholder={t("categories.form.namePlaceholder")}
              autoFocus
              disabled={!canManageStructure}
              readOnly={editingRow?.source === "system"}
              error={errors.name?.message}
              {...register("name")}
            />

            {editingRow?.source === "system" ? (
              <Text size="xs" c="dimmed">
                {t("categories.form.systemNameLocked")}
              </Text>
            ) : null}

            {isSubcategoryMode ? (
              <>
                <NativeSelect
                  label={t("categories.form.parentCategory")}
                  data={subcategoryParentOptions}
                  disabled={!canManageStructure || editingSubcategoryRow !== null}
                  error={errors.parentCategoryId?.message}
                  {...register("parentCategoryId")}
                />

                {selectedParentCategory ? (
                  <Text size="xs" c="dimmed">
                    {t("categories.form.inheritsParentType", undefined, {
                      type: categoryTypeLabels[selectedParentCategory.type],
                    })}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <NativeSelect
                  label={t("categories.filters.type")}
                  data={categoryTypeSelectData}
                  disabled={!canManageStructure || editingRow?.source === "system"}
                  error={errors.type?.message}
                  {...register("type")}
                />

                {editingRow?.source === "system" ? (
                  <Text size="xs" c="dimmed">
                    {t("categories.form.systemTypeLocked")}
                  </Text>
                ) : null}
              </>
            )}

            {!isSubcategoryMode && selectedType === "expense" ? (
              <NativeSelect
                label={t("categories.form.expenseBehavior")}
                description={t("categories.form.expenseBehaviorDescription")}
                data={categoryExpenseBehaviorSelectData}
                disabled={!canManageStructure}
                error={errors.expenseBehavior?.message}
                {...register("expenseBehavior")}
              />
            ) : null}

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
