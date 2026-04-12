"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Checkbox,
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
import { useForm, useWatch } from "react-hook-form";

import {
  paymentMethodFormSchema,
  type PaymentMethodFormInputValues,
  type PaymentMethodFormValues,
} from "@/features/payment-methods/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, PaymentMethodType } from "@/types/database";

type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "currency_code" | "show_cents"
>;

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

function normalizeBalanceByType(type: PaymentMethodType, value: number) {
  if (Math.abs(value) < 0.005) {
    return 0;
  }

  if (type === "credit_card") {
    return -Math.abs(value);
  }

  return value;
}

function toDefaults(row?: PaymentMethodRow): PaymentMethodFormValues {
  if (!row) {
    return {
      name: "",
      type: "cash",
      currentBalance: 0,
      includeInBalance: true,
      closingDay: null,
      dueDay: null,
    };
  }

  return {
    name: row.name,
    type: row.type,
    currentBalance: row.type === "credit_card" ? Math.abs(row.current_balance) : row.current_balance,
    includeInBalance: row.include_in_balance,
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
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PaymentMethodFormInputValues, unknown, PaymentMethodFormValues>({
    resolver: zodResolver(paymentMethodFormSchema),
    defaultValues: toDefaults(),
  });

  const selectedType = useWatch({ control, name: "type" });
  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    });
  }, [currencyCode, showCents]);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    const [paymentMethodsResponse, settingsResponse] = await Promise.all([
      supabase
        .from("payment_methods")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("workspace_settings")
        .select("currency_code, show_cents")
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
    ]);

    setIsLoading(false);

    if (paymentMethodsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar medios de pago",
        message: paymentMethodsResponse.error.message,
      });
      return;
    }

    if (settingsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar settings de moneda",
        message: settingsResponse.error.message,
      });
      setCurrencyCode("ARS");
      setShowCents(false);
    } else {
      const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
      setCurrencyCode(settings?.currency_code ?? "ARS");
      setShowCents(settings?.show_cents ?? false);
    }

    setRows(paymentMethodsResponse.data);
  }, [supabase, workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const normalizedCurrentBalance = normalizeBalanceByType(values.type, values.currentBalance);
    const isCreditCard = values.type === "credit_card";

    const payload = {
      name: values.name.trim(),
      type: values.type,
      current_balance: normalizedCurrentBalance,
      include_in_balance: values.includeInBalance,
      closing_day: isCreditCard ? values.closingDay : null,
      due_day: isCreditCard ? values.dueDay : null,
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
        current_balance: payload.current_balance,
        include_in_balance: payload.include_in_balance,
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
            Definí los medios operativos y su saldo actual para consolidar tu balance financiero.
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
          <Table.ScrollContainer minWidth={980}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Saldo actual</Table.Th>
                  <Table.Th>Participa en balance</Table.Th>
                  <Table.Th>Cierre</Table.Th>
                  <Table.Th>Vencimiento</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleRows.map((row) => {
                  const displayedBalance = normalizeBalanceByType(row.type, row.current_balance);

                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td>{row.name}</Table.Td>
                      <Table.Td>
                        <Badge variant="light">{paymentTypeLabels[row.type]}</Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: "right" }}>
                        <Text
                          fw={700}
                          c={
                            displayedBalance > 0
                              ? "#087f5b"
                              : displayedBalance < 0
                                ? "#c92a2a"
                                : "#667085"
                          }
                        >
                          {currencyFormatter.format(displayedBalance)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant={row.include_in_balance ? "light" : "outline"} color="blue">
                          {row.include_in_balance ? "Sí" : "No"}
                        </Badge>
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
                  );
                })}
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
              label={selectedType === "credit_card" ? "Deuda actual" : "Saldo actual"}
              type="number"
              step="0.01"
              placeholder={selectedType === "credit_card" ? "Ej: 250000" : "Ej: 120000"}
              error={errors.currentBalance?.message}
              {...register("currentBalance")}
            />

            {selectedType === "credit_card" ? (
              <Text size="xs" c="dimmed">
                Para tarjetas de crédito, el monto se guarda como deuda (valor negativo).
              </Text>
            ) : null}

            <Checkbox
              label="Incluir en balance principal"
              description="Si lo desactivás, el medio no se suma al balance consolidado del dashboard."
              {...register("includeInBalance")}
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
