"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Group,
  LoadingOverlay,
  Modal,
  NativeSelect,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useForm } from "react-hook-form";

import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/features/categories/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

type TypeFilter = TransactionType | "all";
type StatusFilter = "all" | "active" | "inactive";

const categoryTypeLabels: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  saving: "Ahorro",
};

const categoryTypeColors: Record<TransactionType, string> = {
  income: "teal",
  expense: "pink",
  saving: "indigo",
};

const categoryTypeSelectData = [
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
  { value: "saving", label: "Ahorro" },
];

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

export default function CategoriesPage() {
  const { supabase, workspace, user } = useWorkspace();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<CategoryRow | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: toCategoryDefaults(),
  });

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    const response = await supabase
      .from("categories")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    setIsLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar categorías",
        message: response.error.message,
      });
      return;
    }

    const sorted = [...response.data].sort((a, b) => {
      const aOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });

    setRows(sorted);
  }, [supabase, workspace.id]);

  useEffect(() => {
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

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const passesType = typeFilter === "all" ? true : row.type === typeFilter;
      const passesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? row.is_active
            : !row.is_active;

      return passesType && passesStatus;
    });
  }, [rows, statusFilter, typeFilter]);

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

    setIsModalOpen(false);
    setEditingRow(null);
    reset(toCategoryDefaults());
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

    await loadRows();
  }

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Title order={2}>Categorías</Title>
          <Text c="dimmed" size="sm">
            Administrá el catálogo de ingresos, gastos y ahorro del workspace.
          </Text>
        </Stack>

        <Button onClick={openCreateModal}>Nueva categoría</Button>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Group align="end">
          <NativeSelect
            label="Tipo"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
            data={[
              { value: "all", label: "Todos" },
              ...categoryTypeSelectData,
            ]}
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
          />
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="md">
        {visibleRows.length === 0 ? (
          <Text size="sm" c="dimmed">
            No hay categorías para los filtros seleccionados.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Orden</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleRows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={categoryTypeColors[row.type]}>
                        {categoryTypeLabels[row.type]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{row.sort_order ?? "-"}</Table.Td>
                    <Table.Td>
                      <Badge color={row.is_active ? "teal" : "gray"}>
                        {row.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button size="xs" variant="light" onClick={() => openEditModal(row)}>
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color={row.is_active ? "gray" : "teal"}
                          onClick={() => void toggleActive(row)}
                        >
                          {row.is_active ? "Desactivar" : "Activar"}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRow ? "Editar categoría" : "Nueva categoría"}
      >
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Nombre"
              placeholder="Ej: Supermercado"
              error={errors.name?.message}
              {...register("name")}
            />

            <NativeSelect
              label="Tipo"
              data={categoryTypeSelectData}
              error={errors.type?.message}
              {...register("type")}
            />

            <TextInput
              label="Orden (opcional)"
              placeholder="0"
              type="number"
              error={errors.sortOrder?.message}
              {...register("sortOrder")}
            />

            <Group justify="flex-end" mt="sm">
              <Button
                type="button"
                variant="light"
                color="gray"
                onClick={() => setIsModalOpen(false)}
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
