"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
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
  Textarea,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { useForm } from "react-hook-form";

import {
  transactionFormSchema,
  type TransactionFormInputValues,
  type TransactionFormValues,
} from "@/features/transactions/schema";
import { useWorkspace } from "@/features/workspace/workspace-provider";
import type { Database, TransactionType } from "@/types/database";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type PaymentMethodRow = Database["public"]["Tables"]["payment_methods"]["Row"];
type WorkspaceSettingsLiteRow = Pick<
  Database["public"]["Tables"]["workspace_settings"]["Row"],
  "start_year" | "currency_code"
>;

type TypeFilter = TransactionType | "all";

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

const transactionTypeLabels: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  saving: "Ahorro",
};

const transactionTypeColors: Record<TransactionType, string> = {
  income: "teal",
  expense: "pink",
  saving: "indigo",
};

const transactionTypeSelectData = [
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Gasto" },
  { value: "saving", label: "Ahorro" },
];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function monthLabel(month: number) {
  return monthOptions.find((option) => Number(option.value) === month)?.label ?? `Mes ${month}`;
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

function parseDateValue(dateValue: string) {
  const [yearText, monthText, dayText] = dateValue.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function toFormDefaults(
  row?: TransactionRow,
  preferredType: TransactionType = "expense",
): TransactionFormInputValues {
  if (!row) {
    const today = toDateInputValue(new Date());
    return {
      type: preferredType,
      categoryId: "",
      amount: "",
      transactionDate: today,
      effectiveDate: "",
      paymentMethodId: "",
      description: "",
      notes: "",
    };
  }

  return {
    type: row.type,
    categoryId: row.category_id,
    amount: String(row.amount),
    transactionDate: row.transaction_date,
    effectiveDate: row.effective_date ?? "",
    paymentMethodId: row.payment_method_id ?? "",
    description: row.description ?? "",
    notes: row.notes ?? "",
  };
}

function sortCategories(a: CategoryRow, b: CategoryRow) {
  const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return a.name.localeCompare(b.name, "es");
}

export default function TransactionsPage() {
  const { supabase, workspace, user } = useWorkspace();

  const now = useMemo(() => new Date(), []);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormInputValues, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: toFormDefaults(),
  });

  const selectedType = watch("type");
  const selectedCategoryId = watch("categoryId");
  const selectedPaymentMethodId = watch("paymentMethodId");

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const paymentMethodById = useMemo(
    () => new Map(paymentMethods.map((paymentMethod) => [paymentMethod.id, paymentMethod])),
    [paymentMethods],
  );

  const hasAnyActiveCategory = useMemo(
    () => categories.some((category) => category.is_active),
    [categories],
  );

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currencyCode]);

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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

  const categoryOptions = useMemo(() => {
    const currentCategoryId = editingRow?.category_id ?? null;

    return categories
      .filter(
        (category) =>
          category.type === selectedType && (category.is_active || category.id === currentCategoryId),
      )
      .sort(sortCategories)
      .map((category) => ({
        value: category.id,
        label: category.is_active ? category.name : `${category.name} (inactiva)`,
      }));
  }, [categories, editingRow?.category_id, selectedType]);

  const paymentMethodOptions = useMemo(() => {
    const currentPaymentMethodId = editingRow?.payment_method_id ?? null;

    return paymentMethods
      .filter(
        (paymentMethod) =>
          paymentMethod.is_active || paymentMethod.id === currentPaymentMethodId,
      )
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((paymentMethod) => ({
        value: paymentMethod.id,
        label: paymentMethod.is_active ? paymentMethod.name : `${paymentMethod.name} (inactivo)`,
      }));
  }, [editingRow?.payment_method_id, paymentMethods]);

  useEffect(() => {
    if (selectedCategoryId === "") {
      return;
    }

    const isCategoryAvailable = categoryOptions.some((option) => option.value === selectedCategoryId);
    if (!isCategoryAvailable) {
      setValue("categoryId", "");
    }
  }, [categoryOptions, selectedCategoryId, setValue]);

  useEffect(() => {
    if (!selectedPaymentMethodId) {
      return;
    }

    const isPaymentMethodAvailable = paymentMethodOptions.some(
      (option) => option.value === selectedPaymentMethodId,
    );

    if (!isPaymentMethodAvailable) {
      setValue("paymentMethodId", "");
    }
  }, [paymentMethodOptions, selectedPaymentMethodId, setValue]);

  const loadBaseData = useCallback(async () => {
    setIsBootstrapping(true);

    const [categoriesResponse, paymentMethodsResponse, settingsResponse] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("payment_methods")
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
      const sorted = [...categoriesResponse.data].sort(sortCategories);
      setCategories(sorted);
    }

    if (paymentMethodsResponse.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar medios de pago",
        message: paymentMethodsResponse.error.message,
      });
      setPaymentMethods([]);
    } else {
      setPaymentMethods(paymentMethodsResponse.data);
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

  const loadTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);

    const { start, end } = buildMonthRange(selectedYear, selectedMonth);

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("workspace_id", workspace.id)
      .gte("transaction_date", start)
      .lt("transaction_date", end)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const response = await query;
    setIsLoadingTransactions(false);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos cargar transacciones",
        message: response.error.message,
      });
      return;
    }

    setRows(response.data);
  }, [selectedMonth, selectedYear, supabase, typeFilter, workspace.id]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    void loadTransactions();
  }, [isBootstrapping, loadTransactions]);

  function formatDate(dateValue: string | null) {
    if (!dateValue) {
      return "-";
    }

    const parsedDate = parseDateValue(dateValue);
    if (!parsedDate) {
      return dateValue;
    }

    return dateFormatter.format(parsedDate);
  }

  function openCreateModal() {
    const defaultType = typeFilter === "all" ? "expense" : typeFilter;
    setEditingRow(null);
    reset(toFormDefaults(undefined, defaultType));
    setIsModalOpen(true);
  }

  function openEditModal(row: TransactionRow) {
    setEditingRow(row);
    reset(toFormDefaults(row));
    setIsModalOpen(true);
  }

  const onSubmit = handleSubmit(async (values) => {
    const category = categoryById.get(values.categoryId);
    if (!category || category.workspace_id !== workspace.id) {
      notifications.show({
        color: "red",
        title: "Categoría inválida",
        message: "La categoría seleccionada no pertenece al workspace actual.",
      });
      return;
    }

    if (category.type !== values.type) {
      notifications.show({
        color: "red",
        title: "Tipo incompatible",
        message: "La categoría debe coincidir con el tipo de transacción.",
      });
      return;
    }

    if (!category.is_active && (!editingRow || editingRow.category_id !== category.id)) {
      notifications.show({
        color: "red",
        title: "Categoría inactiva",
        message: "Seleccioná una categoría activa para crear una nueva transacción.",
      });
      return;
    }

    const paymentMethod = values.paymentMethodId
      ? paymentMethodById.get(values.paymentMethodId)
      : null;

    if (values.paymentMethodId && (!paymentMethod || paymentMethod.workspace_id !== workspace.id)) {
      notifications.show({
        color: "red",
        title: "Medio de pago inválido",
        message: "El medio de pago seleccionado no pertenece al workspace actual.",
      });
      return;
    }

    if (
      paymentMethod &&
      !paymentMethod.is_active &&
      (!editingRow || editingRow.payment_method_id !== paymentMethod.id)
    ) {
      notifications.show({
        color: "red",
        title: "Medio de pago inactivo",
        message: "Seleccioná un medio de pago activo para crear una nueva transacción.",
      });
      return;
    }

    const payload = {
      type: values.type,
      category_id: values.categoryId,
      amount: Math.round(values.amount * 100) / 100,
      transaction_date: values.transactionDate,
      effective_date: values.effectiveDate,
      payment_method_id: values.paymentMethodId,
      description: values.description,
      notes: values.notes,
      updated_at: new Date().toISOString(),
    };

    if (editingRow) {
      const updateResponse = await supabase
        .from("transactions")
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
        title: "Transacción actualizada",
        message: "Los cambios se guardaron correctamente.",
      });
    } else {
      const insertResponse = await supabase.from("transactions").insert({
        workspace_id: workspace.id,
        type: payload.type,
        category_id: payload.category_id,
        amount: payload.amount,
        transaction_date: payload.transaction_date,
        effective_date: payload.effective_date,
        payment_method_id: payload.payment_method_id,
        description: payload.description,
        notes: payload.notes,
        is_recurring: false,
        created_by: user.id,
      });

      if (insertResponse.error) {
        notifications.show({
          color: "red",
          title: "No pudimos registrar la transacción",
          message: insertResponse.error.message,
        });
        return;
      }

      notifications.show({
        color: "green",
        title: "Transacción registrada",
        message: "La transacción se guardó correctamente.",
      });
    }

    setIsModalOpen(false);
    setEditingRow(null);
    reset(toFormDefaults(undefined, values.type));
    await loadTransactions();
  });

  async function deleteTransaction(row: TransactionRow) {
    setDeletingId(row.id);

    const response = await supabase
      .from("transactions")
      .delete()
      .eq("id", row.id)
      .eq("workspace_id", workspace.id);

    setDeletingId(null);

    if (response.error) {
      notifications.show({
        color: "red",
        title: "No pudimos eliminar la transacción",
        message: response.error.message,
      });
      return;
    }

    notifications.show({
      color: "green",
      title: "Transacción eliminada",
      message: "El movimiento se eliminó correctamente.",
    });

    await loadTransactions();
  }

  function confirmDelete(row: TransactionRow) {
    modals.openConfirmModal({
      title: "Eliminar transacción",
      centered: true,
      labels: {
        confirm: "Eliminar",
        cancel: "Cancelar",
      },
      confirmProps: {
        color: "red",
      },
      children: (
        <Text size="sm" c="dimmed">
          Esta acción no se puede deshacer. La transacción se eliminará del período actual.
        </Text>
      ),
      onConfirm: () => {
        void deleteTransaction(row);
      },
    });
  }

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={isBootstrapping || isLoadingTransactions} />

      <Group justify="space-between" align="end">
        <Stack gap={2}>
          <Title order={2}>Transacciones</Title>
          <Text c="dimmed" size="sm">
            Registrá ingresos, gastos y ahorro reales para el período operativo.
          </Text>
        </Stack>

        <Button onClick={openCreateModal} disabled={!hasAnyActiveCategory}>
          Nueva transacción
        </Button>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Group align="end" justify="space-between">
          <Group align="end">
            <NativeSelect
              label="Año"
              data={yearOptions}
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
            />

            <NativeSelect
              label="Mes"
              data={monthOptions}
              value={String(selectedMonth)}
              onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
            />

            <NativeSelect
              label="Tipo"
              data={[{ value: "all", label: "Todos" }, ...transactionTypeSelectData]}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
            />
          </Group>

          <Text size="sm" c="dimmed">
            Mostrando {monthLabel(selectedMonth)} {selectedYear}
          </Text>
        </Group>
      </Paper>

      {!hasAnyActiveCategory ? (
        <Alert color="yellow" variant="light">
          Necesitás al menos una categoría activa para registrar transacciones.
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p="md">
        {rows.length === 0 ? (
          <Text size="sm" c="dimmed">
            No hay transacciones para este período y filtro.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={1200}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Fecha efectiva</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Categoría</Table.Th>
                  <Table.Th>Medio de pago</Table.Th>
                  <Table.Th>Descripción</Table.Th>
                  <Table.Th>Notas</Table.Th>
                  <Table.Th style={{ textAlign: "right" }}>Monto</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const category = categoryById.get(row.category_id);
                  const paymentMethod = row.payment_method_id
                    ? paymentMethodById.get(row.payment_method_id)
                    : null;

                  return (
                    <Table.Tr key={row.id}>
                      <Table.Td>{formatDate(row.transaction_date)}</Table.Td>
                      <Table.Td>{formatDate(row.effective_date)}</Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={transactionTypeColors[row.type]}>
                          {transactionTypeLabels[row.type]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{category?.name ?? "Categoría no disponible"}</Table.Td>
                      <Table.Td>{paymentMethod?.name ?? "-"}</Table.Td>
                      <Table.Td>{row.description ?? "-"}</Table.Td>
                      <Table.Td>{row.notes ?? "-"}</Table.Td>
                      <Table.Td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {currencyFormatter.format(row.amount)}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button size="xs" variant="light" onClick={() => openEditModal(row)}>
                            Editar
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            variant="subtle"
                            loading={deletingId === row.id}
                            onClick={() => confirmDelete(row)}
                          >
                            Eliminar
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
        title={editingRow ? "Editar transacción" : "Nueva transacción"}
        size="lg"
      >
        <form onSubmit={onSubmit}>
          <Stack>
            <Group grow align="start">
              <NativeSelect
                label="Tipo"
                data={transactionTypeSelectData}
                error={errors.type?.message}
                {...register("type")}
              />

              <NativeSelect
                label="Categoría"
                data={[
                  { value: "", label: "Seleccionar categoría" },
                  ...categoryOptions,
                ]}
                error={errors.categoryId?.message}
                {...register("categoryId")}
              />
            </Group>

            <Group grow align="start">
              <TextInput
                label="Monto"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0"
                error={errors.amount?.message}
                {...register("amount")}
              />

              <TextInput
                label="Fecha de transacción"
                type="date"
                error={errors.transactionDate?.message}
                {...register("transactionDate")}
              />
            </Group>

            <Group grow align="start">
              <TextInput
                label="Fecha efectiva (opcional)"
                type="date"
                error={errors.effectiveDate?.message}
                {...register("effectiveDate")}
              />

              <NativeSelect
                label="Medio de pago (opcional)"
                data={[
                  { value: "", label: "Sin medio de pago" },
                  ...paymentMethodOptions,
                ]}
                error={errors.paymentMethodId?.message}
                {...register("paymentMethodId")}
              />
            </Group>

            <TextInput
              label="Descripción (opcional)"
              placeholder="Ej: Compra semanal"
              error={errors.description?.message}
              {...register("description")}
            />

            <Textarea
              label="Notas (opcional)"
              placeholder="Detalle adicional del movimiento"
              minRows={3}
              autosize
              error={errors.notes?.message}
              {...register("notes")}
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
