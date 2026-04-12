"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
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
import { useForm } from "react-hook-form";

import {
  categoryFormSchema,
  type CategoryFormInputValues,
  type CategoryFormValues,
} from "@/features/categories/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

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
  expense: 0,
  income: 1,
  saving: 2,
};

const categoryTypeSectionLabels: Record<TransactionType, string> = {
  expense: "Gastos",
  income: "Ingresos",
  saving: "Ahorro",
};

const categoryTypeSectionOrder: TransactionType[] = ["expense", "income", "saving"];

const categoryTypeLabels: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  saving: "Ahorro",
};

const categoryGroupBackgroundColor: Record<TransactionType, string> = {
  expense: "var(--mantine-color-pink-0)",
  income: "var(--mantine-color-teal-0)",
  saving: "var(--mantine-color-indigo-0)",
};

const categoryGroupHeaderColor: Record<TransactionType, string> = {
  expense: "var(--mantine-color-pink-6)",
  income: "var(--mantine-color-teal-6)",
  saving: "var(--mantine-color-indigo-6)",
};

const categoryGroupBorderColor: Record<TransactionType, string> = {
  expense: "var(--mantine-color-pink-4)",
  income: "var(--mantine-color-teal-4)",
  saving: "var(--mantine-color-indigo-4)",
};

const categoryTypeSelectData = [
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
  { value: "saving", label: "Ahorro" },
];

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("es");
}

function sortCategories(a: CategoryRow, b: CategoryRow) {
  const typeDiff = categoryTypeOrder[a.type] - categoryTypeOrder[b.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return a.name.localeCompare(b.name, "es");
}

function toCategoryDefaults(row?: CategoryRow): CategoryFormValues {
  if (!row) {
    return {
      name: "",
      type: "expense",
      sortOrder: null,
    };
  }

  return {
    name: row.name,
    type: row.type,
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
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [usageByCategoryId, setUsageByCategoryId] = useState<Record<string, number>>({});
  const [hasUsageData, setHasUsageData] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormInputValues, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: toCategoryDefaults(),
  });

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
        title: "No pudimos cargar categorías",
        message: categoriesResponse.error.message,
      });
      setRows([]);
      setUsageByCategoryId({});
      return;
    }

    const sorted = [...categoriesResponse.data].sort(sortCategories);
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
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  function openCreateModal() {
    setEditingRow(null);
    reset(toCategoryDefaults());
    setIsModalOpen(true);
  }

  function openEditModal(row: CategoryRow) {
    setEditingRow(row);
    reset(toCategoryDefaults(row));
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    reset(toCategoryDefaults());
  }

  const normalizedSearchFilter = useMemo(() => normalizeSearchText(searchFilter), [searchFilter]);

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
          : `${row.name} ${categoryTypeLabels[row.type]} ${row.is_active ? "activa" : "inactiva"}`
              .toLocaleLowerCase("es")
              .includes(normalizedSearchFilter);

      return passesType && passesStatus && passesSearch;
    });
  }, [normalizedSearchFilter, rows, statusFilter, typeFilter]);

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
  }, [visibleRows]);

  const activeFiltersCount =
    Number(typeFilter !== "all") +
    Number(statusFilter !== "all") +
    Number(normalizedSearchFilter !== "");

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      type: values.type,
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
          title: "No pudimos guardar cambios",
          message: updateResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "green",
        title: "Categoría actualizada",
        message: "Los cambios se guardaron correctamente.",
      });
    } else {
      const insertResponse = await supabase.from("categories").insert({
        workspace_id: workspace.id,
        name: payload.name,
        type: payload.type,
        sort_order: payload.sort_order,
        is_active: true,
        created_by: user.id,
      });

      if (insertResponse.error) {
        const isDuplicatedName = insertResponse.error.code === "23505";
        notifications.show({
          color: "red",
          title: "No pudimos crear la categoría",
          message: isDuplicatedName
            ? "Ya existe una categoría con ese nombre en el workspace."
            : insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "green",
        title: "Categoría creada",
        message: "La categoría ya está disponible.",
      });
    }

    closeModal();
    await loadRows();
  });

  async function toggleActive(row: CategoryRow) {
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
        title: "No pudimos actualizar estado",
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "green",
      title: row.is_active ? "Categoría desactivada" : "Categoría activada",
      message: "Estado actualizado correctamente.",
    });

    setIsLoading(true);
    await loadRows();
  }

  return (
    <Stack gap="sm" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Group justify="space-between" align="end" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={2}>Categorías</Title>
          <Text c="dimmed" size="sm">
            Administrá el catálogo de ingresos, gastos y ahorro del workspace.
          </Text>
        </Stack>

        <Button
          onClick={openCreateModal}
          fullWidth={isMobile}
          radius="md"
          styles={{ root: { boxShadow: "none", border: "none" } }}
        >
          Nueva categoría
        </Button>
      </Group>

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group align="end" wrap="wrap" gap="xs">
            <NativeSelect
              label="Tipo"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
              data={[
                { value: "all", label: "Todos" },
                ...categoryTypeSelectData,
              ]}
              style={{ minWidth: 140 }}
            />

            <NativeSelect
              label="Estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
              data={[
                { value: "all", label: "Todos" },
                { value: "active", label: "Activas" },
                { value: "inactive", label: "Inactivas" },
              ]}
              style={{ minWidth: 140 }}
            />

            <TextInput
              label="Buscar"
              placeholder="Nombre, tipo o estado"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.currentTarget.value)}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            />
          </Group>

          <Text size="xs" c="dimmed">
            {visibleRows.length} categoría{visibleRows.length === 1 ? "" : "s"}
            {activeFiltersCount > 0
              ? ` · ${activeFiltersCount} filtro${activeFiltersCount === 1 ? "" : "s"} activo${activeFiltersCount === 1 ? "" : "s"}`
              : ""}
          </Text>
        </Stack>
      </Paper>

      {groupedRows.length === 0 ? (
        <Paper withBorder radius="md" p="md">
          <Text size="sm" c="dimmed">
            No hay categorías para los filtros seleccionados.
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
                      {group.rows.length} categoría{group.rows.length === 1 ? "" : "s"} · {activeRows} activa
                      {activeRows === 1 ? "" : "s"}
                    </Text>
                  </Stack>

                  <Stack gap={6}>
                    {group.rows.map((row) => {
                      const usageCount = usageByCategoryId[row.id] ?? 0;
                      const usageLabel =
                        usageCount === 0
                          ? "Sin uso"
                          : `${usageCount} movimiento${usageCount === 1 ? "" : "s"}`;

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

                              <Text
                                size="10px"
                                c={row.is_active ? "gray.6" : "gray.7"}
                                fw={500}
                                tt="uppercase"
                                style={{ letterSpacing: "0.03em" }}
                              >
                                {row.is_active ? "Activa" : "Inactiva"}
                              </Text>
                            </Stack>

                            <Menu position="bottom-end" withArrow>
                              <Menu.Target>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  aria-label={`Acciones para ${row.name}`}
                                >
                                  <DotsIcon />
                                </ActionIcon>
                              </Menu.Target>

                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<EditIcon size={13} />}
                                  onClick={() => openEditModal(row)}
                                >
                                  Editar
                                </Menu.Item>
                                <Menu.Item
                                  color={row.is_active ? "gray" : "teal"}
                                  leftSection={<ToggleActiveIcon size={13} />}
                                  onClick={() => void toggleActive(row)}
                                >
                                  {row.is_active ? "Desactivar" : "Activar"}
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
        title={editingRow ? "Editar categoría" : "Nueva categoría"}
        fullScreen={isMobile}
      >
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <TextInput
              label="Nombre"
              placeholder="Ej: Supermercado"
              autoFocus
              error={errors.name?.message}
              {...register("name")}
            />

            <NativeSelect
              label="Tipo"
              data={categoryTypeSelectData}
              error={errors.type?.message}
              {...register("type")}
            />

            <Paper withBorder radius="md" p="sm">
              <Stack gap={4}>
                <Text size="xs" c="dimmed" fw={600}>
                  Configuración opcional
                </Text>
                <TextInput
                  label="Orden interno"
                  description="Si no lo definís, la categoría queda al final de su tipo."
                  placeholder="0"
                  type="number"
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
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {editingRow ? "Guardar" : "Crear"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
