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
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { Controller, useForm } from "react-hook-form";

import {
  formatBudgetAmount,
  parseBudgetAmount,
  sanitizeBudgetTypingValue,
} from "@/features/budget/amount-format";
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
  "start_year" | "currency_code" | "show_cents"
>;

type TypeFilter = TransactionType | "all";

type TransactionGroup = {
  key: string;
  label: string;
  rows: TransactionRow[];
};

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
    amount: formatBudgetAmount(row.amount),
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

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("es");
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

function TrashIcon({ size = 14 }: { size?: number }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function TransactionsPage() {
  const { supabase, workspace, user } = useWorkspace();
  const isMobile = useMediaQuery("(max-width: 48em)");

  const now = useMemo(() => new Date(), []);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [currencyCode, setCurrencyCode] = useState("ARS");
  const [showCents, setShowCents] = useState(false);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TransactionRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
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

  const roundedCurrencyFormatter = useMemo(() => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currencyCode || "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }, [currencyCode]);

  const visibleAmountFormatter = useMemo(
    () => (showCents ? currencyFormatter : roundedCurrencyFormatter),
    [currencyFormatter, roundedCurrencyFormatter, showCents],
  );

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, []);

  const shortDateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
    });
  }, []);

  const longDateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
    });
  }, []);

  const longDateWithYearFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  const todayKey = useMemo(() => toDateInputValue(now), [now]);
  const yesterdayKey = useMemo(() => {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return toDateInputValue(yesterday);
  }, [now]);

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

  const categoryFilterOptions = useMemo(() => {
    const sortedCategories = [...categories].sort(sortCategories);

    return [
      { value: "all", label: "Todas" },
      ...sortedCategories.map((category) => ({
        value: category.id,
        label: category.is_active ? category.name : `${category.name} (inactiva)`,
      })),
    ];
  }, [categories]);

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

  const formatDate = useCallback(
    (dateValue: string | null) => {
      if (!dateValue) {
        return "-";
      }

      const parsedDate = parseDateValue(dateValue);
      if (!parsedDate) {
        return dateValue;
      }

      return dateFormatter.format(parsedDate);
    },
    [dateFormatter],
  );

  const formatCompactDate = useCallback(
    (dateValue: string) => {
      const parsedDate = parseDateValue(dateValue);
      if (!parsedDate) {
        return dateValue;
      }

      return shortDateFormatter
        .format(parsedDate)
        .replaceAll(".", "")
        .replace(" de ", " ")
        .toLocaleLowerCase("es");
    },
    [shortDateFormatter],
  );

  const formatGroupLabel = useCallback(
    (dateValue: string) => {
      if (dateValue === todayKey) {
        return "Hoy";
      }

      if (dateValue === yesterdayKey) {
        return "Ayer";
      }

      const parsedDate = parseDateValue(dateValue);
      if (!parsedDate) {
        return dateValue;
      }

      if (parsedDate.getFullYear() === now.getFullYear()) {
        return longDateFormatter.format(parsedDate);
      }

      return longDateWithYearFormatter.format(parsedDate);
    },
    [longDateFormatter, longDateWithYearFormatter, now, todayKey, yesterdayKey],
  );

  const normalizedSearchFilter = useMemo(() => normalizeSearchText(searchFilter), [searchFilter]);

  const filteredRows = useMemo(() => {
    if (normalizedSearchFilter === "") {
      return rows;
    }

    return rows.filter((row) => {
      const category = categoryById.get(row.category_id);
      const paymentMethod = row.payment_method_id
        ? paymentMethodById.get(row.payment_method_id)
        : null;

      const searchPool = [
        category?.name ?? "",
        row.description ?? "",
        row.notes ?? "",
        paymentMethod?.name ?? "",
        transactionTypeLabels[row.type],
        formatDate(row.transaction_date),
        formatCompactDate(row.transaction_date),
        currencyFormatter.format(row.amount),
        roundedCurrencyFormatter.format(row.amount),
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return searchPool.includes(normalizedSearchFilter);
    });
  }, [
    categoryById,
    currencyFormatter,
    formatCompactDate,
    formatDate,
    normalizedSearchFilter,
    paymentMethodById,
    roundedCurrencyFormatter,
    rows,
  ]);

  const groupedRows = useMemo<TransactionGroup[]>(() => {
    const byDate = new Map<string, TransactionRow[]>();

    for (const row of filteredRows) {
      const dateKey = row.transaction_date;
      const groupRows = byDate.get(dateKey);

      if (groupRows) {
        groupRows.push(row);
      } else {
        byDate.set(dateKey, [row]);
      }
    }

    return Array.from(byDate.entries()).map(([key, groupedDateRows]) => ({
      key,
      label: formatGroupLabel(key),
      rows: groupedDateRows,
    }));
  }, [filteredRows, formatGroupLabel]);

  const activeFiltersCount =
    Number(typeFilter !== "all") +
    Number(categoryFilter !== "all") +
    Number(normalizedSearchFilter !== "");

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

  useEffect(() => {
    if (categoryFilter === "all") {
      return;
    }

    const isFilterAvailable = categoryFilterOptions.some((option) => option.value === categoryFilter);
    if (!isFilterAvailable) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, categoryFilterOptions]);

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
        .select("start_year, currency_code, show_cents")
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
      setShowCents(false);
    } else {
      const settings = settingsResponse.data as WorkspaceSettingsLiteRow | null;
      setStartYear(settings?.start_year ?? new Date().getFullYear());
      setCurrencyCode(settings?.currency_code ?? "ARS");
      setShowCents(settings?.show_cents ?? false);
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

    if (categoryFilter !== "all") {
      query = query.eq("category_id", categoryFilter);
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
  }, [categoryFilter, selectedMonth, selectedYear, supabase, typeFilter, workspace.id]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    void loadTransactions();
  }, [isBootstrapping, loadTransactions]);

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
  }

  function openCreateModal() {
    const defaultType = typeFilter === "all" ? "expense" : typeFilter;
    const filteredCategory = categoryFilter !== "all" ? categoryById.get(categoryFilter) : null;

    const resolvedType = filteredCategory?.is_active ? filteredCategory.type : defaultType;
    const defaults = toFormDefaults(undefined, resolvedType);

    if (filteredCategory?.is_active && filteredCategory.type === resolvedType) {
      defaults.categoryId = filteredCategory.id;
    }

    setEditingRow(null);
    reset(defaults);
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

    closeModal();
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
    <Stack gap="sm" pos="relative" style={isMobile ? { paddingBottom: "5.2rem" } : undefined}>
      <LoadingOverlay visible={isBootstrapping || isLoadingTransactions} />

      <Group justify="space-between" align="end" wrap="wrap" gap="xs">
        <Stack gap={2}>
          <Title order={2}>Transacciones</Title>
          <Text c="dimmed" size="sm">
            Vista operativa de movimientos reales del período.
          </Text>
        </Stack>

        {!isMobile ? (
          <Button onClick={openCreateModal} disabled={!hasAnyActiveCategory}>
            Nueva transacción
          </Button>
        ) : null}
      </Group>

      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group align="end" wrap="wrap" gap="xs">
            <NativeSelect
              label="Año"
              data={yearOptions}
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number(event.currentTarget.value))}
              style={{ minWidth: 104 }}
            />

            <NativeSelect
              label="Mes"
              data={monthOptions}
              value={String(selectedMonth)}
              onChange={(event) => setSelectedMonth(Number(event.currentTarget.value))}
              style={{ minWidth: 132 }}
            />

            <NativeSelect
              label="Tipo"
              data={[{ value: "all", label: "Todos" }, ...transactionTypeSelectData]}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.currentTarget.value as TypeFilter)}
              style={{ minWidth: 132 }}
            />

            <NativeSelect
              label="Categoría"
              data={categoryFilterOptions}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.currentTarget.value)}
              style={{ minWidth: 180 }}
            />

            <TextInput
              label="Buscar"
              placeholder="Categoría, descripción, nota..."
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.currentTarget.value)}
              style={{ minWidth: 220, flex: "1 1 220px" }}
            />
          </Group>

          <Text size="xs" c="dimmed">
            {monthLabel(selectedMonth)} {selectedYear} · {filteredRows.length} movimiento
            {filteredRows.length === 1 ? "" : "s"}
            {activeFiltersCount > 0
              ? ` · ${activeFiltersCount} filtro${activeFiltersCount === 1 ? "" : "s"} activo${activeFiltersCount === 1 ? "" : "s"}`
              : ""}
          </Text>
        </Stack>
      </Paper>

      {!hasAnyActiveCategory ? (
        <Alert color="yellow" variant="light">
          Necesitás al menos una categoría activa para registrar transacciones.
        </Alert>
      ) : null}

      <Paper withBorder radius="md" p={6}>
        {groupedRows.length === 0 ? (
          <Text size="sm" c="dimmed" p="xs">
            No hay transacciones para este período y filtros.
          </Text>
        ) : (
          <Stack gap={8}>
            {groupedRows.map((group) => (
              <Stack key={group.key} gap={5}>
                <Text
                  size="10px"
                  fw={700}
                  c="dimmed"
                  px={6}
                  tt="uppercase"
                  style={{ letterSpacing: "0.04em" }}
                >
                  {group.label}
                </Text>

                <Stack gap={5}>
                  {group.rows.map((row) => {
                    const category = categoryById.get(row.category_id);
                    const paymentMethod = row.payment_method_id
                      ? paymentMethodById.get(row.payment_method_id)
                      : null;

                    const metaParts = [formatCompactDate(row.transaction_date)];
                    if (paymentMethod?.name) {
                      metaParts.push(paymentMethod.name);
                    }
                    if (row.effective_date) {
                      metaParts.push(`Efec. ${formatCompactDate(row.effective_date)}`);
                    }

                    return (
                      <Paper key={row.id} withBorder radius={6} p={isMobile ? 7 : 8}>
                        <Stack gap={3}>
                          <Group justify="space-between" align="flex-start" wrap="nowrap" gap={6}>
                            <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
                              <Text fw={600} size="sm" lineClamp={1} style={{ lineHeight: 1.15 }}>
                                {category?.name ?? "Categoría no disponible"}
                              </Text>

                              {row.description ? (
                                <Text size="11px" c="dimmed" lineClamp={1} style={{ lineHeight: 1.15 }}>
                                  {row.description}
                                </Text>
                              ) : null}
                            </Stack>

                            <Stack
                              align="flex-end"
                              gap={1}
                              style={{ minWidth: isMobile ? 132 : 196, flexShrink: 0 }}
                            >
                              <Text
                                fw={800}
                                style={{
                                  fontSize: isMobile ? "1.2rem" : "1.5rem",
                                  textAlign: "right",
                                  lineHeight: 1,
                                  letterSpacing: "-0.01em",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {visibleAmountFormatter.format(row.amount)}
                              </Text>
                              <Badge size="xs" variant="light" color={transactionTypeColors[row.type]}>
                                {transactionTypeLabels[row.type]}
                              </Badge>
                            </Stack>
                          </Group>

                          <Group justify="space-between" align="center" wrap="nowrap" gap={6}>
                            <Text size="11px" c="dimmed" lineClamp={1} style={{ minWidth: 0 }}>
                              {metaParts.join(" · ")}
                            </Text>

                            <Group gap={1} wrap="nowrap">
                              <Button
                                size="xs"
                                variant="subtle"
                                color="gray"
                                leftSection={<EditIcon size={11} />}
                                onClick={() => openEditModal(row)}
                                aria-label="Editar transacción"
                                px={isMobile ? 6 : 8}
                                styles={{ label: { fontSize: "0.67rem", fontWeight: 500 } }}
                              >
                                {isMobile ? null : "Editar"}
                              </Button>
                              <Button
                                size="xs"
                                variant="subtle"
                                color="red"
                                leftSection={<TrashIcon size={11} />}
                                loading={deletingId === row.id}
                                onClick={() => confirmDelete(row)}
                                aria-label="Eliminar transacción"
                                px={isMobile ? 6 : 8}
                                styles={{ label: { fontSize: "0.67rem", fontWeight: 500 } }}
                              >
                                {isMobile ? null : "Eliminar"}
                              </Button>
                            </Group>
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      {isMobile ? (
        <Paper
          withBorder
          radius={8}
          p={6}
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
            zIndex: 40,
            backgroundColor: "var(--mantine-color-body)",
            boxShadow: "0 -8px 18px rgba(0, 0, 0, 0.08)",
          }}
        >
          <Button onClick={openCreateModal} disabled={!hasAnyActiveCategory} fullWidth>
            Nueva transacción
          </Button>
        </Paper>
      ) : null}

      <Modal
        opened={isModalOpen}
        onClose={closeModal}
        title={editingRow ? "Editar transacción" : "Nueva transacción"}
        size="lg"
        fullScreen={isMobile}
      >
        <form onSubmit={onSubmit}>
          <Stack gap="sm">
            <Stack gap={4}>
              <Text size="sm" fw={600}>
                Tipo
              </Text>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <SegmentedControl
                    fullWidth
                    data={transactionTypeSelectData}
                    value={field.value}
                    onChange={(value) => field.onChange(value as TransactionType)}
                  />
                )}
              />
              {errors.type?.message ? (
                <Text size="xs" c="red">
                  {errors.type.message}
                </Text>
              ) : null}
            </Stack>

            <Group grow align="start">
              <NativeSelect
                label="Categoría"
                data={[{ value: "", label: "Seleccionar categoría" }, ...categoryOptions]}
                error={errors.categoryId?.message}
                {...register("categoryId")}
              />

              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <TextInput
                    label="Monto"
                    inputMode="decimal"
                    placeholder="0"
                    autoFocus
                    error={errors.amount?.message}
                    value={
                      typeof field.value === "string"
                        ? field.value
                        : field.value === null || field.value === undefined
                          ? ""
                          : String(field.value)
                    }
                    onChange={(event) => {
                      field.onChange(sanitizeBudgetTypingValue(event.currentTarget.value));
                    }}
                    onBlur={(event) => {
                      field.onBlur();
                      const parsed = parseBudgetAmount(event.currentTarget.value);
                      field.onChange(parsed === null ? "" : formatBudgetAmount(parsed));
                    }}
                    leftSection={<Text size="xs" c="dimmed" fw={700}>$</Text>}
                    leftSectionWidth={24}
                    styles={{ input: { textAlign: "right", fontVariantNumeric: "tabular-nums" } }}
                  />
                )}
              />
            </Group>

            <TextInput
              label="Fecha de transacción"
              type="date"
              error={errors.transactionDate?.message}
              {...register("transactionDate")}
            />

            <Paper withBorder radius="md" p="sm">
              <Stack gap="xs">
                <Text size="xs" c="dimmed" fw={600}>
                  Campos opcionales
                </Text>

                <Group grow align="start">
                  <TextInput
                    label="Fecha efectiva"
                    type="date"
                    error={errors.effectiveDate?.message}
                    {...register("effectiveDate")}
                  />

                  <NativeSelect
                    label="Medio de pago"
                    data={[{ value: "", label: "Sin medio de pago" }, ...paymentMethodOptions]}
                    error={errors.paymentMethodId?.message}
                    {...register("paymentMethodId")}
                  />
                </Group>

                <TextInput
                  label="Descripción"
                  placeholder="Ej: Compra semanal"
                  error={errors.description?.message}
                  {...register("description")}
                />

                <Textarea
                  label="Notas"
                  placeholder="Detalle adicional del movimiento"
                  minRows={2}
                  autosize
                  error={errors.notes?.message}
                  {...register("notes")}
                />
              </Stack>
            </Paper>

            <Group justify="flex-end" mt="sm">
              <Button type="button" variant="light" color="gray" onClick={closeModal}>
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
