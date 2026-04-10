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
  paymentMethodFormSchema,
  type PaymentMethodFormInputValues,
  type PaymentMethodFormValues,
} from "@/features/payment-methods/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, PaymentMethodType } from "@/types/database";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];

type StatusFilter = "all" | "active" | "inactive";

const paymentTypeLabels: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  debit_card: "Tarjeta débito",
  credit_card: "Tarjeta crédito",
  bank_transfer: "Transferencia",
  other: "Otro",
};

const paymentTypeSelectData = [
  { value: "cash", label: "Efectivo" },
  { value: "debit_card", label: "Tarjeta débito" },
  { value: "credit_card", label: "Tarjeta crédito" },
  { value: "bank_transfer", label: "Transferencia" },
  { value: "other", label: "Otro" },
];

function toDefaults(row?: PaymentMethodRow): PaymentMethodFormValues {
  if (!row) {
    return {
      name: "",
      type: "cash",
      closingDay: null,
      dueDay: null,
    };
  }

  return {
    name: row.name,
    type: row.type,
    closingDay: row.closing_day,
    dueDay: row.due_day,
  };
}

export default function PaymentMethodsPage() {
  const { supabase, workspace, user } = useWorkspace();
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PaymentMethodRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormInputValues, unknown, PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: toDefaults(),
  });

  const selectedType = watch("type");

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    const response = await supabase
      .from("payment_methods")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: true });

    setIsLoading(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar medios de pago",
        message: response.error.message,
      });
      return;
    }

    setRows(response.data);
  }, [supabase, workspace.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  function openCreateModal() {
    setEditingRow(null);
    reset(toDefaults());
    setIsModalOpen(true);
  }

  function openEditModal(row: PaymentMethodRow) {
    setEditingRow(row);
    reset(toDefaults(row));
    setIsModalOpen(true);
  }

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter === "all") {
        return true;
      }

      return statusFilter === "active" ? row.is_active : !row.is_active;
    });
  }, [rows, statusFilter]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name.trim(),
      type: values.type,
      closing_day: values.closingDay,
      due_day: values.dueDay,
      updated_at: new Date().toISOString(),
    };

    if (editingRow) {
      const updateResponse = await supabase
        .from("payment_methods")
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
        title: "Medio de pago actualizado",
        message: "Los cambios se guardaron correctamente.",
      });
    } else {
      const insertResponse = await supabase.from("payment_methods").insert({
        workspace_id: workspace.id,
        name: payload.name,
        type: payload.type,
        closing_day: payload.closing_day,
        due_day: payload.due_day,
        is_active: true,
        created_by: user.id,
      });

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: "No pudimos crear el medio de pago",
          message: insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "green",
        title: "Medio de pago creado",
        message: "El medio de pago ya está disponible.",
      });
    }

    setIsModalOpen(false);
    setEditingRow(null);
    reset(toDefaults());
    await loadRows();
  });

  async function toggleActive(row: PaymentMethodRow) {
    const response = await supabase
      .from("payment_methods")
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
      title: row.is_active ? "Medio desactivado" : "Medio activado",
      message: "Estado actualizado correctamente.",
    });

    await loadRows();
  }

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isLoading} />

      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Title order={2}>Medios de pago</Title>
          <Text c="dimmed" size="sm">
            Definí los medios que vas a usar al registrar movimientos.
          </Text>
        </Stack>

        <Button onClick={openCreateModal}>Nuevo medio</Button>
      </Group>

      <Paper withBorder radius="md" p="md">
        <NativeSelect
          w={220}
          label="Estado"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.currentTarget.value as StatusFilter)}
          data={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Activos" },
            { value: "inactive", label: "Inactivos" },
          ]}
        />
      </Paper>

      <Paper withBorder radius="md" p="md">
        {visibleRows.length === 0 ? (
          <Text size="sm" c="dimmed">
            No hay medios de pago para el filtro seleccionado.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={840}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Cierre</Table.Th>
                  <Table.Th>Vencimiento</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleRows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{paymentTypeLabels[row.type]}</Badge>
                    </Table.Td>
                    <Table.Td>{row.closing_day ?? "-"}</Table.Td>
                    <Table.Td>{row.due_day ?? "-"}</Table.Td>
                    <Table.Td>
                      <Badge color={row.is_active ? "teal" : "gray"}>
                        {row.is_active ? "Activo" : "Inactivo"}
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
        title={editingRow ? "Editar medio de pago" : "Nuevo medio de pago"}
      >
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Nombre"
              placeholder="Ej: Tarjeta Galicia"
              error={errors.name?.message}
              {...register("name")}
            />

            <NativeSelect
              label="Tipo"
              data={paymentTypeSelectData}
              error={errors.type?.message}
              {...register("type")}
            />

            <TextInput
              label="Día de cierre (opcional)"
              type="number"
              placeholder="Ej: 20"
              disabled={selectedType !== "credit_card"}
              error={errors.closingDay?.message}
              {...register("closingDay")}
            />

            <TextInput
              label="Día de vencimiento (opcional)"
              type="number"
              placeholder="Ej: 10"
              disabled={selectedType !== "credit_card"}
              error={errors.dueDay?.message}
              {...register("dueDay")}
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
